-- EXECUTE SOMENTE APÓS substituir COLE_AQUI_O_EMAIL_WEBHOOK_SECRET pelo valor real.
-- Agenda a verificação a cada 15 minutos usando pg_cron + pg_net + Vault.
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

select vault.create_secret('COLE_AQUI_O_EMAIL_WEBHOOK_SECRET', 'bdj_email_webhook_secret')
where not exists (select 1 from vault.decrypted_secrets where name='bdj_email_webhook_secret');

select cron.unschedule(jobid) from cron.job where jobname='bdj-reminder-24h';
select cron.schedule(
  'bdj-reminder-24h',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://rpkqluaxhqsxnewunhfm.supabase.co/functions/v1/booking-reminder-24h',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-webhook-secret',(select decrypted_secret from vault.decrypted_secrets where name='bdj_email_webhook_secret' limit 1)
    ),
    body := '{}'::jsonb
  );
  $$
);
