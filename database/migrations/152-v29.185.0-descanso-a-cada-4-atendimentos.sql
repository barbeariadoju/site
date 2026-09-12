-- v29.185.0 — Descanso obrigatório: a cada 4 atendimentos seguidos, 15 minutos livres
-- (pedido do Juliano, 12/09/2026, ~14h45, urgente).
--
-- Palavras dele: "hoje atendi todos os clientes seguidos e o resultado foi catastrófico, estou
-- com dor extrema nas costas e tive que furar com a Mayara que estava marcada agora pra 14:45".
--
-- Regra: dois atendimentos são "seguidos" quando o intervalo entre o fim de um e o começo do
-- outro é menor que 15 minutos. Uma sequência de seguidos tem no máximo 4; o quinto só entra se
-- começar pelo menos 15 minutos depois do fim do quarto. Bloqueio de agenda (schedule_blocks)
-- entre dois atendimentos conta como descanso — o que importa é o intervalo.
--
-- Onde a regra mora: public.descanso_ok(...). Quem usa:
--   - get_available_slots_excluding (e, por ela, get_available_slots): o horário que criaria o
--     5º seguido simplesmente não aparece — site, JuIA, "Horários que cabem" do painel, lista de
--     espera, convite de retorno e /reagendar/, todos de uma vez;
--   - create_public_booking_v15 (site, JuIA, lista de espera), phone_reschedule_booking (JuIA),
--     customer_reschedule_booking_v25 (/reagendar/) e extended_close_slot_ok (JuIA, horário
--     estendido): recusam com mensagem clara — contra corrida entre consulta e reserva;
--   - admin_create_booking e admin_reschedule_booking: recusam também, MENOS quando a caixa
--     "Permitir encaixe" (p_allow_overlap) está marcada — a exceção continua sendo decisão dele,
--     na hora, igual ao encaixe da v29.173.0.
-- Fica de fora phone_reactivate_recent_booking (reativa um horário que existia minutos antes).
-- Os números (4 e 15) são constantes em descanso_ok; mudar a regra é mudar ali.
--
-- A mensagem das funções públicas começa com "Este horário ficou indisponível" de propósito: é a
-- palavra que o site (agenda-v15.js) mostra ao cliente em vez do erro genérico, e a que faz a JuIA
-- consultar a agenda de novo e oferecer o horário mais próximo que cabe (v29.43.5). No banco isso
-- entrou em duas migrations (a primeira saiu sem a palavra); este arquivo é o estado final.

