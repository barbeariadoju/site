-- v28.50.0 — JuIA Social (comentários + DMs de Facebook/Instagram), Fase 1
-- Mesma filosofia da Central de Conteúdo: IA prepara rascunho, Juliano aprova, só
-- então sai de verdade. Nenhum envio automático.
create table if not exists public.social_inbox (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('facebook','instagram')),
  kind text not null check (kind in ('comment','message')),
  external_id text not null,
  thread_id text not null,
  sender_psid text,
  sender_name text,
  original_text text not null,
  ai_draft text,
  reply_text text,
  status text not null default 'rascunho' check (status in ('rascunho','aprovado','enviado','rejeitado','ignorado')),
  context jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  replied_at timestamptz,
  unique (platform, kind, external_id)
);

alter table public.social_inbox enable row level security;

create policy "admin_all_social_inbox" on public.social_inbox
  for all using (is_admin()) with check (is_admin());

grant select, update on public.social_inbox to authenticated;
grant select, insert, update on public.social_inbox to service_role;

create index if not exists social_inbox_status_idx on public.social_inbox (status, created_at);
