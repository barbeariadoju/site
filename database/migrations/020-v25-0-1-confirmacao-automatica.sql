-- Barbearia do Ju — V25.0.1
-- Confirma automaticamente os agendamentos criados pelo site e pela JuIA.
-- Mantém todas as validações e a prevenção de conflito da migration 016.

create or replace function public.create_public_booking(
  p_customer_name text,
  p_customer_phone text,
  p_service_name text,
  p_service_price numeric,
  p_duration_minutes integer,
  p_booking_date date,
  p_start_time time,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_end time;
  v_close time;
  v_now_sp timestamp := timezone('America/Sao_Paulo', now());
  v_booking_start timestamp;
begin
  if p_duration_minutes is null or p_duration_minutes <= 0 then
    raise exception 'Duração do serviço inválida.';
  end if;

  v_booking_start := p_booking_date + p_start_time;
  if p_booking_date < v_now_sp::date then raise exception 'A data escolhida já passou.'; end if;
  if v_booking_start < v_now_sp + interval '15 minutes' then
    raise exception 'Para agendamentos no mesmo dia, escolha um horário com pelo menos 15 minutos de antecedência.';
  end if;
  if extract(dow from p_booking_date) in (0, 1) then raise exception 'A barbearia não abre neste dia.'; end if;

  v_close := case when extract(dow from p_booking_date) = 6 then '15:00'::time else '19:00'::time end;
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

  insert into public.bookings (
    customer_name, customer_phone, service_name, service_price,
    duration_minutes, booking_date, start_time, notes, status
  ) values (
    trim(p_customer_name), regexp_replace(p_customer_phone, '\D', '', 'g'),
    p_service_name, p_service_price, p_duration_minutes, p_booking_date,
    p_start_time, nullif(trim(p_notes), ''), 'confirmed'
  ) returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.create_public_booking(
  text, text, text, numeric, integer, date, time, text
) to anon, authenticated, service_role;

create or replace function public.create_public_booking_v15(
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_service_name text,
  p_service_price numeric,
  p_duration_minutes integer,
  p_booking_date date,
  p_start_time time,
  p_notes text default null,
  p_selected_products jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
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

  v_close := case when extract(dow from p_booking_date) = 6 then '15:00'::time else '19:00'::time end;
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
$$;

grant execute on function public.create_public_booking_v15(
  text, text, text, text, numeric, integer, date, time, text, jsonb
) to anon, authenticated, service_role;
