-- Barbearia OS V15.2 — execute uma vez no SQL Editor do Supabase.
-- Adiciona cadastro editável de clientes, preserva o histórico e mantém o CRM sincronizado.
create table if not exists public.customer_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 100),
  phone text not null unique check (phone ~ '^[0-9]{10,13}$'),
  email text,
  notes text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.customer_profiles enable row level security;
grant select,insert,update,delete on public.customer_profiles to authenticated;
drop policy if exists "admin read customer profiles" on public.customer_profiles;
drop policy if exists "admin insert customer profiles" on public.customer_profiles;
drop policy if exists "admin update customer profiles" on public.customer_profiles;
drop policy if exists "admin delete customer profiles" on public.customer_profiles;
create policy "admin read customer profiles" on public.customer_profiles for select to authenticated using (true);
create policy "admin insert customer profiles" on public.customer_profiles for insert to authenticated with check (true);
create policy "admin update customer profiles" on public.customer_profiles for update to authenticated using (true) with check (true);
create policy "admin delete customer profiles" on public.customer_profiles for delete to authenticated using (true);

-- Importa os clientes já existentes, usando o agendamento mais recente de cada telefone.
insert into public.customer_profiles(name,phone,email)
select distinct on (regexp_replace(customer_phone,'\\D','','g'))
  customer_name,
  regexp_replace(customer_phone,'\\D','','g'),
  nullif(lower(trim(customer_email)),'')
from public.bookings
where char_length(regexp_replace(customer_phone,'\\D','','g')) between 10 and 13
order by regexp_replace(customer_phone,'\\D','','g'), booking_date desc, created_at desc
on conflict (phone) do update set
  name=excluded.name,
  email=coalesce(excluded.email,public.customer_profiles.email),
  archived=false,
  updated_at=now();

create or replace function public.sync_booking_customer_profile()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_phone text;
begin
  v_phone:=regexp_replace(new.customer_phone,'\\D','','g');
  if char_length(v_phone) between 10 and 13 then
    insert into public.customer_profiles(name,phone,email,archived,updated_at)
    values(trim(new.customer_name),v_phone,nullif(lower(trim(new.customer_email)),''),false,now())
    on conflict (phone) do update set
      name=excluded.name,
      email=coalesce(excluded.email,public.customer_profiles.email),
      archived=false,
      updated_at=now();
  end if;
  return new;
end $$;
drop trigger if exists bookings_sync_customer_profile on public.bookings;
create trigger bookings_sync_customer_profile
after insert or update of customer_name,customer_phone,customer_email on public.bookings
for each row execute function public.sync_booking_customer_profile();

create or replace function public.admin_save_customer(
  p_customer_id uuid,
  p_name text,
  p_phone text,
  p_email text default null,
  p_notes text default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_old_phone text; v_phone text;
begin
  v_phone:=regexp_replace(p_phone,'\\D','','g');
  if char_length(trim(p_name))<2 then raise exception 'Nome inválido.'; end if;
  if char_length(v_phone) not between 10 and 13 then raise exception 'WhatsApp inválido.'; end if;
  if p_customer_id is null then
    insert into public.customer_profiles(name,phone,email,notes,archived)
    values(trim(p_name),v_phone,nullif(lower(trim(p_email)),''),nullif(trim(p_notes),''),false)
    on conflict (phone) do update set name=excluded.name,email=excluded.email,notes=excluded.notes,archived=false,updated_at=now()
    returning id into v_id;
  else
    select phone into v_old_phone from public.customer_profiles where id=p_customer_id;
    if v_old_phone is null then raise exception 'Cliente não encontrado.'; end if;
    update public.bookings set
      customer_name=trim(p_name),
      customer_phone=v_phone,
      customer_email=nullif(lower(trim(p_email)),'')
    where regexp_replace(customer_phone,'\\D','','g')=v_old_phone;
    update public.customer_profiles set
      name=trim(p_name),phone=v_phone,email=nullif(lower(trim(p_email)),''),notes=nullif(trim(p_notes),''),archived=false,updated_at=now()
    where id=p_customer_id returning id into v_id;
  end if;
  return v_id;
end $$;
grant execute on function public.admin_save_customer(uuid,text,text,text,text) to authenticated;

create or replace function public.admin_archive_customer(p_customer_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  update public.customer_profiles set archived=true,updated_at=now() where id=p_customer_id;
  if not found then raise exception 'Cliente não encontrado.'; end if;
end $$;
grant execute on function public.admin_archive_customer(uuid) to authenticated;
