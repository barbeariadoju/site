-- Barbearia do Ju — V26.4
-- Base do lembrete automático de agendamento 24 horas antes.

-- Amplia os tipos aceitos na fila de e-mails.
alter table public.email_queue drop constraint if exists email_queue_event_type_check;
alter table public.email_queue add constraint email_queue_event_type_check
  check (event_type in ('booking_confirmed','booking_rescheduled','booking_cancelled','booking_reminder_24h','review_request','birthday','inactive_30','inactive_45','inactive_60','campaign','test'));

-- Impede lembrete duplicado para o mesmo agendamento e destinatário.
create unique index if not exists email_queue_one_reminder_per_booking_idx
  on public.email_queue (booking_id, event_type, recipient_type)
  where event_type = 'booking_reminder_24h' and recipient_type = 'customer';

-- Permissões necessárias às Edge Functions internas.
grant select, update on table public.bookings to service_role;
grant select, insert, update on table public.email_queue to service_role;

notify pgrst, 'reload schema';
