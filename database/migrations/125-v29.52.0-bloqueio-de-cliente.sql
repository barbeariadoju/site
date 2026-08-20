-- v29.52.0 — bloqueio de cliente por furo repetido (caso Graziele, 20/08/2026).
-- Regra do Juliano: cliente bloqueado NÃO agenda pelos canais de autoatendimento
-- (site e JuIA); encaixe manual pelo painel admin continua livre (is_admin()).
-- Obs.: a JuIA insere com channel 'site' (v29.1.0 atualiza pra juia_* DEPOIS),
-- então o guard em ('site','juia_whatsapp') cobre os dois caminhos no INSERT.

create table if not exists public.blocked_customers (
  id uuid primary key default gen_random_uuid(),
  customer_phone text not null,
  customer_name text,
  reason text,
  created_at timestamptz not null default now()
);
alter table public.blocked_customers enable row level security;

create or replace function public.is_customer_blocked(p_phone text)
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select exists(
    select 1 from public.blocked_customers b
    where public.phone_match_key(b.customer_phone) = public.phone_match_key(p_phone)
  );
$$;

create or replace function public.bookings_block_guard()
returns trigger
language plpgsql security definer
set search_path to 'public'
as $$
begin
  -- Só barra autoatendimento (site/JuIA). Admin logado (Agenda/balcão) passa sempre —
  -- decisão do Juliano: "se ela quiser vir eu tento encaixar".
  if coalesce(new.channel, 'site') in ('site', 'juia_whatsapp')
     and not public.is_admin()
     and public.is_customer_blocked(new.customer_phone) then
    raise exception 'cliente_bloqueado';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bookings_block_guard on public.bookings;
create trigger trg_bookings_block_guard
before insert on public.bookings
for each row execute function public.bookings_block_guard();

insert into public.blocked_customers (customer_phone, customer_name, reason)
values ('82981900299', 'Graziele Fernanda',
  '3 furos: no_show 28/07, cancelou em cima da hora 06/08, no_show 20/08 (8h45). Decisão do Juliano em 20/08/2026 — só encaixe manual pelo admin.');
