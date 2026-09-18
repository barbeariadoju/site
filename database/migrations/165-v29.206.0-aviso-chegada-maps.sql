-- v29.206.0 (18/09/2026) — Aviso de chegada com a rota do Google Maps ~30 min antes do horário
-- (dica do cliente Rafael, repassada pelo Juliano no plano do dia).
--
-- 1) bookings.arrival_route_sent_at: marca de envio (um aviso por agendamento).
-- 2) cron bdj-arrival-route a cada 5 min, só fora do silêncio da JuIA (juia_quiet_now()).
--    Horário das 8h00 fica sem aviso (7h30 é silêncio) — decisão consciente, a exceção das
--    20h continua sendo só do comprovante.

alter table public.bookings add column if not exists arrival_route_sent_at timestamptz;

select cron.unschedule('bdj-arrival-route') where exists (select 1 from cron.job where jobname = 'bdj-arrival-route');
select cron.schedule('bdj-arrival-route', '*/5 * * * *', $cron$
  select case when not public.juia_quiet_now() then (net.http_post(
    url := 'https://rpkqluaxhqsxnewunhfm.supabase.co/functions/v1/whatsapp-arrival-route',
    headers := jsonb_build_object('Content-Type','application/json',
      'x-webhook-secret',(select decrypted_secret from vault.decrypted_secrets where name='whatsapp_webhook_secret' limit 1)),
    body := '{}'::jsonb
  )) end;
$cron$);
