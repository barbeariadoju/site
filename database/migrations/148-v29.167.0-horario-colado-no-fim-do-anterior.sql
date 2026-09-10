-- v29.167.0 — Horário livre COLADO no fim do atendimento anterior (pedido do Juliano, 10/09/2026).
--
-- Caso Paulo Spina (10/09, 12:29): pediu 16:15 ou 16:30, "teria que ser depois". O último
-- corte do dia (Lucas) termina 18:05. A grade de 15 em 15 só conhece 18:00 (dentro do Lucas)
-- e 18:15 (18:15 + 50 = 19:05, passa das 19h). Resultado: "não tenho nada hoje", com 55 minutos
-- de cadeira vazia antes de fechar. Com um barbeiro só, cada janela dessas é faturamento
-- perdido — e o site, a JuIA e o reagendamento consultam esta função.
--
-- Regra: candidatos = grade (08:00, 08:15, …) + FIM de cada agendamento e de cada bloqueio
-- do dia. O fim de atendimento só entra na lista quando o horário de grade seguinte NÃO
-- cabe (senão a lista vira 12:25, 12:30, 12:45… e o ganho é de 5 minutos). Todas as outras
-- regras continuam iguais: 15 min de antecedência no mesmo dia, expediente 08:00–19:00
-- (sábado até 15:00), bloqueios e sobreposição. As RPCs de reserva (create_public_booking_v15,
-- phone_reschedule_booking) nunca exigiram grade de 15 — só checam sobreposição — então um
-- 18:05 oferecido aqui é aceito lá sem mudança.
--
-- get_available_slots vira um atalho de get_available_slots_excluding(…, null): fonte única.

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
  close_m integer;
  v_close time;
  v_dur interval;
begin
  if p_duration_minutes is null or p_duration_minutes <= 0 then
    raise exception 'Duração do serviço inválida.';
  end if;
  if p_date < v_today then return; end if;
  if extract(dow from p_date) in (0, 1) then return; end if;
  if exists (select 1 from public.schedule_blocks b where b.block_date = p_date and b.all_day) then return; end if;

  close_m := case when extract(dow from p_date) = 6 then 15 * 60 else 19 * 60 end;
  v_close := make_time(close_m / 60, close_m % 60, 0);
  v_dur := make_interval(mins => p_duration_minutes);

  return query
  with grade as (
    select (time '08:00' + make_interval(mins => g))::time as s
    from generate_series(0, close_m - 8 * 60 - 1, 15) g
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
  ),
  livres as (
    select c.s
    from candidatos c
    where c.s >= time '08:00'
      and c.s + v_dur <= v_close
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
  )
  select l.s
  from livres l
  where (extract(minute from l.s)::integer % 15 = 0)
     or not exists (
       select 1 from livres g
       where extract(minute from g.s)::integer % 15 = 0
         and g.s >= l.s and g.s < l.s + interval '15 minutes'
     )
  order by l.s;
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
