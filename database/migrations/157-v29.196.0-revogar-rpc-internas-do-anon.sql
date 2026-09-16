-- 157 — v29.196.0 (16/09/2026) — Revisão de segurança do dia de folga.
--
-- O linter do Supabase (get_advisors, security) listou 43 funções SECURITY DEFINER executáveis
-- pelo papel anon. A maioria é intencional (site público: horários, checkout por código+token,
-- pesquisa por token, is_admin). Estas abaixo NÃO são: só as edge functions (service_role) e o
-- pg_cron (postgres) chamam, e qualquer pessoa com a chave anônima do site — que é pública —
-- conseguia, sabendo um telefone, ler agendamentos futuros, visitas, faltas, cadência e pesquisa
-- pendente de um cliente; listar TODOS os clientes "vencidos" com nome e telefone
-- (customers_due_for_reactivation); e disparar o reprecificador de reservas futuras.
--
-- Conferido antes de revogar: grep em todo o site (js/html) — nenhuma dessas é chamada pelo
-- front público nem pelo painel; todas as edge functions que as usam criam o cliente com
-- SUPABASE_SERVICE_ROLE_KEY. service_role recebe grant explícito (não depende do PUBLIC).
--
-- alarm_summary e chair_day_summary são do painel (admin-v15-4-dashboard.js, sessão
-- autenticada): saem só do anon. O estado do alarme da loja não é informação pública.

do $$
declare f text;
begin
  foreach f in array array[
    'public.customers_due_for_reactivation(integer, integer, integer)',
    'public.phone_upcoming_bookings(text)',
    'public.customer_completed_visits(text)',
    'public.customer_no_show_count(text)',
    'public.customer_visit_cadence_days(text)',
    'public.find_pending_experience_by_phone(text)',
    'public.customer_google_ask_recent(text, integer)',
    'public.is_customer_blocked(text)',
    'public.juia_pending_numeric_question(text)',
    'public.service_price_on(text, date)',
    'public.descanso_ok(date, time without time zone, integer, uuid)',
    'public.reprice_future_bookings()',
    'public.juia_next_send_time(timestamp with time zone)',
    'public.juia_quiet_now(timestamp with time zone)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

revoke execute on function public.alarm_summary() from public, anon;
revoke execute on function public.chair_day_summary(date) from public, anon;
grant execute on function public.alarm_summary() to authenticated, service_role;
grant execute on function public.chair_day_summary(date) to authenticated, service_role;

-- Linter: search_path mutável (cosmético, mas fecha o aviso).
alter function public.phone_key(text) set search_path = public;
alter function public.closing_rule(date) set search_path = public;
