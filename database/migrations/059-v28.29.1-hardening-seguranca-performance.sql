-- Barbearia do Ju — V28.29.1
-- Hardening de segurança e performance, achado ao rodar os advisors do Supabase
-- (get_advisors) depois das migrations 057/058 — nenhum desses itens foi causado
-- por elas, são achados de auditoria geral do banco.

-- 1) SEGURANÇA REAL: view legada `v27_customer_metrics` (migration 027, v27) rodava
-- como SECURITY DEFINER (bypassa RLS das tabelas usadas) E tinha GRANT SELECT pro
-- role `authenticated` — que nesse projeto não é só o Juliano, é qualquer cliente
-- logado na área do cliente (client-area-page). Ou seja, qualquer cliente logado
-- conseguia consultar essa view direto via API e ver nome/telefone/e-mail/gasto de
-- TODOS os outros clientes. Confirmado que nada no código atual usa essa view
-- (grep só achou a própria migration de criação) nem nenhuma outra view/função do
-- banco depende dela (checado via pg_depend) — é resquício do CRM antigo, superado
-- pelas funções atuais (get_customer_commercial_context, etc). Removida.
drop view if exists public.v27_customer_metrics;

-- 2) PERFORMANCE: RLS re-avaliando auth.uid() por linha em vez de uma vez por
-- query — troca auth.uid() por (select auth.uid()) nas 3 policies apontadas pelo
-- advisor (auth_rls_initplan). Mesmo comportamento, só mais rápido em escala.
alter policy "admin_users self read" on public.admin_users
  using (user_id = (select auth.uid()));

alter policy "admin read ai conversations" on public.ai_conversations
  using ((select auth.uid()) = user_id);

alter policy "admin manage own push subscriptions" on public.push_subscriptions
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- 3) PERFORMANCE: policies duplicadas (mesmo cmd, mesma condição, cobrindo o mesmo
-- caso duas vezes — cada query paga o custo de avaliar as duas). Mantém 1 de cada
-- par, removendo a redundante.
drop policy if exists "Permitir leitura apenas para usuários autenticados" on public.contact_messages;
drop policy if exists "admin read customer timeline" on public.customer_timeline; -- coberta por "admin timeline all" (cmd ALL)
drop policy if exists "admin experience read" on public.experience_requests; -- duplicata de "admin read experience requests"

-- 4) PERFORMANCE: foreign keys sem índice de cobertura (apontadas pelo advisor
-- unindexed_foreign_keys) — ajuda joins/lookups por essas colunas.
create index if not exists bookings_rebooked_to_booking_id_idx on public.bookings (rebooked_to_booking_id);
create index if not exists customer_timeline_booking_id_idx on public.customer_timeline (booking_id);
create index if not exists email_outbox_booking_id_idx on public.email_outbox (booking_id);
create index if not exists loyalty_events_customer_id_idx on public.loyalty_events (customer_id);
create index if not exists waitlist_booking_id_idx on public.waitlist (booking_id);

-- 5) PERFORMANCE: índice duplicado (mesmas colunas, mesma ordem) — mantém só um.
drop index if exists public.customer_timeline_customer_idx;

notify pgrst, 'reload schema';
