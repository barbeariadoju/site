-- v29.278.0 — LIMITE DE 12 ATENDIMENTOS POR DIA (pedido do Juliano, 07/10/2026): "meu físico é pra 10/12
-- clientes no máximo em 1 dia… bateu 12 num dia não agenda mais… assim a gente força a pessoa cortar outro dia".
-- Conta agendamento ativo (pendente, confirmado, concluído) do dia; com 12, o site, a JuIA e o reagendamento
-- param de oferecer horário e uma reserva que chegue mesmo assim é recusada ("indisponível", o que a JuIA já trata
-- oferecendo outro dia). O Juliano no painel (is_admin) e a senha digital (cliente na porta) não são barrados:
-- cara a cara, quem decide é ele. Um agendamento conta 1 (pai e filho no mesmo horário contam 1).

create or replace function public.limite_atendimentos_dia() returns integer
 language sql immutable as $$ select 12 $$;

create or replace function public.dia_lotado(p_date date, p_exclude_booking_id uuid default null)
 returns boolean
 language sql stable security definer
 set search_path to 'public'
as $$
  select count(*) >= public.limite_atendimentos_dia()
  from public.bookings b
  where b.booking_date = p_date
    and b.status in ('pending', 'confirmed', 'completed')
    and (p_exclude_booking_id is null or b.id <> p_exclude_booking_id);
$$;
revoke all on function public.dia_lotado(date, uuid) from public;
grant execute on function public.dia_lotado(date, uuid) to anon, authenticated, service_role;

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
  -- v29.278.0: dia com 12 atendimentos (limite físico do Juliano) não oferece mais horário.
  if public.dia_lotado(p_date, p_exclude_booking_id) then return; end if;

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


create or replace function public.bookings_limite_diario()
 returns trigger
 language plpgsql security definer
 set search_path to 'public'
as $$
begin
  if new.status not in ('pending', 'confirmed') then return new; end if;
  if tg_op = 'UPDATE' and new.booking_date is not distinct from old.booking_date
     and old.status in ('pending', 'confirmed', 'completed') then return new; end if;
  if coalesce(current_setting('bdj.senha_porta', true), '') = '1' then return new; end if;
  if public.is_admin() then return new; end if;
  if public.dia_lotado(new.booking_date, new.id) then
    raise exception 'Horário indisponível: a agenda de % já está completa (limite de % atendimentos no dia).',
      to_char(new.booking_date, 'DD/MM'), public.limite_atendimentos_dia();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bookings_limite_diario on public.bookings;
create trigger trg_bookings_limite_diario
  before insert or update of booking_date, status on public.bookings
  for each row execute function public.bookings_limite_diario();
