-- Barbearia do Ju — V28.28.1
-- Bug real encontrado ao testar a migration 057: nem public.services (recém-criada)
-- nem public.products (migration 051-v28.20.0, em produção há dias) tinham GRANT
-- SELECT para service_role/anon/authenticated — só o role `postgres` tinha. A policy
-- RLS `using(active=true)` existia nas duas tabelas, mas RLS só filtra LINHAS; sem o
-- GRANT de base, qualquer SELECT (inclusive via service_role, que a Edge Function
-- ju-ia-site usa) falhava com "permission denied for table X". Isso significa que a
-- consulta de produtos em ju-ia-site estava quebrada silenciosamente desde a
-- migration 051 (o erro era engolido por `const {data}=...;data=data||[]`, sem
-- checar `error`) — a JuIA nunca conseguiu listar preço de produto de verdade,
-- só não tinha sido percebido. Corrigido aqui pras duas tabelas de uma vez.
grant select on public.services to anon, authenticated, service_role;
grant select on public.products to anon, authenticated, service_role;

notify pgrst, 'reload schema';
