-- 앞서 schema.sql 실행 후 이 파일을 한 번 실행합니다.
-- 현재 만들어 둔 이메일 계정을 가족 저장소의 고정 식별자로 사용합니다.
-- 그 계정으로 로그인할 필요는 없지만 저장소 사용 중 계정을 삭제하지 마세요.
begin;
create table if not exists public.family_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade
);
create table if not exists public.family_invites (
  token_hash text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  active boolean not null default true
);
alter table public.family_members enable row level security;
alter table public.family_invites enable row level security;
revoke all on public.family_members, public.family_invites from anon, authenticated;

create or replace function public.current_family() returns uuid
language sql stable security definer set search_path='' as $$
  select owner_id from public.family_members where user_id=(select auth.uid());
$$;
revoke all on function public.current_family() from public, anon;
grant execute on function public.current_family() to authenticated;

create or replace function public.redeem_family_invite(invite_token text) returns uuid
language plpgsql security definer set search_path='' as $$
declare target_owner uuid; existing_owner uuid;
begin
  if auth.uid() is null or invite_token is null or length(invite_token) <> 64 then
    raise exception 'Invalid invitation';
  end if;
  select owner_id into target_owner from public.family_invites
    where token_hash=encode(sha256(convert_to(invite_token,'UTF8')),'hex') and active;
  if target_owner is null then raise exception 'Invalid invitation'; end if;
  select owner_id into existing_owner from public.family_members where user_id=auth.uid();
  if existing_owner is not null and existing_owner<>target_owner then
    raise exception 'Already joined another family';
  end if;
  insert into public.family_members(user_id,owner_id) values(auth.uid(),target_owner)
    on conflict(user_id) do nothing;
  return target_owner;
end;
$$;
revoke all on function public.redeem_family_invite(text) from public, anon;
grant execute on function public.redeem_family_invite(text) to authenticated;

drop policy if exists family_owner on public.family_trip;
create policy family_owner on public.family_trip for all to authenticated
  using ((select public.current_family())=owner_id)
  with check ((select public.current_family())=owner_id);
drop function if exists public.save_family_trip(bigint,jsonb);
create or replace function public.save_family_trip(family_id uuid, expected_revision bigint, next_data jsonb)
returns setof public.family_trip
language plpgsql security invoker set search_path='' as $$
begin
  if jsonb_typeof(next_data) <> 'object' or octet_length(next_data::text)>5000000 then
    raise exception 'Invalid trip data';
  end if;
  return query update public.family_trip
    set data=next_data, revision=revision+1, updated_at=now()
    where owner_id=family_id and owner_id=(select public.current_family()) and revision=expected_revision
    returning *;
end;
$$;
revoke all on function public.save_family_trip(uuid,bigint,jsonb) from public, anon;
grant execute on function public.save_family_trip(uuid,bigint,jsonb) to authenticated;

-- 기존에 만든 이메일 계정이 정확히 하나일 때만 초대 링크를 만듭니다.
-- 링크 원문은 결과에만 표시하고 DB에는 해시만 저장합니다.
drop table if exists pg_temp.invitation_result;
create temporary table invitation_result(invite_url text);
do $$
declare family_owner uuid; token text;
begin
  if (select count(*) from auth.users where email is not null and email <> '')<>1 then
    raise exception 'Expected exactly one email account. Ask for setup assistance.';
  end if;
  select id into family_owner from auth.users where email is not null and email<>'';
  insert into public.family_members(user_id,owner_id) values(family_owner,family_owner) on conflict(user_id) do nothing;
  token:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
  insert into public.family_invites(token_hash,owner_id)
    values(encode(sha256(convert_to(token,'UTF8')),'hex'),family_owner);
  insert into invitation_result values('https://daisywon922.github.io/fukuoka-family/#invite='||token);
end $$;
commit;
select invite_url as "가족 초대 링크 · 가족끼리만 공유" from invitation_result;
