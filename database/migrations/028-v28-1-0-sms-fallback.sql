-- Barbearia do Ju — V28.1.0
-- Fallback de SMS (SMSDev) para clientes que não informaram e-mail.

create table if not exists public.sms_queue (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings(id) on delete set null,
  event_type text not null check (event_type in ('booking_confirmed','booking_rescheduled','booking_cancelled','booking_reminder_24h','test')),
  recipient_type text not null check (recipient_type in ('customer','test')),
  recipient_phone text not null,
  recipient_name text,
  message_text text not null,
  status text not null default 'pending' check (status in ('pending','sending','sent','failed')),
  attempts integer not null default 0,
  smsdev_message_id text,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sms_queue_status_created_idx
  on public.sms_queue(status, created_at);
create index if not exists sms_queue_booking_idx
  on public.sms_queue(booking_id, created_at desc);

-- Impede lembrete duplicado para o mesmo agendamento, no mesmo padrão do e-mail.
create unique index if not exists sms_queue_one_reminder_per_booking_idx
  on public.sms_queue (booking_id, event_type, recipient_type)
  where event_type = 'booking_reminder_24h' and recipient_type = 'customer';

alter table public.sms_queue enable row level security;
revoke all on public.sms_queue from anon;
grant select, update on public.sms_queue to authenticated;
grant select, insert, update on public.sms_queue to service_role;

create policy "admin read sms queue"
on public.sms_queue for select to authenticated using (true);

create policy "admin update sms queue"
on public.sms_queue for update to authenticated using (true) with check (true);

notify pgrst, 'reload schema';
