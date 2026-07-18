-- Barbearia do Ju — V25.1.0
-- Área segura "Meu Agendamento", cancelamento, reagendamento e histórico.

alter table public.bookings
  add column if not exists booking_code text,
  add column if not exists management_token_hash text,
  add column if not exists customer_cancelled_at timestamptz,
  add column if not exists rescheduled_at timestamptz,
  add column if not exists previous_booking_date date,
  add column if not exists previous_start_time time;

create unique index if not exists bookings_booking_code_uidx
  on public.bookings (booking_code)
  where booking_code is not null;

create table if not exists public.booking_customer_actions (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  action text not null check (action in ('created_link','viewed','cancelled','rescheduled')),
  old_booking_date date,
  old_start_time time,
  new_booking_date date,
  new_start_time time,
  created_at timestamptz not null default now()
);

create index if not exists booking_customer_actions_booking_idx
  on public.booking_customer_actions (booking_id, created_at desc);

alter table public.booking_customer_actions enable row level security;
grant select on public.booking_customer_actions to authenticated;

create policy "admin read customer booking actions"
on public.booking_customer_actions for select to authenticated using (true);

create or replace function public.customer_reschedule_booking_v25(
  p_booking_id uuid,
  p_new_booking_date date,
  p_new_start_time time
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
  v_end time;
  v_close time;
  v_now_sp timestamp := timezone('America/Sao_Paulo', now());
  v_new_start timestamp;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if v_booking.id is null then raise exception 'Agendamento não encontrado.'; end if;
  if v_booking.status not in ('pending','confirmed') then raise exception 'Este agendamento não pode mais ser reagendado.'; end if;

  v_new_start := p_new_booking_date + p_new_start_time;
  if p_new_booking_date < v_now_sp::date then raise exception 'A data escolhida já passou.'; end if;
  if v_new_start < v_now_sp + interval '15 minutes' then raise exception 'Escolha um horário com pelo menos 15 minutos de antecedência.'; end if;
  if extract(dow from p_new_booking_date) in (0,1) then raise exception 'A barbearia não abre neste dia.'; end if;

  v_close := case when extract(dow from p_new_booking_date)=6 then '15:00'::time else '19:00'::time end;
  v_end := p_new_start_time + make_interval(mins => v_booking.duration_minutes);
  if p_new_start_time < '08:00'::time or v_end > v_close then raise exception 'Horário fora do atendimento.'; end if;

  if exists (
    select 1 from public.schedule_blocks s
    where s.block_date=p_new_booking_date
      and (s.all_day or (p_new_start_time<s.end_time and v_end>s.start_time))
  ) then raise exception 'Este horário está bloqueado. Escolha outro.'; end if;

  if exists (
    select 1 from public.bookings b
    where b.id<>p_booking_id
      and b.booking_date=p_new_booking_date
      and b.status in ('pending','confirmed')
      and p_new_start_time<b.end_time and v_end>b.start_time
  ) then raise exception 'Este horário ficou indisponível. Escolha outro.'; end if;

  insert into public.booking_customer_actions(
    booking_id,action,old_booking_date,old_start_time,new_booking_date,new_start_time
  ) values (
    p_booking_id,'rescheduled',v_booking.booking_date,v_booking.start_time,p_new_booking_date,p_new_start_time
  );

  update public.bookings set
    previous_booking_date=booking_date,
    previous_start_time=start_time,
    booking_date=p_new_booking_date,
    start_time=p_new_start_time,
    rescheduled_at=now(),
    updated_at=now(),
    status='confirmed'
  where id=p_booking_id
  returning * into v_booking;

  return v_booking;
end;
$$;

revoke all on function public.customer_reschedule_booking_v25(uuid,date,time) from public;
grant execute on function public.customer_reschedule_booking_v25(uuid,date,time) to service_role;
