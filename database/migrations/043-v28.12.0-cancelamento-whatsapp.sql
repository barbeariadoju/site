-- 043-v28.12.0-cancelamento-whatsapp.sql
--
-- Hoje a JuIA so sabe CRIAR agendamento. Quando o cliente pedia pra cancelar
-- (ou avisava que ja tinha marcado em outro lugar), ela so dizia "vou
-- encaminhar pra equipe" mesmo ja tendo identificado o agendamento certo — e
-- as vezes nem isso, gerando confusao (ex.: tentava criar um agendamento novo
-- no MESMO horario que o cliente ja tinha, e o create_public_booking_v15
-- recusava com "esse horario ficou indisponivel", que nao faz sentido nenhum
-- pro cliente ver sobre o proprio horario dele).
--
-- Esta migration da à JuIA a capacidade de cancelar um agendamento sozinha,
-- mas SOMENTE quando o telefone de quem esta pedindo bate com o telefone do
-- agendamento (mesma regra de match usada em toda parte, via phone_match_key)
-- — e o codigo do ju-ia-site so usa isso quando o canal é o WhatsApp
-- (telefone verificado pelo proprio canal), nunca no chat do site.

create or replace function public.phone_upcoming_bookings(p_phone text)
returns table(id uuid, booking_date date, start_time time, service_name text, status text)
language sql
stable
security definer
set search_path to 'public'
as $$
  select b.id, b.booking_date, b.start_time, b.service_name, b.status
  from public.bookings b
  where b.status in ('pending','confirmed')
    and public.phone_match_key(b.customer_phone) = public.phone_match_key(p_phone)
    and (
      b.booking_date > (timezone('America/Sao_Paulo', now()))::date
      or (b.booking_date = (timezone('America/Sao_Paulo', now()))::date
          and b.start_time > (timezone('America/Sao_Paulo', now()))::time)
    )
  order by b.booking_date, b.start_time
$$;

create or replace function public.whatsapp_cancel_booking(p_phone text, p_booking_id uuid)
returns setof bookings
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_booking public.bookings%rowtype;
  v_start_at timestamp;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'Agendamento não encontrado.'; end if;
  if public.phone_match_key(v_booking.customer_phone) <> public.phone_match_key(p_phone) then
    raise exception 'Este agendamento não pertence a este telefone.';
  end if;
  if v_booking.status not in ('pending','confirmed') then
    raise exception 'Este agendamento não pode mais ser cancelado.';
  end if;

  v_start_at := v_booking.booking_date::timestamp + v_booking.start_time::time;
  if v_start_at <= timezone('America/Sao_Paulo', now()) then
    raise exception 'Não é possível cancelar um horário que já começou.';
  end if;

  update public.bookings
    set status = 'cancelled', customer_cancelled_at = now(), updated_at = now()
  where id = v_booking.id;

  insert into public.booking_customer_actions(booking_id, action, old_booking_date, old_start_time)
  values (v_booking.id, 'cancelled', v_booking.booking_date, v_booking.start_time);

  return query select * from public.bookings where id = v_booking.id;
end;
$function$;
