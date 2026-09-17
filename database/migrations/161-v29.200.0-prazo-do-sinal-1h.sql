-- v29.200.0 (17/09/2026) — Prazo de 1 hora pro sinal de química; vencido, o horário é liberado.
--
-- Regra do Juliano (17/09, ~13h): "até 1h pra fazer o sinal, se não fizer libera o horário; isto só
-- pra serviços de química, que são mais caros e duradouros e ocupam muito tempo na agenda". Veio
-- depois do caso Teddy (luzes, pedido de sinal sem prazo, cancelado 25 min depois na mão).
--
-- 1) bookings.prepay_deadline_at: a JuIA grava agora + 1h ao pedir o sinal (química, 1ª visita).
-- 2) cron a cada 5 min chama a function prepay-deadline, que cancela o que venceu sem o cliente
--    ter declarado o Pix e sem o Juliano ter confirmado, avisa o cliente e o Juliano.

alter table public.bookings add column if not exists prepay_deadline_at timestamptz;
comment on column public.bookings.prepay_deadline_at is 'Prazo pro sinal por Pix cair (química, 1ª visita, v29.200.0). Vencido sem prepay_declared_at/prepay_confirmed_at, o cron prepay-deadline libera o horário.';
create index if not exists idx_bookings_prepay_deadline on public.bookings (prepay_deadline_at) where prepay_deadline_at is not null;

select cron.unschedule(jobid) from cron.job where jobname = 'bdj-prepay-deadline';
select cron.schedule(
  'bdj-prepay-deadline',
  '*/5 * * * *',
  $cron$
  select net.http_post(
    url := 'https://rpkqluaxhqsxnewunhfm.supabase.co/functions/v1/prepay-deadline',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-webhook-secret',(select decrypted_secret from vault.decrypted_secrets where name='whatsapp_webhook_secret' limit 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 25000
  );
  $cron$
);
