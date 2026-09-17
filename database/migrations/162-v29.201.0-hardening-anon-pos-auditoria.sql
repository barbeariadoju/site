-- v29.201.0 (17/09/2026) — Hardening do papel anônimo depois da auditoria externa (Manus, 17/09)
-- e do linter de segurança do Supabase (get_advisors, mesmo dia).
--
-- O que o linter apontou e faz sentido fechar:
--  1) RPCs administrativas SECURITY DEFINER executáveis pelo anon: admin_create_booking,
--     admin_register_walkin_visit, admin_reschedule_booking, generate_gift_code. Todas já checam
--     is_admin() por dentro (anon recebe "Acesso não autorizado"), mas não há motivo pra estarem
--     no cardápio do /rest/v1/rpc sem login. Mesma linha da migration 157.
--  2) is_admin() executável pelo anon: só devolve false, mas nenhum código do site chama sem
--     sessão (conferido: só prepay-confirm e google-reviews-publish, com JWT do admin).
--  3) contact_messages com SELECT/UPDATE concedidos ao anon (herança de GRANT ALL antigo): a RLS
--     já bloqueia porque só existe policy de INSERT, mas privilégio sem uso é superfície à toa.
--  4) TRUNCATE concedido a anon/authenticated em todas as tabelas (default do Supabase): a RLS
--     NÃO cobre TRUNCATE. O PostgREST não expõe TRUNCATE, então não é explorável pela API hoje,
--     mas é o tipo de privilégio que não custa nada tirar e evita surpresa em mudança futura.
--
-- O que NÃO mexi, de propósito:
--  - Funções de gatilho (bookings_block_guard, v21_sync_loyalty…, etc.) listadas pelo linter:
--    o PostgREST não consegue chamá-las (retornam trigger) e revogar EXECUTE poderia interferir
--    no disparo dos gatilhos em UPDATE feito pelo admin autenticado. Ganho zero, risco real.
--  - camera_ingest(p_secret): pública por desenho, protegida por segredo na chamada.
--  - Funções por token (get_experience_context, declare_prepay, customer_cancel_booking_v25…):
--    o token é a autorização; é assim que o link do cliente funciona.
--  - get_public_customer_summary(p_phone): usada pela área do cliente do site (cliente-v23.js).
--    Devolve nome, pontos e próximo horário só com o telefone — é decisão de produto (privacidade
--    x conveniência), registrada no CHANGELOG pro Juliano decidir; não é bug de permissão.

revoke execute on function public.admin_create_booking(text, text, text, numeric, integer, date, time without time zone, text, boolean, boolean) from anon, public;
grant execute on function public.admin_create_booking(text, text, text, numeric, integer, date, time without time zone, text, boolean, boolean) to authenticated, service_role;
revoke execute on function public.admin_register_walkin_visit(text, text, text, numeric, integer, date, time without time zone, text, text, jsonb, numeric) from anon, public;
grant execute on function public.admin_register_walkin_visit(text, text, text, numeric, integer, date, time without time zone, text, text, jsonb, numeric) to authenticated, service_role;
revoke execute on function public.admin_reschedule_booking(uuid, date, time without time zone, text, numeric, integer, text, boolean, boolean) from anon, public;
grant execute on function public.admin_reschedule_booking(uuid, date, time without time zone, text, numeric, integer, text, boolean, boolean) to authenticated, service_role;
revoke execute on function public.generate_gift_code() from anon, public;
grant execute on function public.generate_gift_code() to authenticated, service_role;
-- is_admin(): o linter lista como executável pelo anon, mas 12 policies de RLS com papel PUBLIC
-- (bookings, google_reviews, content_posts, finance_*, …) chamam is_admin() no USING — sem EXECUTE
-- pro anon, qualquer leitura anônima nessas tabelas vira erro de permissão em vez de "zero linhas".
-- Ela só devolve false sem sessão; fica como está. (Tentei revogar em 17/09: derrubou o
-- authenticated junto — revoke de PUBLIC leva o grant implícito — e voltei em 1 minuto.)

revoke select, update on table public.contact_messages from anon;

do $$
declare r record;
begin
  for r in select schemaname, tablename from pg_tables where schemaname = 'public' loop
    execute format('revoke truncate on table %I.%I from anon, authenticated', r.schemaname, r.tablename);
  end loop;
end $$;

-- Novas tabelas não devem nascer com TRUNCATE pro anon/authenticated.
alter default privileges for role postgres in schema public revoke truncate on tables from anon, authenticated;
