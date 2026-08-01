-- Barbearia do Ju — v28.33.0
-- Tabela `google_reviews`: avaliações do Google Business Profile + rascunho de resposta
-- gerado por IA, revisado/editado e só publicado depois de aprovação manual do Juliano
-- (nunca publica sozinha). Mesmo padrão de fila com humano no meio já usado em
-- email_queue/sms_queue: pending -> approved -> posted.
--
-- NOTA: as migrations 061-068 (aplicadas direto via MCP entre 2026-07-31 e 2026-08-01)
-- não têm arquivo .sql correspondente salvo neste diretório — lacuna de documentação
-- pré-existente, não coberta por esta migration. A numeração aqui (069) segue a
-- sequência real do banco (ver `list_migrations`), não a numeração dos arquivos locais.
create table if not exists public.google_reviews (
  id uuid primary key default gen_random_uuid(),
  google_review_id text not null unique,
  reviewer_name text,
  reviewer_photo_url text,
  star_rating smallint check (star_rating between 1 and 5),
  comment text,
  review_created_at timestamptz,
  review_updated_at timestamptz,
  ai_draft_reply text,
  final_reply text,
  status text not null default 'pending' check (status in ('pending','approved','posted','ignored')),
  posted_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.google_reviews is 'Avaliações do Google Business Profile sincronizadas via API, com rascunho de resposta gerado por IA. Fluxo: pending (rascunho pronto pra revisão) -> approved (Juliano aprovou/editou, pronto pra publicar) -> posted (publicado de fato no Google via API). Status ignored = Juliano decidiu não responder. Nunca publica sozinha, sempre passa por aprovação manual.';
comment on column public.google_reviews.google_review_id is 'ID/nome do recurso da review na API do Google (ex.: accounts/{account}/locations/{location}/reviews/{reviewId}) — usado pra deduplicar no sync e identificar no publish.';
comment on column public.google_reviews.ai_draft_reply is 'Rascunho gerado automaticamente pela IA ao sincronizar — nunca publicado direto.';
comment on column public.google_reviews.final_reply is 'Texto que efetivamente será publicado — começa como cópia do ai_draft_reply, editável pelo Juliano antes de aprovar.';

create or replace function public.touch_google_reviews_updated_at()
returns trigger language plpgsql set search_path to 'public' as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger google_reviews_touch_updated_at
before update on public.google_reviews
for each row execute function public.touch_google_reviews_updated_at();

alter table public.google_reviews enable row level security;

create policy google_reviews_admin_select on public.google_reviews
  for select using (is_admin());
create policy google_reviews_admin_update on public.google_reviews
  for update using (is_admin());

-- GRANT explícito, sem confiar só na RLS — bug já visto 3x neste projeto (services/products
-- migration 058, conversation_leads v28.31.0, schedule_blocks migration 066): RLS só filtra
-- LINHAS, sem o GRANT de base a consulta falha com "permission denied" mesmo pra service_role.
grant select, insert, update on public.google_reviews to service_role;
grant select, update on public.google_reviews to authenticated;

notify pgrst, 'reload schema';
