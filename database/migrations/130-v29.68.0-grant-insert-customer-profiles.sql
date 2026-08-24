-- v29.68.0 — a pergunta de primeira visita da JuIA (ju-ia-site) cria o perfil do
-- cliente quando ele declara "1/2" antes de existir cadastro (agendamento público só
-- cria perfil na conclusão). O write falhava em silêncio: 42501, service_role tinha
-- SELECT/UPDATE em customer_profiles mas não INSERT — mesma classe do bug da migration
-- 127 (payments). Descoberto em teste real de 24/08/2026, depois de logar o erro que o
-- código engolia (v29.68.1).
grant insert on public.customer_profiles to service_role;
