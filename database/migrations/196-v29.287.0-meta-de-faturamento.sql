-- v29.287.0 — meta de faturamento do mês (pedido do Juliano, 09/10/2026: "aparecer no mobile pra eu já
-- ver de manhã quanto vou fazer, quanto falta pra minha meta"). Uma linha por mês; a tela Hoje usa a do
-- mês do dia escolhido ou, se não houver, a última anterior (a meta continua valendo até ele mudar).
-- Meta inicial: R$ 14.100/mês = 200 atendimentos (meta declarada em 07/10) × ticket médio de outubro
-- (R$ 70,53), escolhida pelo Juliano em 09/10. Fica no banco (não no navegador) para o celular e o
-- computador mostrarem a mesma coisa.
create table if not exists public.revenue_goals (
  month date primary key check (extract(day from month) = 1),
  revenue_goal numeric(10,2) not null check (revenue_goal > 0),
  updated_at timestamptz not null default now()
);
alter table public.revenue_goals enable row level security;
drop policy if exists revenue_goals_admin_all on public.revenue_goals;
create policy revenue_goals_admin_all on public.revenue_goals for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
-- Aviso da Supabase (30/10/2026): tabela nova precisa de GRANT explícito.
grant select, insert, update on public.revenue_goals to authenticated;
grant all on public.revenue_goals to service_role;

insert into public.revenue_goals (month, revenue_goal) values ('2026-10-01', 14100)
on conflict (month) do nothing;

-- anon não lê meta (o REVOKE vale mesmo com o acesso automático antigo da Data API).
revoke all on public.revenue_goals from anon;
