-- v29.9.0 — o Juliano atende desde 12/03/2026, mas o Barbearia OS só entrou em uso
-- ~1 semana atrás. Clientes antigos e fiéis (ex. Sabrino, Caio) apareceriam como "1ª
-- visita"/"cliente novo" no sistema mesmo já sendo clientões de longa data. prior_visits
-- deixa o Juliano registrar manualmente quantas vezes esse cliente já veio ANTES do
-- sistema existir; esse número entra como base no cálculo do nº de visita (badge da
-- Agenda) e na classificação novo×recorrente dos Relatórios.
alter table public.customer_profiles add column if not exists prior_visits integer not null default 0;
alter table public.customer_profiles drop constraint if exists customer_profiles_prior_visits_check;
alter table public.customer_profiles add constraint customer_profiles_prior_visits_check check (prior_visits >= 0 and prior_visits <= 999);

drop function if exists public.admin_save_customer_v23(uuid,text,text,text,date,text,jsonb,jsonb,jsonb,text[],boolean,text,integer);

create function public.admin_save_customer_v23(
  p_customer_id uuid, p_name text, p_phone text, p_email text default null, p_birth_date date default null,
  p_notes text default null, p_preferred_services jsonb default '[]'::jsonb, p_style_preferences jsonb default '{}'::jsonb,
  p_favorite_products jsonb default '[]'::jsonb, p_internal_tags text[] default '{}'::text[], p_vip boolean default false,
  p_preferred_payment text default null, p_return_interval_days integer default null, p_prior_visits integer default 0
) returns uuid
language plpgsql security definer set search_path to 'public'
as $function$
declare v_id uuid; v_old_phone text; v_phone text;
begin
  if not public.is_admin() then raise exception 'Acesso não autorizado.'; end if;
  v_phone:=regexp_replace(p_phone,'\D','','g');
  if char_length(trim(p_name))<2 then raise exception 'Nome inválido.'; end if;
  if char_length(v_phone) not between 10 and 13 then raise exception 'WhatsApp inválido.'; end if;
  if p_birth_date is not null and (p_birth_date < date '1900-01-01' or p_birth_date > current_date) then raise exception 'Data de nascimento inválida.'; end if;
  if p_return_interval_days is not null and p_return_interval_days not between 7 and 120 then raise exception 'Intervalo de retorno inválido.'; end if;
  if coalesce(p_prior_visits,0) not between 0 and 999 then raise exception 'Nº de visitas anteriores inválido.'; end if;

  if p_customer_id is null then
    insert into public.customer_profiles(
      name,phone,email,birth_date,notes,archived,preferred_services,style_preferences,
      favorite_products,internal_tags,vip,preferred_payment,return_interval_days,prior_visits
    ) values(
      trim(p_name),v_phone,nullif(lower(trim(p_email)),''),p_birth_date,nullif(trim(p_notes),''),false,
      coalesce(p_preferred_services,'[]'::jsonb),coalesce(p_style_preferences,'{}'::jsonb),
      coalesce(p_favorite_products,'[]'::jsonb),coalesce(p_internal_tags,'{}'::text[]),coalesce(p_vip,false),
      nullif(trim(p_preferred_payment),''),p_return_interval_days,coalesce(p_prior_visits,0)
    ) on conflict(phone) do update set
      name=excluded.name,email=excluded.email,birth_date=coalesce(excluded.birth_date,public.customer_profiles.birth_date),
      notes=excluded.notes,archived=false,preferred_services=excluded.preferred_services,
      style_preferences=excluded.style_preferences,favorite_products=excluded.favorite_products,
      internal_tags=excluded.internal_tags,vip=excluded.vip,preferred_payment=excluded.preferred_payment,
      return_interval_days=excluded.return_interval_days,prior_visits=excluded.prior_visits,updated_at=now()
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
      preferred_payment=nullif(trim(p_preferred_payment),''),return_interval_days=p_return_interval_days,
      prior_visits=coalesce(p_prior_visits,0),updated_at=now()
    where id=p_customer_id returning id into v_id;
  end if;
  insert into public.loyalty_accounts(customer_id) values(v_id) on conflict(customer_id) do nothing;
  return v_id;
end $function$;

grant execute on function public.admin_save_customer_v23(uuid,text,text,text,date,text,jsonb,jsonb,jsonb,text[],boolean,text,integer,integer) to authenticated, service_role;
