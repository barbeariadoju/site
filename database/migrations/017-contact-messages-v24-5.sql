-- V24.5.0 — Central própria de mensagens do site
create extension if not exists pgcrypto;

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  phone text not null check (phone ~ '^[0-9]{10,13}$'),
  message text not null check (char_length(message) between 10 and 1000),
  status text not null default 'new' check (status in ('new','read','replied','archived')),
  page_url text,
  user_agent text,
  email_status text not null default 'pending' check (email_status in ('pending','sent','failed','disabled')),
  email_error text,
  read_at timestamptz,
  replied_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.contact_messages add column if not exists status text not null default 'new';
alter table public.contact_messages add column if not exists user_agent text;
alter table public.contact_messages add column if not exists read_at timestamptz;
alter table public.contact_messages add column if not exists replied_at timestamptz;
alter table public.contact_messages add column if not exists archived_at timestamptz;
alter table public.contact_messages add column if not exists updated_at timestamptz not null default now();

create index if not exists contact_messages_created_idx on public.contact_messages (created_at desc);
create index if not exists contact_messages_status_idx on public.contact_messages (status, created_at desc);
create index if not exists contact_messages_phone_idx on public.contact_messages (phone);

alter table public.contact_messages enable row level security;
drop policy if exists "admin read contact messages" on public.contact_messages;
drop policy if exists "admin update contact messages" on public.contact_messages;
drop policy if exists "admin delete contact messages" on public.contact_messages;
create policy "admin read contact messages" on public.contact_messages for select to authenticated using (true);
create policy "admin update contact messages" on public.contact_messages for update to authenticated using (true) with check (true);
create policy "admin delete contact messages" on public.contact_messages for delete to authenticated using (true);
grant select, update, delete on public.contact_messages to authenticated;

create or replace function public.touch_contact_messages_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
drop trigger if exists trg_contact_messages_updated_at on public.contact_messages;
create trigger trg_contact_messages_updated_at before update on public.contact_messages for each row execute function public.touch_contact_messages_updated_at();
