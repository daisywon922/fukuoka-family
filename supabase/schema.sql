-- Supabase SQL Editor에서 한 번 실행합니다.
-- 가족은 하나의 초대 전용 Auth 계정을 각 기기에서 사용합니다.
create table if not exists public.family_trip (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.family_trip enable row level security;
revoke all on public.family_trip from anon;
grant select, insert, update on public.family_trip to authenticated;
drop policy if exists family_owner on public.family_trip;
create policy family_owner on public.family_trip for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

-- revision을 비교해 동시에 저장한 변경을 조용히 덮어쓰지 않게 합니다.
create or replace function public.save_family_trip(expected_revision bigint, next_data jsonb)
returns setof public.family_trip
language plpgsql security invoker set search_path = '' as $$
begin
  if jsonb_typeof(next_data) <> 'object' or octet_length(next_data::text) > 5000000 then
    raise exception 'Invalid trip data';
  end if;
  return query update public.family_trip
    set data = next_data, revision = revision + 1, updated_at = now()
    where owner_id = (select auth.uid()) and revision = expected_revision
    returning *;
end;
$$;
revoke all on function public.save_family_trip(bigint,jsonb) from public, anon;
grant execute on function public.save_family_trip(bigint,jsonb) to authenticated;

-- 실시간 알림을 활성화합니다. 이미 등록되어 있으면 그대로 둡니다.
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='family_trip') then
    alter publication supabase_realtime add table public.family_trip;
  end if;
end $$;
