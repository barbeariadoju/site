-- v29.11.1 — histórico de seguidores (Instagram/Facebook), pra dar delta semana a semana.
-- Antes não existia nenhum registro: o relatório meta-insights-weekly é emailado e não
-- fica salvo em lugar nenhum. Snapshot manual/pontual por enquanto (não tem cron ainda).
create table public.social_followers_snapshot (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('instagram','facebook')),
  followers integer not null,
  following integer,
  captured_at timestamptz not null default now(),
  note text
);

alter table public.social_followers_snapshot enable row level security;

create policy "admin reads social_followers_snapshot"
  on public.social_followers_snapshot for select
  using (is_admin());

revoke all on public.social_followers_snapshot from anon, authenticated, public;
grant select on public.social_followers_snapshot to service_role;
grant select on public.social_followers_snapshot to authenticated;

insert into public.social_followers_snapshot (platform, followers, following, note) values
  ('instagram', 227, 275, 'primeiro snapshot — checado ao vivo em 09/08/2026 pelo Claude, via perfil público'),
  ('facebook', 5, 0, 'primeiro snapshot — checado ao vivo em 09/08/2026 pelo Claude, via página pública');
