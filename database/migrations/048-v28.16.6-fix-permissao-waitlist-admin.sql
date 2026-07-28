-- 048-v28.16.6-fix-permissao-waitlist-admin.sql
--
-- Bug real encontrado pelo Juliano em 2026-07-28, testando a tela
-- admin-espera.html manualmente: "permission denied for table waitlist".
--
-- Causa: a migration 039 (v28.8.0, criação da tabela waitlist) criou a policy
-- de RLS "admin manage waitlist" (checa is_admin()) mas só deu
-- "grant select, insert, update, delete" pro service_role, esquecendo do
-- authenticated. RLS só é avaliada DEPOIS do grant de tabela básico do
-- Postgres — sem o grant, o admin logado (role authenticated) nunca chega a
-- ser avaliado pela policy, e toda query na tela de lista de espera falhava
-- com "permission denied" independente de ser admin de verdade ou não.
--
-- Bug pré-existente, não relacionado a nenhuma mudança de 2026-07-28 (a
-- página admin-espera.html usa admin-espera-v28.js, arquivo separado que não
-- foi tocado na divisão do admin-v15-4.js feita na mesma sessão).

grant select, insert, update, delete on public.waitlist to authenticated;
