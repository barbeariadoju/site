-- Barbearia OS V15.3 — data de nascimento e inteligência de aniversários.
-- Execute uma vez no SQL Editor do Supabase.
alter table public.customer_profiles
  add column if not exists birth_date date;

alter table public.customer_profiles
  drop constraint if exists customer_profiles_birth_date_valid;
alter table public.customer_profiles
  add constraint customer_profiles_birth_date_valid
  check (birth_date is null or (birth_date >= date '1900-01-01' and birth_date <= current_date));

create or replace function public.admin_save_customer(
  p_customer_id uuid,
  p_name text,
  p_phone text,
  p_email text default null,
  p_birth_date date default null,
  p_notes text default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_old_phone text; v_phone text;
begin
  v_phone:=regexp_replace(p_phone,'\D','','g');
  if char_length(trim(p_name))<2 then raise exception 'Nome inválido.'; end if;
  if char_length(v_phone) not between 10 and 13 then raise exception 'WhatsApp inválido.'; end if;
  if p_birth_date is not null and (p_birth_date < date '1900-01-01' or p_birth_date > current_date) then raise exception 'Data de nascimento inválida.'; end if;
  if p_customer_id is null then
    insert into public.customer_profiles(name,phone,email,birth_date,notes,archived)
    values(trim(p_name),v_phone,nullif(lower(trim(p_email)),''),p_birth_date,nullif(trim(p_notes),''),false)
    on conflict (phone) do update set name=excluded.name,email=excluded.email,birth_date=coalesce(excluded.birth_date,public.customer_profiles.birth_date),notes=excluded.notes,archived=false,updated_at=now()
    returning id into v_id;
  else
    select phone into v_old_phone from public.customer_profiles where id=p_customer_id;
    if v_old_phone is null then raise exception 'Cliente não encontrado.'; end if;
    update public.bookings set
      customer_name=trim(p_name),
      customer_phone=v_phone,
      customer_email=nullif(lower(trim(p_email)),'')
    where regexp_replace(customer_phone,'\D','','g')=v_old_phone;
    update public.customer_profiles set
      name=trim(p_name),phone=v_phone,email=nullif(lower(trim(p_email)),''),birth_date=p_birth_date,notes=nullif(trim(p_notes),''),archived=false,updated_at=now()
    where id=p_customer_id returning id into v_id;
  end if;
  return v_id;
end $$;

grant execute on function public.admin_save_customer(uuid,text,text,text,date,text) to authenticated;
