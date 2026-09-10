-- v29.167.0 — Regra de horários repensada com o Juliano (10/09/2026, 12h50), substitui a 148.
--
-- 1. O FIM de cada atendimento (e de cada bloqueio) do dia é SEMPRE um horário oferecido,
--    junto com a grade de 15 em 15. Caso Paulo Spina (12:29): o último corte termina 18:05
--    e a grade só conhecia 18:00 (ocupado) e 18:15 (passava das 19h) — "não tenho nada
--    hoje" com 55 minutos de cadeira vazia. A 148 só oferecia o fim quando a grade seguinte
--    não cabia; o Juliano preferiu o fim sempre ("imediatamente após o término, e depois
--    de 15 em 15 nos horários com mais vacância").
-- 2. Tolerância de fechamento vale pra TODO MUNDO, site inclusive: início até o fechamento
--    (19:00 ter-sex, 15:00 sáb) e término até 60 min depois (20:00 / 16:00). Até hoje essa
--    tolerância existia só no WhatsApp, como exceção (extended_close_slot_ok, decisão de
--    06/08); o Juliano pediu hoje que o site ofereça também — "posso passar um pouco das
--    19h; até um agendamento às 19h é possível se for só um corte".
--
-- Fonte única do fechamento: closing_rule(date) → (nominal_close, latest_end). Usada pela
-- oferta (get_available_slots*), pela reserva do site e da JuIA (create_public_booking_v15),
-- pelo reagendamento (phone_reschedule_booking) e pela checagem de exceção
-- (extended_close_slot_ok, que agora só estica ALÉM da tolerância, até +120 no total).

create or replace function public.closing_rule(p_date date, out nominal_close time without time zone, out latest_end time without time zone)
language sql
immutable
as $function$
  select
    (case when extract(dow from p_date) = 6 then time '15:00' else time '19:00' end),
    (case when extract(dow from p_date) = 6 then time '16:00' else time '20:00' end);
$function$;

create or replace function public.get_available_slots_excluding(p_date date, p_duration_minutes integer, p_exclude_booking_id uuid)
returns table(slot_time time without time zone)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_now_sp timestamp := timezone('America/Sao_Paulo', now());
  v_today date := v_now_sp::date;
  v_min_start time := (v_now_sp + interval '15 minutes')::time;
  v_close time;
  v_latest time;
  v_dur interval;
  v_grid_span integer;
begin
  if p_duration_minutes is null or p_duration_minutes <= 0 then
    raise exception 'Duração do serviço inválida.';
  end if;
  if p_date < v_today then return; end if;
  if extract(dow from p_date) in (0, 1) then return; end if;
  if exists (select 1 from public.schedule_blocks b where b.block_date = p_date and b.all_day) then return; end if;

  select nominal_close, latest_end into v_close, v_latest from public.closing_rule(p_date);
  v_dur := make_interval(mins => p_duration_minutes);
  v_grid_span := (extract(epoch from (v_close - time '08:00')) / 60)::integer; -- 08:00 até o fechamento, inclusive

  return query
  with grade as (
    select (time '08:00' + make_interval(mins => g))::time as s
    from generate_series(0, v_grid_span, 15) g
  ),
  fins as (
    select b.end_time as s
    from public.bookings b
    where b.booking_date = p_date
      and b.status in ('pending', 'confirmed')
      and (p_exclude_booking_id is null or b.id <> p_exclude_booking_id)
    union
    select bl.end_time
    from public.schedule_blocks bl
    where bl.block_date = p_date and not bl.all_day and bl.end_time is not null
  ),
  candidatos as (
    select s from grade
    union
    select s from fins
  )
  select c.s
  from candidatos c
  where c.s >= time '08:00'
    and c.s <= v_close
    and c.s + v_dur <= v_latest
    and (p_date > v_today or c.s >= v_min_start)
    and not exists (
      select 1 from public.schedule_blocks bl
      where bl.block_date = p_date
        and (bl.all_day or (c.s < bl.end_time and c.s + v_dur > bl.start_time))
    )
    and not exists (
      select 1 from public.bookings b
      where b.booking_date = p_date
        and b.status in ('pending', 'confirmed')
        and (p_exclude_booking_id is null or b.id <> p_exclude_booking_id)
        and c.s < b.end_time and c.s + v_dur > b.start_time
    )
  order by c.s;
end;
$function$;

create or replace function public.get_available_slots(p_date date, p_duration_minutes integer)
returns table(slot_time time without time zone)
language sql
security definer
set search_path to 'public'
as $function$
  select slot_time from public.get_available_slots_excluding(p_date, p_duration_minutes, null);
$function$;

-- Reserva (site e JuIA). p_extend_close_minutes continua significando "além do fechamento
-- nominal" (teto 120): a tolerância de 60 já está dentro; acima disso é exceção do Juliano.
create or replace function public.create_public_booking_v15(p_customer_name text, p_customer_phone text, p_customer_email text, p_service_name text, p_service_price numeric, p_duration_minutes integer, p_booking_date date, p_start_time time without time zone, p_notes text DEFAULT NULL::text, p_selected_products jsonb DEFAULT '[]'::jsonb, p_extend_close_minutes integer DEFAULT 0)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id uuid;
  v_end time;
  v_nominal time;
  v_close time;
  v_products_price numeric;
  v_now_sp timestamp := timezone('America/Sao_Paulo', now());
  v_booking_start timestamp;
begin
  if p_duration_minutes is null or p_duration_minutes <= 0 then raise exception 'Duração do serviço inválida.'; end if;

  v_booking_start := p_booking_date + p_start_time;
  if p_booking_date < v_now_sp::date then raise exception 'A data escolhida já passou.'; end if;
  if v_booking_start < v_now_sp + interval '15 minutes' then
    raise exception 'Para agendamentos no mesmo dia, escolha um horário com pelo menos 15 minutos de antecedência.';
  end if;
  if extract(dow from p_booking_date) in (0, 1) then raise exception 'A barbearia não abre neste dia.'; end if;

  select nominal_close, latest_end into v_nominal, v_close from public.closing_rule(p_booking_date);
  v_close := v_close + make_interval(mins => least(greatest(coalesce(p_extend_close_minutes, 0) - 60, 0), 60));
  v_end := p_start_time + make_interval(mins => p_duration_minutes);
  if p_start_time < '08:00'::time or p_start_time > v_nominal or v_end > v_close then raise exception 'Horário fora do atendimento.'; end if;

  if exists (
    select 1 from public.schedule_blocks s
    where s.block_date = p_booking_date
      and (s.all_day or (p_start_time < s.end_time and v_end > s.start_time))
  ) then raise exception 'Este horário está bloqueado. Escolha outro.'; end if;

  if exists (
    select 1 from public.bookings b
    where b.booking_date = p_booking_date
      and b.status in ('pending', 'confirmed')
      and p_start_time < b.end_time and v_end > b.start_time
  ) then raise exception 'Este horário ficou indisponível. Escolha outro.'; end if;

  select coalesce(sum((x ->> 'price')::numeric), 0)
    into v_products_price
    from jsonb_array_elements(coalesce(p_selected_products, '[]'::jsonb)) x;

  insert into public.bookings (
    customer_name, customer_phone, customer_email, service_name,
    service_price, duration_minutes, booking_date, start_time, notes,
    selected_products, products_price, status
  ) values (
    trim(p_customer_name), regexp_replace(p_customer_phone, '\D', '', 'g'),
    nullif(lower(trim(p_customer_email)), ''), p_service_name,
    p_service_price, p_duration_minutes, p_booking_date, p_start_time,
    nullif(trim(p_notes), ''), coalesce(p_selected_products, '[]'::jsonb),
    v_products_price, 'confirmed'
  ) returning id into v_id;

  return v_id;
end;
$function$;

create or replace function public.phone_reschedule_booking(p_phone text, p_booking_id uuid, p_new_booking_date date, p_new_start_time time without time zone, p_extend_close_minutes integer DEFAULT 0)
returns setof bookings
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_booking public.bookings%rowtype;
  v_end time;
  v_nominal time;
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

  select nominal_close, latest_end into v_nominal, v_close from public.closing_rule(p_new_booking_date);
  v_close := v_close + make_interval(mins => least(greatest(coalesce(p_extend_close_minutes, 0) - 60, 0), 60));
  v_end := p_new_start_time + make_interval(mins => v_booking.duration_minutes);
  if p_new_start_time < '08:00'::time or p_new_start_time > v_nominal or v_end > v_close then raise exception 'Horário fora do atendimento.'; end if;

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
    confirmed_at=now()
  where id=p_booking_id;

  return query select * from public.bookings where id = p_booking_id;
end;
$function$;

create or replace function public.extended_close_slot_ok(p_date date, p_start_time time without time zone, p_duration_minutes integer, p_extend_minutes integer DEFAULT 60)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_end time;
  v_nominal time;
  v_close time;
  v_now_sp timestamp := timezone('America/Sao_Paulo', now());
begin
  if p_duration_minutes is null or p_duration_minutes <= 0 then return false; end if;
  if p_date < v_now_sp::date then return false; end if;
  if (p_date + p_start_time) < v_now_sp + interval '15 minutes' then return false; end if;
  if extract(dow from p_date) in (0,1) then return false; end if;

  select nominal_close, latest_end into v_nominal, v_close from public.closing_rule(p_date);
  v_close := v_close + make_interval(mins => least(greatest(coalesce(p_extend_minutes, 0) - 60, 0), 60));
  v_end := p_start_time + make_interval(mins => p_duration_minutes);
  if p_start_time < '08:00'::time or p_start_time > v_nominal or v_end > v_close then return false; end if;

  if exists (
    select 1 from public.schedule_blocks s
    where s.block_date=p_date
      and (s.all_day or (p_start_time<s.end_time and v_end>s.start_time))
  ) then return false; end if;

  if exists (
    select 1 from public.bookings b
    where b.booking_date=p_date
      and b.status in ('pending','confirmed')
      and p_start_time<b.end_time and v_end>b.start_time
  ) then return false; end if;

  return true;
end;
$function$;
