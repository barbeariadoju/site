-- Barbearia OS V16 — histórico do Assistente IA
create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  question text not null,
  answer text not null,
  model text,
  created_at timestamptz not null default now()
);

create index if not exists ai_conversations_created_idx
on public.ai_conversations(created_at desc);

alter table public.ai_conversations enable row level security;
grant select on public.ai_conversations to authenticated;

drop policy if exists "admin read ai conversations" on public.ai_conversations;
create policy "admin read ai conversations"
on public.ai_conversations
for select
to authenticated
using (auth.uid() = user_id);
