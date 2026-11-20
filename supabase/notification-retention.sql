-- Daily at 18:00 UTC (03:00 Korea/Japan). Only notification history is removed.
create extension if not exists pg_cron;
select cron.schedule('family-notice-retention-90-days','0 18 * * *',
 $$delete from public.family_notices where created_at < now() - interval '90 days'$$);
