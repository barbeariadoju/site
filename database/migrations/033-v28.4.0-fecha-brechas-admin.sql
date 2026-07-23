-- Barbearia do Ju — V28.4.0
-- Auditoria de segurança: várias funções SECURITY DEFINER com prefixo
-- "admin_" só checavam "auth.uid() is null" (ou seja, "tem algum login?"),
-- não "public.is_admin()" (que já existe e é usado em quase todas as
-- policies). Isso significa que qualquer usuário autenticado (não só o
-- Juliano) conseguia criar/remarcar agendamentos, editar clientes e apagar
-- clientes permanentemente. admin_create_booking, admin_reschedule_booking
-- e admin_save_customer_v23 também tinham EXECUTE liberado pra PUBLIC
-- (desnecessário, já que a policy interna deveria bastar).
--
-- Também corrige 4 policies (integration_alerts, sms_queue,
-- whatsapp_conversations, whatsapp_messages) que usavam "true" em vez de
-- is_admin() — qualquer usuário autenticado (não só admin) conseguia ler
-- conversas e mensagens de WhatsApp de clientes.

create or replace function public.admin_create_booking(
  p_customer_name text, p_customer_phone text, p_service_name text,
  p_service_price numeric, p_duration_minutes integer, p_booking_date date,
  p_start_time time without time zone, p_notes text default null::text
) returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid; v_end time;
begin
 if not public.is_admin() then raise exception 'Acesso não autorizado.'; end if;
 if extract(dow from p_booking_date) in (0,1) then raise exception 'A barbearia não abre neste dia.'; end if;
 v_end:=p_start_time+make_interval(mins=>p_duration_minutes);
 if (extract(dow from p_booking_date)=6 and (p_start_time<'08:00' or p_start_time>'15:00')) or (extract(dow from p_booking_date) between 2 and 5 and (p_start_time<'08:00' or p_start_time>'19:00')) then raise exception 'Horário fora do atendimento.'; end if;
 if exists(select 1 from public.schedule_blocks s where s.block_date=p_booking_date and (s.all_day or (p_start_time<s.end_time and v_end>s.start_time))) then raise exception 'Este horário está bloqueado.'; end if;
 if exists(select 1 from public.bookings b where b.booking_date=p_booking_date and b.status in ('pending','confirmed') and p_start_time<b.end_time and v_end>b.start_time) then raise exception 'Este período está indisponível.'; end if;
 insert into public.bookings(customer_name,customer_phone,service_name,service_price,duration_minutes,booking_date,start_time,notes,status)
 values(trim(p_customer_name),regexp_replace(p_customer_phone,'\D','','g'),p_service_name,p_service_price,p_duration_minutes,p_booking_date,p_start_time,nullif(trim(p_notes),''),'confirmed') returning id into v_id;
 return v_id;
end $$;

revoke execute on function public.admin_create_booking(text,text,text,numeric,integer,date,time,text) from public;
grant execute on function public.admin_create_booking(text,text,text,numeric,integer,date,time,text) to authenticated, service_role;

create or replace function public.admin_reschedule_booking(
  p_booking_id uuid, p_booking_date date, p_start_time time without time zone,
  p_service_name text, p_service_price numeric, p_duration_minutes integer,
  p_notes text default null::text
) returns void language plpgsql security definer set search_path to 'public' as $$
declare v_end time;
begin
 if not public.is_admin() then raise exception 'Acesso não autorizado.'; end if;
 if extract(dow from p_booking_date) in (0,1) then raise exception 'A barbearia não abre neste dia.'; end if;
 v_end:=p_start_time+make_interval(mins=>p_duration_minutes);
 if (extract(dow from p_booking_date)=6 and (p_start_time<'08:00' or p_start_time>'15:00')) or (extract(dow from p_booking_date) between 2 and 5 and (p_start_time<'08:00' or p_start_time>'19:00')) then raise exception 'Horário fora do atendimento.'; end if;
 if exists(select 1 from public.schedule_blocks s where s.block_date=p_booking_date and (s.all_day or (p_start_time<s.end_time and v_end>s.start_time))) then raise exception 'Este horário está bloqueado.'; end if;
 if exists(select 1 from public.bookings b where b.id<>p_booking_id and b.booking_date=p_booking_date and b.status in ('pending','confirmed') and p_start_time<b.end_time and v_end>b.start_time) then raise exception 'Este período está indisponível.'; end if;
 update public.bookings set booking_date=p_booking_date,start_time=p_start_time,service_name=p_service_name,service_price=p_service_price,duration_minutes=p_duration_minutes,notes=nullif(trim(p_notes),''),status='confirmed',updated_at=now() where id=p_booking_id;
 if not found then raise exception 'Agendamento não encontrado.'; end if;
