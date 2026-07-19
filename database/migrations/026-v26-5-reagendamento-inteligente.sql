-- V26.5 - Reagendamento inteligente após cancelamento administrativo
alter table public.bookings
  add column if not exists rebooking_token_hash text,
  add column if not exists rebooking_expires_at timestamptz,
  add column if not exists rebooked_from_booking_id uuid references public.bookings(id) on delete set null,
  add column if not exists rebooked_to_booking_id uuid references public.bookings(id) on delete set null;

create index if not exists idx_bookings_rebooked_from on public.bookings(rebooked_from_booking_id);
create index if not exists idx_bookings_rebooking_expiry on public.bookings(rebooking_expires_at) where rebooking_token_hash is not null;

grant select, insert, update on table public.bookings to service_role;
grant insert on table public.booking_customer_actions to service_role;
