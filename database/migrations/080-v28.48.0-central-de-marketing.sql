-- 080-v28.48.0: Central de Marketing — memória permanente, biblioteca de prompts e calendário editorial
-- (aplicada no banco via MCP em 2026-08-03 com o nome interno "078_v28_48_0_central_marketing";
-- o arquivo é 080 porque 078/079 já estavam usados no repo pela Central de Conteúdo)
-- Camada de estratégia por cima da Central de Conteúdo (content_posts).
-- Dados seed (15 memórias, 11 prompts, calendário inicial) foram inseridos via SQL na mesma sessão.

create table public.marketing_memory (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('identidade','tom_de_voz','publico','restricao','melhor_pratica','aprendizado','decisao','campanha','ativo','meta')),
  title text not null,
  content text not null,
  source text not null default 'claude',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.marketing_memory is 'Memória permanente de marketing: identidade, tom, restrições, aprendizados, decisões e campanhas. Fonte de verdade consultada antes de criar qualquer conteúdo.';

create table public.marketing_prompts (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('imagem','video','reel','carrossel','story','status_whatsapp','post','anuncio','educativo')),
  objective text not null,
  platform text,
  title text not null,
  prompt_text text not null,
  notes text,
  performance text not null default 'nao_testado',
  times_used integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.marketing_prompts is 'Biblioteca reutilizável de prompts (imagem/vídeo/copy) organizada por categoria e objetivo. Atualizar performance conforme resultados reais.';

create table public.marketing_calendar (
  id uuid primary key default gen_random_uuid(),
  scheduled_date date not null,
  scheduled_time time,
  platform text not null,
  format text not null,
  theme text not null,
  objective text not null,
  audience text,
  copy_draft text,
  cta text,
  asset_needed text,
  status text not null default 'planejado' check (status in ('planejado','produzido','aguardando_aprovacao','aprovado','publicado','cancelado')),
  content_post_id uuid references public.content_posts(id) on delete set null,
  result_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.marketing_calendar is 'Calendário editorial: o que sai, quando, onde, com que objetivo e com que resultado. content_post_id liga ao rascunho/publicação real na Central de Conteúdo.';

create index marketing_calendar_date_idx on public.marketing_calendar (scheduled_date);
create index marketing_calendar_content_post_idx on public.marketing_calendar (content_post_id);

create or replace function public.marketing_touch_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;
revoke all on function public.marketing_touch_updated_at() from public, anon, authenticated;

create trigger marketing_memory_touch before update on public.marketing_memory
  for each row execute function public.marketing_touch_updated_at();
create trigger marketing_prompts_touch before update on public.marketing_prompts
  for each row execute function public.marketing_touch_updated_at();
create trigger marketing_calendar_touch before update on public.marketing_calendar
  for each row execute function public.marketing_touch_updated_at();

alter table public.marketing_memory enable row level security;
alter table public.marketing_prompts enable row level security;
alter table public.marketing_calendar enable row level security;

create policy marketing_memory_admin on public.marketing_memory
  for all to authenticated using (is_admin()) with check (is_admin());
create policy marketing_prompts_admin on public.marketing_prompts
  for all to authenticated using (is_admin()) with check (is_admin());
create policy marketing_calendar_admin on public.marketing_calendar
  for all to authenticated using (is_admin()) with check (is_admin());

-- Lição das migrations 058/066/076: RLS sem GRANT de base = permission denied silencioso
grant select, insert, update, delete on public.marketing_memory to authenticated, service_role;
grant select, insert, update, delete on public.marketing_prompts to authenticated, service_role;
grant select, insert, update, delete on public.marketing_calendar to authenticated, service_role;
