-- v29.276.0 — primeiro horário oferecido às 08:30 (pedido do Juliano, 07/10/2026): o 08:00 deixa de ser
-- oferecido no site, na JuIA, no reagendamento e no painel de horários do admin. A grade é a mesma de
-- sempre (de 15 em 15 min), só começa meia hora depois. Agendamento que já existe às 08:00 não muda.
-- O horário de funcionamento publicado (8h–19h / 8h–15h) não muda: é a primeira vaga que passa a ser 8h30.
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
  v_first time := time '08:30'; -- v29.276.0: era 08:00
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
  v_grid_span := (extract(epoch from (v_close - v_first)) / 60)::integer;

  return query
  with grade as (
    select (v_first + make_interval(mins => g))::time as s
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
  where c.s >= v_first
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
$function$;
