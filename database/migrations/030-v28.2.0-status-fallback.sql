-- Barbearia do Ju — V28.2.0
-- Status real de entrega do SMS (DLR), alerta de saldo SMSDev e fallback cruzado SMS/e-mail.

alter table public.sms_queue
  add column if not exists delivery_status text not null default 'unknown'
    check (delivery_status in ('unknown','delivered','failed')),
  add column if not exists delivery_operator text,
  add column if not exists delivery_checked_at timestamptz;

create index if not exists sms_queue_delivery_pending_idx
  on public.sms_queue(status, delivery_status, sent_at)
  where status = 'sent' and delivery_status = 'unknown';

create table if not exists public.integration_alerts (
  id uuid primary key default gen_random_uuid(),
  alert_key text not null unique,
  last_value jsonb,
  last_checked_at timestamptz,
  last_alerted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.integration_alerts enable row level security;
revoke all on public.integration_alerts from anon;
grant select on public.integration_alerts to authenticated;
grant select, insert, update on public.integration_alerts to service_role;

create policy "admin read integration alerts"
on public.integration_alerts for select to authenticated using (true);

notify pgrst, 'reload schema';
