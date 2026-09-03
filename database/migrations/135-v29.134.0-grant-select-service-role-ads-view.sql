-- 135 — v29.134.0 — correção da 134
--
-- O `revoke all ... from anon, authenticated` da migração 134 deixou a view sem SELECT
-- também para o service_role: ela ficou com TRUNCATE, REFERENCES e TRIGGER e mais nada.
-- A edge function google-ads-conversions-csv respondia 200 na autenticação e 500 na
-- leitura, com "erro ao ler" — só apareceu porque o endpoint foi testado de verdade
-- depois do deploy, não porque o deploy reclamou.
--
-- A view continua fora do alcance de anon/authenticated: quem lê é service_role.

grant select on public.google_ads_offline_conversions to service_role;
