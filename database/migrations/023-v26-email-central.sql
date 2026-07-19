-- Barbearia do Ju — V26.0
-- Central de Comunicação: fila, histórico e RPC segura de cancelamento.

create table if not exists public.email_queue (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings(id) on delete set null,
  event_type text not null check (event_type in ('booking_confirmed','booking_rescheduled','booking_cancelled','test')),
  recipient_type text not null check (recipient_type in ('customer','barbershop','test')),
  recipient_email text not null,
  recipient_name text,
  subject text not null,
  html_content text not null,
  status text not null default 'pending' check (status in ('pending','sending','sent','failed')),
  attempts integer not null default 0,
  zoho_message_id text,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists email_queue_status_created_idx
  on public.email_queue(status, created_at);
create index if not exists email_queue_booking_idx
  on public.email_queue(booking_id, created_at desc);

alter table public.email_queue enable row level security;
revoke all on public.email_queue from anon;
grant select, update on public.email_queue to authenticated;

create policy "admin read email queue"
on public.email_queue for select to authenticated using (true);

create policy "admin update email queue"
on public.email_queue for update to authenticated using (true) with check (true);

create or replace function public.customer_cancel_booking_v25(
  p_booking_id uuid,
  p_management_token_hash text
)
returns setof public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_start_at timestamp;
begin
  select * into v_booking
  from public.bookings
  where id = p_booking_id
    and management_token_hash = p_management_token_hash
  for update;

  if not found then raise exception 'Agendamento não encontrado ou link inválido.'; end if;
  if v_booking.status not in ('pending','confirmed') then raise exception 'Este agendamento não pode mais ser cancelado.'; end if;

  v_start_at := v_booking.booking_date::timestamp + v_booking.start_time::time;
  if v_start_at <= timezone('America/Sao_Paulo', now()) then
    raise exception 'Não é possível cancelar um horário que já começou.';
  end if;

  update public.bookings
  set status='cancelled', customer_cancelled_at=now(), updated_at=now()
  where id=v_booking.id;

  insert into public.booking_customer_actions(booking_id,action,old_booking_date,old_start_time)
  values(v_booking.id,'cancelled',v_booking.booking_date,v_booking.start_time);

  return query select * from public.bookings where id=v_booking.id;
end;
$$;

revoke all on function public.customer_cancel_booking_v25(uuid,text) from public;
grant execute on function public.customer_cancel_booking_v25(uuid,text) to service_role;

notify pgrst, 'reload schema';
