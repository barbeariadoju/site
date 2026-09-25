-- v29.238.0 (25/09/2026) — Clube do Ju sai SEM a Cadeira Cativa (decisão do Juliano, antes do lançamento).
--
-- Conta feita com ele: a Cativa (R$ 249 por corte + Barboterapia + sobrancelha toda semana + hidratação,
-- tabela R$ 510) dá ~R$ 37 por hora de cadeira contra ~R$ 80 do avulso, e ocupa ~1h40 por semana por
-- assinante. Com agenda sobrando isso preenche hora vazia; com a agenda no teto (10 clientes/dia,
-- previsto pra dezembro), ela toma horário que seria vendido cheio. Os planos comuns ficam: pro cliente
-- típico (volta a cada 21 dias) eles aumentam o que ele paga por mês.
--
-- Nenhuma assinatura existia (vendas fechadas até 01/10). O código da Cativa fica no repositório, inerte:
-- plano inativo e 0 vaga. Contrato vira v2 (o v1 citava a Cativa em 2.4, 2.5, 4.2, 4.7 e 6.1).

insert into public.club_terms (version, sha256, url)
values ('v2', 'cf820c75386cebeaec924886e9ea961e94ede4783d910a6f08d0faeddca59311', 'https://www.barbeariadoju.com.br/clube/contrato/v2.txt')
on conflict (version) do update set sha256 = excluded.sha256, url = excluded.url;

update public.club_plans set active = false where id = 'cadeira-cativa';
update public.club_settings set vagas_cativa = 0, terms_version = 'v2', updated_at = now() where id = 1;
