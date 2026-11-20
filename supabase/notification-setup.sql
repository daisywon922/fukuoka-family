-- 알림 기능 초기 설정: 기존 여행 데이터는 변경하지 않습니다.
-- 실패 시 전체 변경이 취소되도록 하나의 트랜잭션으로 실행합니다.
begin;

-- Additive migration. Existing travel data is not modified.
create table if not exists public.family_notices (
 id uuid primary key,
 family_id uuid not null references public.family_trip(owner_id),
 title text not null check(length(trim(title)) between 1 and 60),
 body text not null check(length(trim(body)) between 1 and 500),
 created_at timestamptz not null default now()
);
alter table public.family_notices enable row level security;
revoke all on public.family_notices from anon, authenticated;
grant select on public.family_notices to authenticated;
drop policy if exists family_read on public.family_notices;
create policy family_read on public.family_notices for select to authenticated using(family_id=public.current_family());
create table if not exists public.family_push_subscriptions (
 user_id uuid not null references auth.users(id) on delete cascade,
 family_id uuid not null references public.family_trip(owner_id),
 endpoint text not null check(length(endpoint)<4096 and endpoint ~ '^https://(fcm\.googleapis\.com|[a-z0-9.-]+\.push\.services\.mozilla\.com|web\.push\.apple\.com)/'),
 subscription jsonb not null,
 created_at timestamptz not null default now(),
 primary key(user_id,endpoint),
 check(subscription->>'endpoint'=endpoint)
);
alter table public.family_push_subscriptions enable row level security;
revoke all on public.family_push_subscriptions from anon, authenticated;
grant select,insert,update,delete on public.family_push_subscriptions to authenticated;
drop policy if exists own_device on public.family_push_subscriptions;
create policy own_device on public.family_push_subscriptions to authenticated using(user_id=auth.uid() and family_id=public.current_family()) with check(user_id=auth.uid() and family_id=public.current_family());

-- Optional in-app destination. Also applies when the initial migration was already run.
alter table public.family_notices add column if not exists target text
 check(target in ('schedule','places','overview','records','prepare','memos'));

alter table public.family_notices add column if not exists target_detail text check(length(target_detail)<=240);

-- Run AFTER notifications.sql. Existing records become the baseline, not alerts.
alter table public.family_notices add column if not exists source text not null default 'manual';
alter table public.family_notices add column if not exists push_claimed_at timestamptz;
create table if not exists public.family_notice_seen (
 family_id uuid not null references public.family_trip(owner_id) on delete cascade,
 item_key text not null,
 primary key(family_id,item_key)
);
alter table public.family_notice_seen enable row level security;
revoke all on public.family_notice_seen from public,anon,authenticated;
create or replace function public.notification_candidates(d jsonb)
returns table(item_key text,title text,body text,target text,target_detail text)
language sql immutable set search_path='' as $$
 select 'event:'||e.key,'새로운 일정이 추가되었어요',
 left(to_char((e.value->>'date')::date,'FMMM"월 "FMDD"일"')||' ('||substr('일월화수목금토',extract(dow from (e.value->>'date')::date)::integer+1,1)||') '||coalesce(e.value->'event'->>'title','새 일정'),500),'schedule','event:'||e.key
 from jsonb_each(coalesce(d->'eventOverrides','{}')) e where not coalesce(d->'deletedEventIds','[]') ? e.key
 union all
 select 'expense:'||(r->>'id'),'새로운 지출내역이 등록되었어요',left(coalesce(r->>'category','기타')||' • '||case when r->>'currency'='JPY' then '¥ ' else '' end||to_char((r->>'amount')::numeric,'FM999,999,999,999,999,990')||case when r->>'currency'='JPY' then '' else '원' end,500),'records','expense:'||(r->>'id')
 from jsonb_array_elements(coalesce(d->'records','[]')) r where r->>'type'='expense'
 union all
 select 'memo:'||(r->>'id'),'새로운 메모가 추가되었어요','작성자: '||coalesce(d->'memberNames'->>case when r->>'authorId' in ('member-1','member-2','member-3') then right(r->>'authorId',1)::integer-1 else (r->>'payer')::integer end,'구성원'),'memos','memo:'||(r->>'id')
 from jsonb_array_elements(coalesce(d->'records','[]')) r where r->>'type'='memo'

$$;
revoke all on function public.notification_candidates(jsonb) from public,anon,authenticated;
-- Initial baseline and repeated setup are safe: no historical notifications.
insert into public.family_notice_seen(family_id,item_key)
 select t.owner_id,c.item_key from public.family_trip t cross join lateral public.notification_candidates(t.data) c
 on conflict do nothing;
create or replace function public.notify_family_additions()
returns trigger language plpgsql security definer set search_path='' as $$
declare item record; newly_seen text;
begin
 -- First-time seed, canonical migration, and explicit backup import never announce old data.
 if TG_OP='INSERT' or coalesce(OLD.data->>'sharedCanonical','false') <> 'true' or NEW.data->>'notificationImport' is distinct from OLD.data->>'notificationImport' then
  insert into public.family_notice_seen(family_id,item_key) select NEW.owner_id,c.item_key from public.notification_candidates(NEW.data) c on conflict do nothing;
  return NEW;
 end if;
 for item in select * from public.notification_candidates(NEW.data) loop
  newly_seen:=null;
  insert into public.family_notice_seen(family_id,item_key) values(NEW.owner_id,item.item_key) on conflict do nothing returning item_key into newly_seen;
  if newly_seen is not null then
   insert into public.family_notices(id,family_id,title,body,target,target_detail,source)
   values(gen_random_uuid(),NEW.owner_id,item.title,coalesce(nullif(item.body,''),'새 항목을 확인해주세요.'),item.target,item.target_detail,'automatic');
  end if;
 end loop;
 return NEW;
end $$;
revoke all on function public.notify_family_additions() from public,anon,authenticated;
drop trigger if exists notify_family_additions on public.family_trip;
create trigger notify_family_additions after insert or update of data on public.family_trip for each row execute function public.notify_family_additions();

alter table public.family_push_subscriptions add column if not exists preferences jsonb not null default '{"schedule":true,"expense":true,"memo":true}'::jsonb;

commit;
