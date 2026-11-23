-- Read the trusted deployed manifest; never accept a version from a client.
create extension if not exists pg_net with schema extensions;
alter table public.family_notices drop constraint if exists family_notices_target_check;
alter table public.family_notices add constraint family_notices_target_check check(target in ('schedule','places','overview','records','prepare','memos','info'));
create table if not exists public.family_release_monitor (
 singleton boolean primary key default true check(singleton),
 last_version text not null,
 request_id bigint,
 checked_at timestamptz
);
alter table public.family_release_monitor enable row level security;
revoke all on public.family_release_monitor from public,anon,authenticated;
insert into public.family_release_monitor(singleton,last_version) values(true,'1.6.2') on conflict do nothing;
create or replace function public.check_family_release()
returns void language plpgsql security definer set search_path='' as $$
declare monitor public.family_release_monitor; response record; version text;
begin
 select * into monitor from public.family_release_monitor where singleton for update;
 if monitor.request_id is not null then
  select status_code,content into response from net._http_response where id=monitor.request_id;
  if response.status_code=200 then
   begin version:=response.content::jsonb->>'version'; exception when others then version:=null; end;
   if version ~ '^[0-9]{1,4}\.[0-9]{1,4}\.[0-9]{1,4}$' and string_to_array(version,'.')::integer[] > string_to_array(monitor.last_version,'.')::integer[] then
    insert into public.family_notices(id,family_id,title,body,target,source)
     select gen_random_uuid(),owner_id,'신규 업데이트가 있어요 ('||version||')','새롭게 바뀐 기능을 살펴보세요!','info','automatic' from public.family_trip;
    update public.family_release_monitor set last_version=version where singleton;
   end if;
  end if;
 end if;
 update public.family_release_monitor set request_id=net.http_get(url:='https://daisywon922.github.io/fukuoka-family/version.json',params:=jsonb_build_object('check',extract(epoch from now())::text),timeout_milliseconds:=10000),checked_at=now() where singleton;
end $$;
revoke all on function public.check_family_release() from public,anon,authenticated;
select cron.schedule('family-release-notifications','* * * * *','select public.check_family_release()');
