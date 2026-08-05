-- v28.55.1 — Complemento da 087: revogar de PUBLIC, não só de anon/authenticated.
--
-- LIÇÃO IMPORTANTE (o revoke da 087 sozinho NÃO resolveu): no Postgres, função criada sem
-- GRANT explícito nasce com EXECUTE pra PUBLIC. `revoke ... from anon, authenticated` não
-- tira nada nesse caso, porque a permissão vem do papel PUBLIC (que anon e authenticated
-- herdam). Conferir sempre com `p.proacl` / aclexplode tratando grantee=0 como PUBLIC —
-- uma consulta que só olha rolname in ('anon','authenticated') dá falso negativo.
--
-- Query de auditoria que expõe o problema de verdade:
--   select p.proname,
--     case when p.proacl is null then 'PUBLIC (sem ACL)'
--          else (select string_agg(distinct coalesce(r.rolname,'PUBLIC'), ', ')
--                from aclexplode(p.proacl) g left join pg_roles r on r.oid=g.grantee
--                where g.privilege_type='EXECUTE') end as quem_executa
--   from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--   where n.nspname='public' and p.prosecdef;

-- Vazamento real: devolve nome + telefone de todos os clientes que fazem aniversário hoje,
-- chamável com a chave anônima pública do site. Usada só pela edge function
-- customer-birthday (service_role).
revoke execute on function public.customers_birthday_today() from public, anon, authenticated;

-- Continuava exposta apesar da 087 (o grant vinha de PUBLIC): criar agendamento direto por
-- PostgREST, pulando a edge function create-public-booking.
revoke execute on function public.create_public_booking_v15(text, text, text, text, numeric, integer, date, time without time zone, text, jsonb) from public;

-- Idem: devolve linhas de waitlist (nome + telefone de quem espera).
revoke execute on function public.waitlist_matches_for_slot(date, time without time zone) from public;

-- Idem (get_customer_commercial_context): dados comerciais de qualquer telefone.
revoke execute on function public.get_customer_commercial_context(text) from public;

-- Baixo risco (devolve só um booleano), mas sem caller público — usada pelo whatsapp-webhook
-- com service_role.
revoke execute on function public.customer_already_reviewed(uuid) from public, anon, authenticated;

-- Sem caller no código; recebe row type de bookings e devolve o uuid do cliente.
revoke execute on function public.v27_customer_for_booking(public.bookings) from public, anon, authenticated;

-- NÃO mexido de propósito: get_available_slots continua público (o site precisa listar
-- horários livres sem login — testado com a chave anon depois desta migration, segue 200).
-- As funções `returns trigger`/`event_trigger` (v21_sync_loyalty_on_completed_booking,
-- v27_queue_experience_*, rls_auto_enable) não são expostas como RPC pelo PostgREST — o
-- GRANT pra PUBLIC nelas é inofensivo.
