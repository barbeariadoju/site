-- v29.372.0 — PILOTO: agenda compacta aos sábados (pedido do Juliano, 21/11/2026).
--
-- Problema: a oferta era qualquer horário livre na grade de 15 em 15. No sábado 21/11 a agenda
-- ficou 8:30-9:50 · 10:00-10:40 · 11:00-11:50 · 11:50-12:55 · 13:45-14:55 — 85 min vagos, 35 deles
-- em sobras de 10/20/5 min que não cabem nada. Média dos sábados desde 01/10: 67 min de buraco,
-- ~30 min em sobra menor que um corte (40 min). Meta dele: R$ 500 até as 15h no sábado.
--
-- Regra (só sábado): um horário só é oferecido se, dentro do vão livre onde ele cai,
--   (a) encosta no que vem antes (fim do cliente anterior / bloqueio / abertura 8:30), OU
--   (b) encosta no que vem depois (início do próximo / bloqueio / fechamento 15:00), OU
--   (c) deixa 40 min ou mais livres dos DOIS lados (cabe um corte em cada sobra).
-- Encostar sempre é permitido, então todo vão em que o serviço cabe continua tendo opção —
-- nenhum cliente perde o sábado por causa da regra, só escolhe entre menos horários.
-- Hoje: se o vão antes já começou a passar (o anterior terminou antes de agora+15), o lado de
-- antes não conta — aquela sobra já está perdida e não adianta empurrar o cliente para depois.
--
-- Para o "encostar no próximo" funcionar fora da grade (próximo às 11:00, corte de 40 → 10:20),
-- no sábado entram como candidatos também os inícios de cada atendimento/bloqueio menos a duração.
--
-- Vale para tudo que usa get_available_slots*: site (/agendar/), JuIA, reagendamento, lista de
-- espera, radar de encaixe e a lista de horários do painel (o painel tem campo livre, o Juliano
-- marca o que quiser). A gravação (create_public_booking_v15) não muda.
-- Para desligar: troque o "extract(dow from p_date) = 6" de sabado_compacto_ok por false.

create or replace function public.sabado_compacto_ok(p_date date, p_start time, p_duration_minutes integer, p_exclude_booking_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_now_sp timestamp := timezone('America/Sao_Paulo', now());
  v_min_start time := (v_now_sp + interval '15 minutes')::time;
  v_end time := p_start + make_interval(mins => p_duration_minutes);
  v_close time;
  v_prev time;
  v_next time;
  v_antes integer;
  v_depois integer;
  v_minimo constant integer := 40; -- um corte
begin
  if extract(dow from p_date) <> 6 then return true; end if;

  select nominal_close into v_close from public.closing_rule(p_date);

  select max(e) into v_prev from (
    select b.end_time e from public.bookings b
     where b.booking_date = p_date and b.status in ('pending','confirmed','completed')
       and (p_exclude_booking_id is null or b.id <> p_exclude_booking_id)
       and b.end_time <= p_start
    union all
    select bl.end_time from public.schedule_blocks bl
     where bl.block_date = p_date and not bl.all_day and bl.end_time is not null and bl.end_time <= p_start
    union all select time '08:30'
  ) x;

  select min(s) into v_next from (
    select b.start_time s from public.bookings b
     where b.booking_date = p_date and b.status in ('pending','confirmed','completed')
       and (p_exclude_booking_id is null or b.id <> p_exclude_booking_id)
       and b.start_time >= v_end
    union all
    select bl.start_time from public.schedule_blocks bl
     where bl.block_date = p_date and not bl.all_day and bl.start_time is not null and bl.start_time >= v_end
    union all select v_close
  ) y;

  v_antes := greatest(0, (extract(epoch from (p_start - v_prev)) / 60)::integer);
  v_depois := case when v_end >= v_close then 0 else greatest(0, (extract(epoch from (v_next - v_end)) / 60)::integer) end;

  -- Hoje, com o vão de antes já correndo, só o lado de depois decide.
  if p_date = v_now_sp::date and v_prev < v_min_start then
    return v_depois = 0 or v_depois >= v_minimo;
  end if;

  return v_antes = 0 or v_depois = 0 or (v_antes >= v_minimo and v_depois >= v_minimo);
end;
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
  v_first time := time '08:30'; -- v29.276.0: era 08:00
  v_close time;
  v_latest time;
  v_dur interval;
  v_grid_span integer;
  v_sabado boolean := extract(dow from p_date) = 6; -- v29.372.0: piloto da agenda compacta
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
  -- v29.372.0: no sábado, também o horário que termina colado no início do próximo.
  colados_no_proximo as (
    select (b.start_time - v_dur)::time as s
    from public.bookings b
    where v_sabado and b.booking_date = p_date
      and b.status in ('pending', 'confirmed', 'completed')
      and (p_exclude_booking_id is null or b.id <> p_exclude_booking_id)
      and b.start_time - v_dur >= v_first
    union
    select (bl.start_time - v_dur)::time
    from public.schedule_blocks bl
    where v_sabado and bl.block_date = p_date and not bl.all_day and bl.start_time is not null
      and bl.start_time - v_dur >= v_first
    union
    select (v_close - v_dur)::time where v_sabado and v_close - v_dur >= v_first
  ),
  candidatos as (
    select s from grade
    union
    select s from fins
    union
    select s from colados_no_proximo
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
    -- v29.372.0: sábado não deixa sobra de 1 a 39 min (ver sabado_compacto_ok).
    and public.sabado_compacto_ok(p_date, c.s, p_duration_minutes, p_exclude_booking_id)
  order by c.s;
end;
$function$;

grant execute on function public.sabado_compacto_ok(date, time, integer, uuid) to service_role;
