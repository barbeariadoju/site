-- v29.331.0 — pedido do Juliano (31/10/2026): "a regra dos 12 pode excluir também, vamos deixar lotar". Mesmo dia em
-- que saiu a regra das 4 seguidas (migração 208).
-- O limite de 12 atendimentos por dia (v29.278.0, migrações 192-193) estava num ponto só: dia_lotado. Quem consulta:
-- get_available_slots_excluding (site, JuIA, painel), o gatilho trg_bookings_limite_diario, encaixes_possiveis e a
-- senha digital. Desligar a função libera todos juntos; a assinatura fica para nada quebrar. limite_atendimentos_dia()
-- continua existindo (12) só como referência, para voltar a ligar sem reescrever nada.
create or replace function public.dia_lotado(p_date date, p_exclude_booking_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select false
$function$;