create or replace function public.descanso_ok(
  p_date date,
  p_start_time time without time zone,
  p_duration_minutes integer,
  p_exclude_booking_id uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_max_seguidos constant integer := 4;
  v_descanso constant interval := interval '15 minutes';
  v_prev_end time := null;
  v_run integer := 0;
  r record;
begin
  if p_duration_minutes is null or p_duration_minutes <= 0 then return false; end if;
  for r in
    select x.s, x.e
    from (
      select b.start_time as s, b.end_time as e
      from public.bookings b
      where b.booking_date = p_date
        and b.status in ('pending', 'confirmed')
        and (p_exclude_booking_id is null or b.id <> p_exclude_booking_id)
      union all
      select p_start_time, (p_start_time + make_interval(mins => p_duration_minutes))::time
    ) x
    order by x.s, x.e
  loop
    if v_prev_end is not null and (r.s - v_prev_end) < v_descanso then
      v_run := v_run + 1;
    else
      v_run := 1;
    end if;
    if v_run > v_max_seguidos then return false; end if;
    if v_prev_end is null or r.e > v_prev_end then v_prev_end := r.e; end if;
  end loop;
  return true;
end;
$$;

create or replace function public.get_available_slots_excluding(p_date date, p_duration_minutes integer, p_exclude_booking_id uuid)
returns table(slot_time time without time zone)
language plpgsql
security definer
set search_path to 'public'
as $$
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
  v_grid_span := (extract(epoch from (v_close - time '08:00')) / 60)::integer;

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
    -- v29.185.0: o horário que faria o 5º atendimento seguido não é oferecido.
    and public.descanso_ok(p_date, c.s, p_duration_minutes, p_exclude_booking_id)
  order by c.s;
end;
$$;

create or replace function public.create_public_booking_v15(p_customer_name text, p_customer_phone text, p_customer_email text, p_service_name text, p_service_price numeric, p_duration_minutes integer, p_booking_date date, p_start_time time without time zone, p_notes text default null::text, p_selected_products jsonb default '[]'::jsonb, p_extend_close_minutes integer default 0)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
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

  -- v29.185.0: descanso obrigatório a cada 4 atendimentos seguidos.
  if not public.descanso_ok(p_booking_date, p_start_time, p_duration_minutes, null) then
    raise exception 'Este horário ficou indisponível: depois de 4 atendimentos seguidos o Juliano precisa de 15 minutos de descanso. Escolha um pouco mais tarde.';
  end if;

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

create or replace function public.phone_reschedule_booking(p_phone text, p_booking_id uuid, p_new_booking_date date, p_new_start_time time without time zone, p_extend_close_minutes integer default 0)
returns setof bookings
language plpgsql
security definer
set search_path to 'public'
as $$
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

  -- v29.185.0: descanso obrigatório a cada 4 atendimentos seguidos (sem contar o próprio).
  if not public.descanso_ok(p_new_booking_date, p_new_start_time, v_booking.duration_minutes, p_booking_id) then
    raise exception 'Este horário ficou indisponível: depois de 4 atendimentos seguidos o Juliano precisa de 15 minutos de descanso. Escolha um pouco mais tarde.';
  end if;

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
$$;

create or replace function public.customer_reschedule_booking_v25(p_booking_id uuid, p_new_booking_date date, p_new_start_time time without time zone)
returns bookings
language plpgsql
security definer
set search_path to 'public'
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

  -- v29.185.0: descanso obrigatório a cada 4 atendimentos seguidos (sem contar o próprio).
  if not public.descanso_ok(p_new_booking_date, p_new_start_time, v_booking.duration_minutes, p_booking_id) then
    raise exception 'Este horário ficou indisponível: depois de 4 atendimentos seguidos o Juliano precisa de 15 minutos de descanso. Escolha um pouco mais tarde.';
  end if;

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

create or replace function public.extended_close_slot_ok(p_date date, p_start_time time without time zone, p_duration_minutes integer, p_extend_minutes integer default 60)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $$
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

  -- v29.185.0: descanso obrigatório a cada 4 atendimentos seguidos.
  if not public.descanso_ok(p_date, p_start_time, p_duration_minutes, null) then return false; end if;

  return true;
end;
$$;

create or replace function public.admin_create_booking(p_customer_name text, p_customer_phone text, p_service_name text, p_service_price numeric, p_duration_minutes integer, p_booking_date date, p_start_time time without time zone, p_notes text default null::text, p_allow_outside_hours boolean default false, p_allow_overlap boolean default false)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_id uuid; v_end time;
begin
  if not public.is_admin() then raise exception 'Acesso não autorizado.'; end if;
  if not p_allow_outside_hours then
    if extract(dow from p_booking_date) in (0,1) then raise exception 'A barbearia não abre neste dia.'; end if;
  end if;
  v_end:=p_start_time+make_interval(mins=>p_duration_minutes);
  if not p_allow_outside_hours then
    if (extract(dow from p_booking_date)=6 and (p_start_time<'08:00' or p_start_time>'15:00')) or (extract(dow from p_booking_date) between 2 and 5 and (p_start_time<'08:00' or p_start_time>'19:00')) then raise exception 'Horário fora do atendimento.'; end if;
  end if;
  if exists(select 1 from public.schedule_blocks s where s.block_date=p_booking_date and (s.all_day or (p_start_time<s.end_time and v_end>s.start_time))) then raise exception 'Este horário está bloqueado.'; end if;
  if not p_allow_overlap and exists(select 1 from public.bookings b where b.booking_date=p_booking_date and b.status in ('pending','confirmed') and p_start_time<b.end_time and v_end>b.start_time) then raise exception 'Este período está indisponível.'; end if;
  -- v29.185.0: descanso obrigatório a cada 4 seguidos; "Permitir encaixe" é a exceção consciente.
  if not p_allow_overlap and not public.descanso_ok(p_booking_date, p_start_time, p_duration_minutes, null) then
    raise exception 'Seria o 5º atendimento seguido — a regra é 15 minutos de descanso a cada 4. Marque "Permitir encaixe" se quiser mesmo assim.';
  end if;
  insert into public.bookings(customer_name,customer_phone,service_name,service_price,duration_minutes,booking_date,start_time,notes,status)
  values(trim(p_customer_name),regexp_replace(p_customer_phone,'\D','','g'),p_service_name,p_service_price,p_duration_minutes,p_booking_date,p_start_time,nullif(trim(p_notes),''),'confirmed') returning id into v_id;
  return v_id;
end $$;

create or replace function public.admin_reschedule_booking(p_booking_id uuid, p_booking_date date, p_start_time time without time zone, p_service_name text, p_service_price numeric, p_duration_minutes integer, p_notes text default null::text, p_allow_outside_hours boolean default false, p_allow_overlap boolean default false)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_end time;
begin
  if not public.is_admin() then raise exception 'Acesso não autorizado.'; end if;
  if not p_allow_outside_hours then
    if extract(dow from p_booking_date) in (0,1) then raise exception 'A barbearia não abre neste dia.'; end if;
  end if;
  v_end:=p_start_time+make_interval(mins=>p_duration_minutes);
  if not p_allow_outside_hours then
    if (extract(dow from p_booking_date)=6 and (p_start_time<'08:00' or p_start_time>'15:00')) or (extract(dow from p_booking_date) between 2 and 5 and (p_start_time<'08:00' or p_start_time>'19:00')) then raise exception 'Horário fora do atendimento.'; end if;
  end if;
  if exists(select 1 from public.schedule_blocks s where s.block_date=p_booking_date and (s.all_day or (p_start_time<s.end_time and v_end>s.start_time))) then raise exception 'Este horário está bloqueado.'; end if;
  if not p_allow_overlap and exists(select 1 from public.bookings b where b.id<>p_booking_id and b.booking_date=p_booking_date and b.status in ('pending','confirmed') and p_start_time<b.end_time and v_end>b.start_time) then raise exception 'Este período está indisponível.'; end if;
  -- v29.185.0: descanso obrigatório a cada 4 seguidos (sem contar o próprio); "Permitir encaixe" é a exceção consciente.
  if not p_allow_overlap and not public.descanso_ok(p_booking_date, p_start_time, p_duration_minutes, p_booking_id) then
    raise exception 'Seria o 5º atendimento seguido — a regra é 15 minutos de descanso a cada 4. Marque "Permitir encaixe" se quiser mesmo assim.';
  end if;
  update public.bookings set booking_date=p_booking_date,start_time=p_start_time,service_name=p_service_name,service_price=p_service_price,duration_minutes=p_duration_minutes,notes=nullif(trim(p_notes),''),status='confirmed',updated_at=now() where id=p_booking_id;
  if not found then raise exception 'Agendamento não encontrado.'; end if;
end $$;
