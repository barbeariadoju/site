-- 091-v28.60.0 — Reativar agendamento cancelado (caso Kelvin, 06/08/2026).
--
-- Contexto: o cancelamento automático por falta de confirmação (whatsapp-booking-
-- confirmation, 1h antes) liberou o horário do Kelvin às 12:00 e ele confirmou às 12:01.
-- Não existia NENHUM caminho de volta: nem botão no admin, nem reativação automática
-- quando o cliente confirma logo depois. Duas funções novas:
--
-- 1) admin_reactivate_booking(p_booking_id) — botão "↩️ Reativar" no card de cancelado
--    do admin (Agenda/Atendimento). Auth: is_admin() por dentro (mesmo padrão das admin_*).
-- 2) phone_reactivate_recent_booking(p_phone) — usada pelo whatsapp-webhook quando o
--    cliente responde confirmando logo após um cancelamento automático. Só service_role.
--    Considera reativável: cancelado nas últimas 3h que tinha pedido de confirmação
--    pendente (confirmation_requested_at preenchido, confirmed_at nulo) e horário futuro.
--
-- As duas validam colisão de horário e bloqueio de agenda ANTES de reativar (o
-- admin-booking-status não valida conflito — por isso não foi reaproveitado: reativar
-- num horário que outro cliente ocupou nesse meio tempo criaria agendamento duplo).
-- Conflito → exception com texto 'horario_ocupado' (o chamador decide a mensagem).

create or replace function public.admin_reactivate_booking(p_booking_id uuid)
returns setof bookings
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_booking public.bookings%rowtype;
  v_end time;
  v_now_sp timestamp := timezone('America/Sao_Paulo', now());
begin
  if not public.is_admin() then
    raise exception 'Acesso restrito ao administrador.';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'Agendamento não encontrado.'; end if;
  if v_booking.status <> 'cancelled' then raise exception 'Só agendamento cancelado pode ser reativado.'; end if;
  if (v_booking.booking_date + v_booking.start_time) <= v_now_sp then
    raise exception 'Esse horário já passou — crie um novo agendamento.';
  end if;

  v_end := v_booking.start_time + make_interval(mins => v_booking.duration_minutes);

  if exists (
    select 1 from public.schedule_blocks s
    where s.block_date = v_booking.booking_date
      and (s.all_day or (v_booking.start_time < s.end_time and v_end > s.start_time))
  ) then raise exception 'horario_ocupado'; end if;

  if exists (
    select 1 from public.bookings b
    where b.id <> p_booking_id
      and b.booking_date = v_booking.booking_date
      and b.status in ('pending','confirmed')
      and v_booking.start_time < b.end_time and v_end > b.start_time
  ) then raise exception 'horario_ocupado'; end if;

  update public.bookings set
    status = 'confirmed',
    confirmed_at = now(),
    customer_cancelled_at = null,
    updated_at = now()
  where id = p_booking_id;

  return query select * from public.bookings where id = p_booking_id;
end;
$function$;

revoke all on function public.admin_reactivate_booking(uuid) from public;
revoke all on function public.admin_reactivate_booking(uuid) from anon;
grant execute on function public.admin_reactivate_booking(uuid) to authenticated, service_role;

create or replace function public.phone_reactivate_recent_booking(p_phone text)
returns setof bookings
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_booking public.bookings%rowtype;
  v_end time;
  v_now_sp timestamp := timezone('America/Sao_Paulo', now());
begin
  select * into v_booking
  from public.bookings b
  where b.status = 'cancelled'
    and b.confirmation_requested_at is not null
    and b.confirmed_at is null
    and b.updated_at > now() - interval '3 hours'
    and public.phone_match_key(b.customer_phone) = public.phone_match_key(p_phone)
    and (b.booking_date + b.start_time) > v_now_sp
  order by b.updated_at desc
  limit 1
  for update;

  if not found then return; end if;

  v_end := v_booking.start_time + make_interval(mins => v_booking.duration_minutes);

  if exists (
    select 1 from public.schedule_blocks s
    where s.block_date = v_booking.booking_date
      and (s.all_day or (v_booking.start_time < s.end_time and v_end > s.start_time))
  ) then raise exception 'horario_ocupado'; end if;

  if exists (
    select 1 from public.bookings b
    where b.id <> v_booking.id
      and b.booking_date = v_booking.booking_date
      and b.status in ('pending','confirmed')
      and v_booking.start_time < b.end_time and v_end > b.start_time
  ) then raise exception 'horario_ocupado'; end if;

  update public.bookings set
    status = 'confirmed',
    confirmed_at = now(),
    customer_cancelled_at = null,
    updated_at = now()
  where id = v_booking.id;

  return query select * from public.bookings where id = v_booking.id;
end;
$function$;

revoke all on function public.phone_reactivate_recent_booking(text) from public;
revoke all on function public.phone_reactivate_recent_booking(text) from anon;
revoke all on function public.phone_reactivate_recent_booking(text) from authenticated;
grant execute on function public.phone_reactivate_recent_booking(text) to service_role;
