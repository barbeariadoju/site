-- 092-v28.61.0 — Horário estendido pela JuIA no WhatsApp (caso Moisés/Vaz, 06/08/2026).
--
-- Cliente avisou "vou chegar 18:15" e a JuIA recusou friamente com lista de 16 horários,
-- porque o atendimento terminaria depois do fechamento (19h). Juliano: "eu fico depois do
-- horário sempre que precisar, preciso faturar". Decisão: a JuIA (SÓ canal WhatsApp, com
-- telefone verificado) pode aceitar atendimento que TERMINA até 60 min depois do
-- fechamento (20h ter-sex / 16h sáb), sempre avisando o Juliano por push. O site público
-- continua estrito (extensão = 0). Conflito com outro agendamento e bloqueio de agenda
-- continuam proibidos SEMPRE.
--
-- GOTCHA (migration 041): adicionar parâmetro cria SOBRECARGA — DROP da assinatura antiga
-- antes de recriar. DROP perde os GRANTs: recolocados explicitamente no final (e a
-- migration 088 ensinou: revoke de PUBLIC também, senão o default de EXECUTE pra PUBLIC
-- volta na função recém-criada).

-- ============================================================
-- 1) create_public_booking_v15 + p_extend_close_minutes (default 0, teto 120)
-- ============================================================
drop function if exists public.create_public_booking_v15(text, text, text, text, numeric, integer, date, time without time zone, text, jsonb);

create function public.create_public_booking_v15(
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_service_name text,
  p_service_price numeric,
  p_duration_minutes integer,
  p_booking_date date,
  p_start_time time without time zone,
  p_notes text default null,
  p_selected_products jsonb default '[]'::jsonb,
  p_extend_close_minutes integer default 0
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id uuid;
  v_end time;
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

  v_close := case when extract(dow from p_booking_date) = 6 then '15:00'::time else '19:00'::time end
             + make_interval(mins => least(greatest(coalesce(p_extend_close_minutes, 0), 0), 120));
  v_end := p_start_time + make_interval(mins => p_duration_minutes);
  if p_start_time < '08:00'::time or v_end > v_close then raise exception 'Horário fora do atendimento.'; end if;

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

revoke all on function public.create_public_booking_v15(text, text, text, text, numeric, integer, date, time without time zone, text, jsonb, integer) from public;
revoke all on function public.create_public_booking_v15(text, text, text, text, numeric, integer, date, time without time zone, text, jsonb, integer) from anon;
revoke all on function public.create_public_booking_v15(text, text, text, text, numeric, integer, date, time without time zone, text, jsonb, integer) from authenticated;
grant execute on function public.create_public_booking_v15(text, text, text, text, numeric, integer, date, time without time zone, text, jsonb, integer) to service_role;

-- ============================================================
-- 2) phone_reschedule_booking + p_extend_close_minutes (inclui o confirmed_at da 090)
-- ============================================================
drop function if exists public.phone_reschedule_booking(text, uuid, date, time without time zone);

create function public.phone_reschedule_booking(
  p_phone text,
  p_booking_id uuid,
  p_new_booking_date date,
  p_new_start_time time without time zone,
  p_extend_close_minutes integer default 0
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

  v_close := (case when extract(dow from p_new_booking_date)=6 then '15:00'::time else '19:00'::time end)
             + make_interval(mins => least(greatest(coalesce(p_extend_close_minutes, 0), 0), 120));
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
    -- migration 090: reagendar É confirmar presença no horário novo
    confirmed_at=now()
  where id=p_booking_id;

  return query select * from public.bookings where id = p_booking_id;
end;
$function$;

revoke all on function public.phone_reschedule_booking(text, uuid, date, time without time zone, integer) from public;
revoke all on function public.phone_reschedule_booking(text, uuid, date, time without time zone, integer) from anon;
revoke all on function public.phone_reschedule_booking(text, uuid, date, time without time zone, integer) from authenticated;
grant execute on function public.phone_reschedule_booking(text, uuid, date, time without time zone, integer) to service_role;

-- ============================================================
-- 3) extended_close_slot_ok — checagem barata pra JuIA OFERECER o horário estendido
--    antes de tentar criar (mesmas regras, sem inserir nada).
-- ============================================================
create or replace function public.extended_close_slot_ok(
  p_date date,
  p_start_time time without time zone,
  p_duration_minutes integer,
  p_extend_minutes integer default 60
)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_end time;
  v_close time;
  v_now_sp timestamp := timezone('America/Sao_Paulo', now());
begin
  if p_duration_minutes is null or p_duration_minutes <= 0 then return false; end if;
  if p_date < v_now_sp::date then return false; end if;
  if (p_date + p_start_time) < v_now_sp + interval '15 minutes' then return false; end if;
  if extract(dow from p_date) in (0,1) then return false; end if;

  v_close := (case when extract(dow from p_date)=6 then '15:00'::time else '19:00'::time end)
             + make_interval(mins => least(greatest(coalesce(p_extend_minutes, 0), 0), 120));
  v_end := p_start_time + make_interval(mins => p_duration_minutes);
  if p_start_time < '08:00'::time or v_end > v_close then return false; end if;

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

revoke all on function public.extended_close_slot_ok(date, time without time zone, integer, integer) from public;
revoke all on function public.extended_close_slot_ok(date, time without time zone, integer, integer) from anon;
revoke all on function public.extended_close_slot_ok(date, time without time zone, integer, integer) from authenticated;
grant execute on function public.extended_close_slot_ok(date, time without time zone, integer, integer) to service_role;
