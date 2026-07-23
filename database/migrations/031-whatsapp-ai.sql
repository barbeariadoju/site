-- Barbearia do Ju — IA no WhatsApp (Evolution API + JuIA)
-- Estado de conversa por telefone e histórico de mensagens.

create table if not exists public.whatsapp_conversations (
  phone text primary key,
  state jsonb not null default '{}'::jsonb,
  human_takeover boolean not null default false,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  direction text not null check (direction in ('in','out')),
  body text not null,
  sent_by text not null default 'bot' check (sent_by in ('bot','human')),
  evolution_message_id text,
  created_at timestamptz not null default now()
);

create index if not exists whatsapp_messages_evolution_id_idx
  on public.whatsapp_messages(evolution_message_id) where evolution_message_id is not null;

create index if not exists whatsapp_messages_phone_idx
  on public.whatsapp_messages(phone, created_at desc);

alter table public.whatsapp_conversations enable row level security;
alter table public.whatsapp_messages enable row level security;

revoke all on public.whatsapp_conversations from anon;
revoke all on public.whatsapp_messages from anon;

grant select, update on public.whatsapp_conversations to authenticated;
grant select, insert, update on public.whatsapp_conversations to service_role;

grant select on public.whatsapp_messages to authenticated;
grant select, insert on public.whatsapp_messages to service_role;

create policy "admin read whatsapp conversations"
on public.whatsapp_conversations for select to authenticated using (true);

create policy "admin update whatsapp conversations"
on public.whatsapp_conversations for update to authenticated using (true) with check (true);

create policy "admin read whatsapp messages"
on public.whatsapp_messages for select to authenticated using (true);

notify pgrst, 'reload schema';
