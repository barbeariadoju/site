-- v29.341.0 — terça a sexta, o último atendimento pode TERMINAR até 19:20 (pedido do Juliano, 04/11/2026, caso Carlos:
-- a JuIA ofereceu amanhã 18:00, ele escolheu corte + barba, que termina 19:05, e recebeu "Horário fora do atendimento.".
-- O Juliano fechou na mão: "pode agendar pra gente não perder o cliente e o serviço, mesmo que eu saia um pouco mais
-- tarde, desde que o serviço acabe no máximo até 19:20"). Até aqui valia a v29.284.0 (término até 19:00).
-- Fonte única: closing_rule. Vale para o site, a JuIA, o reagendamento, a senha digital e o radar de encaixe.
-- Início continua até 19:00 (nominal_close), mas na prática o fim até 19:20 é que manda: corte (40 min) até 18:40,
-- corte + barba (65 min) até 18:15. Sábado não muda (15:00).
create or replace function public.closing_rule(p_date date, out nominal_close time, out latest_end time)
returns record
language sql
immutable
set search_path to 'public'
as $function$
  select
    (case when extract(dow from p_date) = 6 then time '15:00' else time '19:00' end),
    (case when extract(dow from p_date) = 6 then time '15:00' else time '19:20' end);
$function$;
