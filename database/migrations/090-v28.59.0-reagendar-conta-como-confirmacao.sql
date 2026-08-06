-- 090-v28.59.0 — Reagendar depois do pedido de confirmação CONTA como confirmação.
--
-- Bug latente encontrado em 06/08/2026 ao implementar o menu numérico de confirmação
-- (1 confirmo / 2 remarcar / 3 cancelar, sugestão do Juliano após o caso da Graziela):
-- phone_reschedule_booking não mexia em confirmed_at/confirmation_requested_at. Cliente
-- que recebia o pedido de confirmação e REMARCAVA (pela JuIA ou pelo novo "2") ficava com
-- confirmation_requested_at preenchido e confirmed_at nulo — e o cron
-- whatsapp-booking-confirmation (bookings_due_for_confirmation_deadline) cancelaria
-- automaticamente o horário RECÉM-REMARCADO 1h antes, por "falta de confirmação".
-- Quem acabou de escolher um horário novo obviamente confirmou presença nele.
--
-- Mesma assinatura da função existente — CREATE OR REPLACE substitui sem sobrecarga.

create or replace function public.phone_reschedule_booking(
  p_phone text,
  p_booking_id uuid,
  p_new_booking_date date,
  p_new_start_time time without time zone
)
returns setof bookings
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_booking public.bookings%rowtype;
  v_end time;
  v_close time;
  v_now_sp timestamp := timezone('America/Sao_Paulo', now());
  v_new_start timestamp;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'Agendamento não encontrado.'; end if;
  if public.phone_match_key(v_booking.customer_phone) <> public.phone_match_key(p_phone) then
    raise exception 'Este agendamento não pertence a este telefone.';
  end if;
  if v_booking.status not in ('pending','confirmed') then
    raise exception 'Este agendamento não pode mais ser reagendado.';
  end if;

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
    status='confirmed',
    -- Escolher ativamente um horário novo É a confirmação de presença nele: sem isto,
    -- o cron de confirmação cancelava o horário recém-remarcado por "falta de resposta".
    confirmed_at=now()
  where id=p_booking_id;

  return query select * from public.bookings where id = p_booking_id;
end;
$function$;
