-- 1.7.0 저장소에 드라이브 분류·파일 교체를 추가합니다. 2026-11-24 적용 완료.
begin;
alter table public.booking_attachments add column if not exists category text not null default '기타' check(category in ('숙박','항공','관광','기타'));
-- 드라이브는 파일 교체 시 새 경로로 원자적으로 전환합니다.
do $$ declare existing text; begin
 select pg_get_constraintdef(oid) into existing from pg_constraint where conrelid='public.booking_attachments'::regclass and conname='booking_attachments_check';
 if existing is null or position('path' in existing)=0 then raise exception 'Check attachment path constraint before migrating'; end if;
 alter table public.booking_attachments drop constraint booking_attachments_check;
 alter table public.booking_attachments add constraint booking_attachments_check check(
 (booking_id<>'drive' and path=family_id::text||'/'||booking_id||'/'||id::text)
 or (booking_id='drive' and path ~ ('^'||family_id::text||'/drive/[a-f0-9-]{36}$')));
end $$;
grant update(title,category,path,filename,size,mime_type,uploader_id,profile_id,author_name) on public.booking_attachments to authenticated;
drop policy attachment_rename on public.booking_attachments;
create policy attachment_rename on public.booking_attachments for update to authenticated using(booking_id='drive' and family_id=public.current_family() and (uploader_id=auth.uid() or family_id=auth.uid())) with check(booking_id='drive' and family_id=public.current_family() and (uploader_id=auth.uid() or family_id=auth.uid()));
create trigger check_booking_attachment_update before update on public.booking_attachments for each row when(old.path is distinct from new.path) execute function public.check_booking_attachment_limit();
commit;
