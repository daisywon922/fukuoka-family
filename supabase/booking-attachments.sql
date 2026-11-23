-- 배포 전 한 번 적용. 비공개 버킷; 가족 초대 인증이 있는 기기만 접근합니다.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('booking-attachments','booking-attachments',false,10485760,array['image/jpeg','image/png','image/heic','image/heif','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create table if not exists public.booking_attachments (
 id uuid primary key,
 family_id uuid not null references public.family_trip(owner_id) on delete cascade,
 booking_id text not null check(booking_id in ('hotel','air','tour','insurance','cruise','drive') or booking_id ~ '^event_[A-Za-z0-9_-]{1,100}$'),
 uploader_id uuid not null references auth.users(id),
 profile_id text not null check(profile_id in ('member-1','member-2','member-3')),
 author_name text not null check(length(author_name) between 1 and 12),
 title text check(title is null or length(trim(title)) between 1 and 100),
 filename text not null check(length(filename) between 1 and 255),
 path text not null unique,
 size bigint not null check(size between 1 and 10485760),
 mime_type text not null check(mime_type in ('image/jpeg','image/png','image/heic','image/heif','application/pdf')),
 created_at timestamptz not null default now(),
 check(path=family_id::text||'/'||booking_id||'/'||id::text)
);
alter table public.booking_attachments enable row level security;
revoke all on public.booking_attachments from anon,authenticated;
grant select,insert,delete on public.booking_attachments to authenticated;
grant update(title) on public.booking_attachments to authenticated;
create policy attachment_read on public.booking_attachments for select to authenticated using(family_id=public.current_family());
create policy attachment_add on public.booking_attachments for insert to authenticated with check(family_id=public.current_family() and uploader_id=auth.uid());
create policy attachment_delete on public.booking_attachments for delete to authenticated using(family_id=public.current_family() and (uploader_id=auth.uid() or family_id=auth.uid()));
create policy attachment_rename on public.booking_attachments for update to authenticated using(family_id=public.current_family() and (uploader_id=auth.uid() or family_id=auth.uid())) with check(family_id=public.current_family() and (uploader_id=auth.uid() or family_id=auth.uid()));
-- 동시 업로드해도 예약당 5개 제한을 유지합니다.
create or replace function public.check_booking_attachment_limit() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.booking_id not like 'event_%' and new.booking_id<>'drive' and not exists(select 1 from public.family_trip where owner_id=new.family_id and data->'bookingOverrides' ? new.booking_id and not (coalesce(data->'deletedBookingIds','[]'::jsonb) ? new.booking_id)) then raise exception 'Booking no longer available'; end if;
 if new.booking_id like 'event_%' and not exists(select 1 from public.family_trip where owner_id=new.family_id and data->'eventOverrides' ? substring(new.booking_id from 7) and not (coalesce(data->'deletedEventIds','[]'::jsonb) ? substring(new.booking_id from 7))) then raise exception 'Schedule no longer available'; end if;
 perform pg_advisory_xact_lock(hashtextextended(new.family_id::text||'/'||new.booking_id,0));
 if new.booking_id<>'drive' and (select count(*) from public.booking_attachments where family_id=new.family_id and booking_id=new.booking_id)>=5 then raise exception 'Maximum 5 attachments'; end if;
 if not exists(select 1 from storage.objects where bucket_id='booking-attachments' and name=new.path and owner_id=auth.uid()::text) then raise exception 'Missing uploaded file'; end if;
 if new.booking_id like 'event_%' and new.mime_type not like 'image/%' then raise exception 'Photos only'; end if;
 if new.booking_id='drive' and (new.title is null or length(trim(new.title))=0) then raise exception 'Title required'; end if;
 return new;
end $$;
revoke all on function public.check_booking_attachment_limit() from public;
create trigger check_booking_attachment_limit before insert on public.booking_attachments for each row execute function public.check_booking_attachment_limit();
create policy booking_file_read on storage.objects for select to authenticated using(bucket_id='booking-attachments' and (storage.foldername(name))[1]=public.current_family()::text);
create policy booking_file_add on storage.objects for insert to authenticated with check(bucket_id='booking-attachments' and (storage.foldername(name))[1]=public.current_family()::text and ((storage.foldername(name))[2] in ('hotel','air','tour','insurance','cruise','drive') or (storage.foldername(name))[2] ~ '^event_[A-Za-z0-9_-]{1,100}$'));
create policy booking_file_delete on storage.objects for delete to authenticated using(bucket_id='booking-attachments' and (storage.foldername(name))[1]=public.current_family()::text and (owner_id=auth.uid()::text or (storage.foldername(name))[1]=auth.uid()::text));
do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='booking_attachments') then alter publication supabase_realtime add table public.booking_attachments; end if;
end $$;
commit;
