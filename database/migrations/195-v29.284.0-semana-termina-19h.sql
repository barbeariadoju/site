-- v29.284.0 — Terça a sexta: o último atendimento TERMINA até 19:00 (pedido do Juliano, 08/10/2026, logo depois
-- do sábado da v29.283.0: "terça a sexta quero que o último agendamento termine às 19hs"). Até aqui valia a régua
-- da v29.167.0 (início até 19:00, término até 20:00). Agora latest_end = 19:00 em todos os dias de atendimento:
-- último corte (45 min) às 18:15. O "estica" da JuIA (extended_close_slot_ok, +60 sobre latest_end com
-- p_extend_minutes 60) deixa de passar das 19:00 — exceção fora do horário volta a ser só do Juliano, no painel.
-- Já marcados que passam das 19:00 (09/10: Sabrino 18:30–19:45 e o encaixe do Marcelo 19:00–19:45, autorizado
-- por ele) não mudam: a regra só vale para agendamento novo. O fechamento automático do expediente usa o fim do
-- último atendimento real quando existe, então esses dias fecham certo.

create or replace function public.closing_rule(p_date date, out nominal_close time without time zone, out latest_end time without time zone)
 returns record
 language sql
 immutable
 set search_path to 'public'
as $function$
  select
    (case when extract(dow from p_date) = 6 then time '15:00' else time '19:00' end),
    (case when extract(dow from p_date) = 6 then time '15:00' else time '19:00' end);
$function$;
