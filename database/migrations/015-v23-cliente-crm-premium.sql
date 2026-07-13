-- Barbearia OS V23 — Área do Cliente Inteligente + CRM Premium.
-- Execute uma vez no SQL Editor do Supabase. Seguro para reexecução.

alter table public.customer_profiles
  add column if not exists preferred_services jsonb not null default '[]'::jsonb,
  add column if not exists style_preferences jsonb not null default '{}'::jsonb,
  add column if not exists favorite_products jsonb not null default '[]'::jsonb,
  add column if not exists internal_tags text[] not null default '{}'::text[],
  add column if not exists vip boolean not null default false,
  add column if not exists preferred_payment text,
  add column if not exists return_interval_days integer,
  add column if not exists last_contact_at timestamptz;

alter table public.customer_profiles drop constraint if exists customer_profiles_return_interval_valid;
alter table public.customer_profiles add constraint customer_profiles_return_interval_valid
check (return_interval_days is null or return_interval_days between 7 and 120);

grant select,insert,update,delete on public.customer_profiles to authenticated;

create or replace function public.admin_save_customer_v23(
  p_customer_id uuid,
  p_name text,
  p_phone text,
  p_email text default null,
  p_birth_date date default null,
  p_notes text default null,
  p_preferred_services jsonb default '[]'::jsonb,
  p_style_preferences jsonb default '{}'::jsonb,
  p_favorite_products jsonb default '[]'::jsonb,
  p_internal_tags text[] default '{}'::text[],
  p_vip boolean default false,
  p_preferred_payment text default null,
  p_return_interval_days integer default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_old_phone text; v_phone text;
begin
  if auth.uid() is null then raise exception 'Acesso não autorizado.'; end if;
  v_phone:=regexp_replace(p_phone,'\D','','g');
  if char_length(trim(p_name))<2 then raise exception 'Nome inválido.'; end if;
  if char_length(v_phone) not between 10 and 13 then raise exception 'WhatsApp inválido.'; end if;
  if p_birth_date is not null and (p_birth_date < date '1900-01-01' or p_birth_date > current_date) then raise exception 'Data de nascimento inválida.'; end if;
  if p_return_interval_days is not null and p_return_interval_days not between 7 and 120 then raise exception 'Intervalo de retorno inválido.'; end if;

  if p_customer_id is null then
    insert into public.customer_profiles(
      name,phone,email,birth_date,notes,archived,preferred_services,style_preferences,
      favorite_products,internal_tags,vip,preferred_payment,return_interval_days
    ) values(
      trim(p_name),v_phone,nullif(lower(trim(p_email)),''),p_birth_date,nullif(trim(p_notes),''),false,
      coalesce(p_preferred_services,'[]'::jsonb),coalesce(p_style_preferences,'{}'::jsonb),
      coalesce(p_favorite_products,'[]'::jsonb),coalesce(p_internal_tags,'{}'::text[]),coalesce(p_vip,false),
      nullif(trim(p_preferred_payment),''),p_return_interval_days
    ) on conflict(phone) do update set
      name=excluded.name,email=excluded.email,birth_date=coalesce(excluded.birth_date,public.customer_profiles.birth_date),
      notes=excluded.notes,archived=false,preferred_services=excluded.preferred_services,
      style_preferences=excluded.style_preferences,favorite_products=excluded.favorite_products,
      internal_tags=excluded.internal_tags,vip=excluded.vip,preferred_payment=excluded.preferred_payment,
      return_interval_days=excluded.return_interval_days,updated_at=now()
    returning id into v_id;
  else
    select phone into v_old_phone from public.customer_profiles where id=p_customer_id;
    if v_old_phone is null then raise exception 'Cliente não encontrado.'; end if;
    update public.bookings set customer_name=trim(p_name),customer_phone=v_phone,customer_email=nullif(lower(trim(p_email)),'')
      where regexp_replace(customer_phone,'\D','','g')=regexp_replace(v_old_phone,'\D','','g');
    update public.customer_profiles set
      name=trim(p_name),phone=v_phone,email=nullif(lower(trim(p_email)),''),birth_date=p_birth_date,
      notes=nullif(trim(p_notes),''),archived=false,preferred_services=coalesce(p_preferred_services,'[]'::jsonb),
      style_preferences=coalesce(p_style_preferences,'{}'::jsonb),favorite_products=coalesce(p_favorite_products,'[]'::jsonb),
      internal_tags=coalesce(p_internal_tags,'{}'::text[]),vip=coalesce(p_vip,false),
      preferred_payment=nullif(trim(p_preferred_payment),''),return_interval_days=p_return_interval_days,updated_at=now()
    where id=p_customer_id returning id into v_id;
  end if;
  insert into public.loyalty_accounts(customer_id) values(v_id) on conflict(customer_id) do nothing;
  return v_id;
end $$;

grant execute on function public.admin_save_customer_v23(uuid,text,text,text,date,text,jsonb,jsonb,jsonb,text[],boolean,text,integer) to authenticated;

create or replace function public.get_public_customer_summary(p_phone text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_phone text:=regexp_replace(p_phone,'\D','','g'); v_result jsonb;
begin
  if char_length(v_phone) not between 10 and 13 then return '{}'::jsonb; end if;
  select jsonb_build_object(
    'found',true,
    'first_name',split_part(trim(c.name),' ',1),
    'points',coalesce(l.points,0),
    'rewards_available',coalesce(l.rewards_available,0),
    'completed_visits',(select count(*) from public.bookings b where regexp_replace(b.customer_phone,'\D','','g')=v_phone and b.status='completed'),
    'last_services',(select b.service_name from public.bookings b where regexp_replace(b.customer_phone,'\D','','g')=v_phone and b.status='completed' order by b.booking_date desc,b.start_time desc limit 1),
    'last_visit',(select b.booking_date from public.bookings b where regexp_replace(b.customer_phone,'\D','','g')=v_phone and b.status='completed' order by b.booking_date desc,b.start_time desc limit 1),
    'next_booking',(select jsonb_build_object('date',b.booking_date,'time',left(b.start_time::text,5),'services',b.service_name,'status',b.status) from public.bookings b where regexp_replace(b.customer_phone,'\D','','g')=v_phone and b.status in ('pending','confirmed') and b.booking_date>=current_date order by b.booking_date,b.start_time limit 1),
    'return_interval_days',c.return_interval_days
  ) into v_result
  from public.customer_profiles c left join public.loyalty_accounts l on l.customer_id=c.id
  where regexp_replace(c.phone,'\D','','g')=v_phone and c.archived=false limit 1;
  return coalesce(v_result,jsonb_build_object('found',false));
end $$;

revoke all on function public.get_public_customer_summary(text) from public;
grant execute on function public.get_public_customer_summary(text) to anon,authenticated,service_role;

create or replace function public.get_customer_commercial_context(p_phone text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_phone text:=regexp_replace(p_phone,'\D','','g'); v_result jsonb;
begin
 select jsonb_build_object(
   'customer_id',c.id,'name',c.name,'email',c.email,'birth_date',c.birth_date,'vip',c.vip,
   'preferred_services',c.preferred_services,'style_preferences',c.style_preferences,
   'favorite_products',c.favorite_products,'internal_tags',c.internal_tags,
   'preferred_payment',c.preferred_payment,'return_interval_days',c.return_interval_days,
   'points',coalesce(l.points,0),'rewards_available',coalesce(l.rewards_available,0),
   'completed_visits',(select count(*) from public.bookings b where regexp_replace(b.customer_phone,'\D','','g')=v_phone and b.status='completed'),
   'last_services',(select b.service_name from public.bookings b where regexp_replace(b.customer_phone,'\D','','g')=v_phone and b.status='completed' order by b.booking_date desc,b.start_time desc limit 1),
   'last_visit',(select b.booking_date from public.bookings b where regexp_replace(b.customer_phone,'\D','','g')=v_phone and b.status='completed' order by b.booking_date desc,b.start_time desc limit 1),
   'last_products',(select b.selected_products from public.bookings b where regexp_replace(b.customer_phone,'\D','','g')=v_phone and jsonb_array_length(coalesce(b.selected_products,'[]'::jsonb))>0 order by b.booking_date desc limit 1)
 ) into v_result
 from public.customer_profiles c left join public.loyalty_accounts l on l.customer_id=c.id
 where regexp_replace(c.phone,'\D','','g')=v_phone and c.archived=false limit 1;
 return coalesce(v_result,'{}'::jsonb);
end $$;
grant execute on function public.get_customer_commercial_context(text) to service_role,authenticated;