end $$;

revoke execute on function public.admin_reschedule_booking(uuid,date,time,text,numeric,integer,text) from public;
grant execute on function public.admin_reschedule_booking(uuid,date,time,text,numeric,integer,text) to authenticated, service_role;

create or replace function public.admin_save_customer_v23(
  p_customer_id uuid, p_name text, p_phone text, p_email text default null::text,
  p_birth_date date default null::date, p_notes text default null::text,
  p_preferred_services jsonb default '[]'::jsonb, p_style_preferences jsonb default '{}'::jsonb,
  p_favorite_products jsonb default '[]'::jsonb, p_internal_tags text[] default '{}'::text[],
  p_vip boolean default false, p_preferred_payment text default null::text,
  p_return_interval_days integer default null::integer
) returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid; v_old_phone text; v_phone text;
begin
  if not public.is_admin() then raise exception 'Acesso não autorizado.'; end if;
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

revoke execute on function public.admin_save_customer_v23(uuid,text,text,text,date,text,jsonb,jsonb,jsonb,text[],boolean,text,integer) from public;
grant execute on function public.admin_save_customer_v23(uuid,text,text,text,date,text,jsonb,jsonb,jsonb,text[],boolean,text,integer) to authenticated, service_role;

create or replace function public.admin_delete_customer_permanently(p_customer_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $$
declare
  v_phone text;
begin
  if not public.is_admin() then
    raise exception 'Acesso não autorizado.';
  end if;

  select regexp_replace(phone, '\D', '', 'g')
    into v_phone
  from public.customer_profiles
  where id = p_customer_id;

  if v_phone is null then
    raise exception 'Cliente não encontrado.';
  end if;

  delete from public.bookings
  where regexp_replace(customer_phone, '\D', '', 'g') = v_phone;

  delete from public.customer_profiles
  where id = p_customer_id;
end;
$$;

-- Policies que usavam "true" em vez de is_admin() — liberavam leitura/escrita
-- de conversas e mensagens de WhatsApp, e fila de SMS, pra qualquer usuário
-- autenticado (não só o admin).
drop policy if exists "admin read integration alerts" on public.integration_alerts;
create policy "admin read integration alerts" on public.integration_alerts
  for select to authenticated using (is_admin());

drop policy if exists "admin read sms queue" on public.sms_queue;
create policy "admin read sms queue" on public.sms_queue
  for select to authenticated using (is_admin());

drop policy if exists "admin update sms queue" on public.sms_queue;
create policy "admin update sms queue" on public.sms_queue
  for update to authenticated using (is_admin()) with check (is_admin());

drop policy if exists "admin read whatsapp conversations" on public.whatsapp_conversations;
create policy "admin read whatsapp conversations" on public.whatsapp_conversations
  for select to authenticated using (is_admin());

drop policy if exists "admin update whatsapp conversations" on public.whatsapp_conversations;
create policy "admin update whatsapp conversations" on public.whatsapp_conversations
  for update to authenticated using (is_admin()) with check (is_admin());

drop policy if exists "admin read whatsapp messages" on public.whatsapp_messages;
create policy "admin read whatsapp messages" on public.whatsapp_messages
  for select to authenticated using (is_admin());

notify pgrst, 'reload schema';
