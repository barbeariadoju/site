-- v29.239.0 — lista de espera de quem JÁ TEM horário no dia (caso Sérgio, 25-26/09/2026).
--
-- Agendado às 09:45, ele pediu "caso tenha algum horário desmarcado para mais cedo, pode me avisar".
-- Entrou na lista do dia sem teto de hora. Na manhã seguinte o Guilherme remarcou das 11:30 para as
-- 14:30, o gatilho ofereceu as 11:30 ao Sérgio como "o horário que você estava esperando" e, se ele
-- respondesse "sim", phone_confirm_waitlist_booking criaria um SEGUNDO agendamento (09:45 e 11:30).
--
-- Duas travas, independentes da JuIA:
-- 1. waitlist_matches_for_slot: quem tem horário ativo no dia só casa com vaga que começa ANTES dele.
-- 2. phone_confirm_waitlist_booking: com horário ativo no mesmo dia, o "sim" MOVE esse horário
--    (phone_reschedule_booking, com todas as validações de sempre) em vez de criar outro.
-- Sem tabela nova: nenhum GRANT novo; as permissões das duas funções continuam as mesmas.

create or replace function public.waitlist_matches_for_slot(p_date date, p_start_time time without time zone)
 returns setof waitlist
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select w.*
  from public.waitlist w
  where w.status = 'esperando'
    and (
      w.preferred_date = p_date
      or (array_length(w.preferred_weekdays, 1) is not null
          and extract(dow from p_date)::int = any(w.preferred_weekdays))
      or (w.preferred_date is null and coalesce(array_length(w.preferred_weekdays,1),0) = 0)
    )
    and (w.window_start is null or p_date >= w.window_start)
    and (w.window_end is null or p_date <= w.window_end)
    and (
      case
        when w.preferred_time_start is not null and w.preferred_time_end is not null
          then p_start_time >= w.preferred_time_start and p_start_time < w.preferred_time_end
        when w.preferred_period = 'manha' then p_start_time < time '12:00'
        when w.preferred_period = 'tarde' then p_start_time >= time '12:00'
        else true
      end
    )
    -- v29.239.0: já tem horário no dia → só vaga que começa antes do primeiro horário dele.
    and not exists (
      select 1 from public.bookings b
      where public.phone_match_key(b.customer_phone) = public.phone_match_key(w.customer_phone)
        and b.booking_date = p_date
        and b.status in ('pending','confirmed')
        and b.start_time <= p_start_time
    )
  order by w.created_at asc
$function$;

create or replace function public.phone_confirm_waitlist_booking(p_phone text, p_waitlist_id uuid)
 returns setof bookings
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_wl public.waitlist%rowtype;
  v_booking_id uuid;
  v_existing uuid;
begin
  select * into v_wl from public.waitlist where id = p_waitlist_id for update;
  if not found then raise exception 'Pedido de lista de espera não encontrado.'; end if;
  if public.phone_match_key(v_wl.customer_phone) <> public.phone_match_key(p_phone) then
    raise exception 'Este pedido de lista de espera não pertence a este telefone.';
  end if;
  if v_wl.status <> 'avisado' or v_wl.offered_date is null or v_wl.offered_start_time is null then
    raise exception 'Não há vaga oferecida pendente de confirmação pra este pedido.';
  end if;

  -- v29.239.0 (caso Sérgio): já tem horário ativo no mesmo dia → passa esse horário pra vaga
  -- oferecida, nunca cria um segundo.
  select b.id into v_existing
  from public.bookings b
  where public.phone_match_key(b.customer_phone) = public.phone_match_key(v_wl.customer_phone)
    and b.booking_date = v_wl.offered_date
    and b.status in ('pending','confirmed')
  order by b.start_time
  limit 1;

  if v_existing is not null then
    select r.id into v_booking_id
    from public.phone_reschedule_booking(p_phone, v_existing, v_wl.offered_date, v_wl.offered_start_time) r
    limit 1;
  else
    v_booking_id := public.create_public_booking_v15(
      p_customer_name => v_wl.customer_name,
      p_customer_phone => v_wl.customer_phone,
      p_customer_email => v_wl.customer_email,
      p_service_name => coalesce(v_wl.service_name, 'Corte de cabelo'),
      p_service_price => coalesce(v_wl.service_price, 0),
      p_duration_minutes => coalesce(v_wl.duration_minutes, 30),
      p_booking_date => v_wl.offered_date,
      p_start_time => v_wl.offered_start_time,
      p_notes => 'Confirmado pela JuIA a partir da lista de espera'
    );
  end if;

  update public.waitlist
  set status = 'encaixado', booking_id = v_booking_id, scheduled_at = now(), updated_at = now()
  where id = v_wl.id;

  return query select * from public.bookings where id = v_booking_id;
end;
$function$;
