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
