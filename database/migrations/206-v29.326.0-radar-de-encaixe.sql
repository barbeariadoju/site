-- v29.326.0 — radar de encaixe (pedido do Juliano, 31/10/2026, caso Rodrigo).
-- "Amanhã c conseguiria me salvar?" às 20h12 de sexta recebeu "Amanhã não tenho mais vaga" — e o sábado
-- tinha 13:15–14:00 livres (45 min, barrado pela regra do descanso) e dois buracos de 30 min de manhã.
-- O Juliano pediu: em vez do "não" de cara, a JuIA diz que vai ver e ele decide se encaixa.
--
-- Esta função NÃO oferece horário a ninguém: ela só lista os buracos da agenda, maiores primeiro, para a
-- JuIA saber se vale prometer "vou ver" e para o push dizer ao Juliano ONDE caberia. Quem encaixa é ele.
-- Respeita o que a get_available_slots_excluding respeita de "dia fechado": domingo/segunda, bloqueio de
-- dia inteiro e o limite de 12 atendimentos (dia_lotado). O descanso e os 15 min de folga da grade, não —
-- é justamente o que o encaixe apertado dribla, e por isso é decisão humana.
create or replace function public.encaixes_possiveis(p_date date, p_min_minutes integer default 30)
returns table(inicio time, fim time, minutos integer)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_now_sp timestamp := timezone('America/Sao_Paulo', now());
  v_today date := v_now_sp::date;
  v_first time := time '08:30';
  v_close time;
  v_from time;
begin
  if p_date < v_today then return; end if;
  if extract(dow from p_date) in (0, 1) then return; end if;
  if exists (select 1 from public.schedule_blocks b where b.block_date = p_date and b.all_day) then return; end if;
  if public.dia_lotado(p_date, null) then return; end if;

  select nominal_close into v_close from public.closing_rule(p_date);
  v_from := case when p_date = v_today then greatest(v_first, (v_now_sp + interval '15 minutes')::time) else v_first end;

  return query
  with ocupado as (
    select b.start_time as s, b.end_time as e
    from public.bookings b
    where b.booking_date = p_date and b.status in ('pending', 'confirmed')
    union all
    select bl.start_time, bl.end_time
    from public.schedule_blocks bl
    where bl.block_date = p_date and not bl.all_day and bl.start_time is not null and bl.end_time is not null
  ),
  ordenado as (
    select o.s, max(o.e) over (order by o.s rows between unbounded preceding and 1 preceding) as fim_anterior
    from ocupado o
  ),
  buracos as (
    select greatest(coalesce(o.fim_anterior, v_first), v_from) as gi, least(o.s, v_close) as gf from ordenado o
    union all
    select greatest(coalesce((select max(o.e) from ocupado o), v_first), v_from), v_close
  )
  select bu.gi, bu.gf, (extract(epoch from (bu.gf - bu.gi)) / 60)::integer
  from buracos bu
  where bu.gf > bu.gi
    and extract(epoch from (bu.gf - bu.gi)) / 60 >= p_min_minutes
  order by 3 desc, 1;
end;
$function$;

revoke all on function public.encaixes_possiveis(date, integer) from public, anon, authenticated;
grant execute on function public.encaixes_possiveis(date, integer) to service_role;
