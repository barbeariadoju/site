-- v29.207.0 (19/09/2026) — Aviso de chegada fura o silêncio da manhã (regra do Juliano).
-- O Luiz, marcado às 8h00 de hoje, deveria ter recebido a rota às 7h30 e não recebeu, porque
-- o cron obedecia ao juia_quiet_now() (silêncio até 8h). Agora o cron roda das 7h às 20h
-- (relógio de Brasília) sem olhar o silêncio da JuIA; a function tem a mesma guarda
-- (horaPermitida em _shared/aviso-chegada.ts). Só este aviso ganhou a exceção: marketing,
-- lembrete de 24h, aniversário e reativação seguem presos ao juia_quiet_now().

select cron.unschedule('bdj-arrival-route') where exists (select 1 from cron.job where jobname = 'bdj-arrival-route');
select cron.schedule('bdj-arrival-route', '*/5 * * * *', $cron$
  select case when extract(hour from (now() at time zone 'America/Sao_Paulo')) between 7 and 19 then (net.http_post(
    url := 'https://rpkqluaxhqsxnewunhfm.supabase.co/functions/v1/whatsapp-arrival-route',
    headers := jsonb_build_object('Content-Type','application/json',
      'x-webhook-secret',(select decrypted_secret from vault.decrypted_secrets where name='whatsapp_webhook_secret' limit 1)),
    body := '{}'::jsonb
  )) end;
$cron$);
