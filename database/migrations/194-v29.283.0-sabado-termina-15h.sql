-- v29.283.0 — Sábado: o último atendimento TERMINA até 15:00 (pedido do Juliano, 08/10/2026: "não quero
-- mais que disponibilize o agendamento pras 15hs, quero acabar o último serviço no máximo 15hs… tô com dor
-- nas costas"). Até aqui o sábado seguia a régua da v29.167.0 (início até o fechamento, término até 60 min
-- depois): começava às 15:00 e ia até 16:00. Agora, no sábado, latest_end = nominal_close = 15:00, então o
-- último início é 15:00 menos a duração do serviço. Terça a sexta não mudam (início até 19:00, término até 20:00).
-- closing_rule é a fonte única: get_available_slots_excluding, create_public_booking_v15, phone_reschedule_booking,
-- extended_close_slot_ok (JuIA), senha_digital_criar e o fechamento automático do expediente leem daqui.
-- Conferido antes de aplicar: nenhum sábado futuro com atendimento terminando depois das 15:00.

create or replace function public.closing_rule(p_date date, out nominal_close time without time zone, out latest_end time without time zone)
 returns record
 language sql
 immutable
 set search_path to 'public'
as $function$
  select
    (case when extract(dow from p_date) = 6 then time '15:00' else time '19:00' end),
    (case when extract(dow from p_date) = 6 then time '15:00' else time '20:00' end);
$function$;
