-- v29.203.0 (17/09/2026) — Backup semanal do banco (pedido do Juliano, "monta o backup sim").
--
-- O plano Free do Supabase não tem backup automático. A function backup-weekly (cron abaixo,
-- domingo 04h00 de Brasília = 07h00 UTC) despeja todas as tabelas do schema public em JSON gzip,
-- guarda no bucket privado `backups` (12 últimas semanas) e manda em anexo pro e-mail do Juliano.
--
-- 1) backup_list_tables(): lista as tabelas do public — SECURITY DEFINER, só service_role executa.
-- 2) bucket `backups` privado (nenhuma policy de storage: só service_role lê/escreve).
-- 3) cron bdj-backup-weekly.

create or replace function public.backup_list_tables()
returns table(table_name text) language sql stable security definer set search_path = public as $$
  select c.relname::text
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
  order by 1
$$;
revoke all on function public.backup_list_tables() from public, anon, authenticated;
grant execute on function public.backup_list_tables() to service_role;

insert into storage.buckets (id, name, public) values ('backups', 'backups', false) on conflict (id) do nothing;

select cron.unschedule(jobid) from cron.job where jobname = 'bdj-backup-weekly';
select cron.schedule(
  'bdj-backup-weekly',
  '0 7 * * 0',
  $cron$
  select net.http_post(
    url := 'https://rpkqluaxhqsxnewunhfm.supabase.co/functions/v1/backup-weekly',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-webhook-secret',(select decrypted_secret from vault.decrypted_secrets where name='whatsapp_webhook_secret' limit 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $cron$
);
