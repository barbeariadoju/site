-- Execute UMA VEZ no SQL Editor do Supabase.
-- Consolida criação manual, remarcação e melhora consultas do CRM.

grant insert, select, update on table public.bookings to authenticated;

create index if not exists bookings_customer_phone_idx on public.bookings(customer_phone);
create index if not exists bookings_customer_date_idx on public.bookings(customer_phone, booking_date desc);

create or replace function public.admin_create_booking(
 p_customer_name text,p_customer_phone text,p_service_name text,p_service_price numeric,p_duration_minutes integer,p_booking_date date,p_start_time time,p_notes text default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_end time;
begin
 if auth.uid() is null then raise exception 'Acesso não autorizado.'; end if;
 if extract(dow from p_booking_date) in (0,1) then raise exception 'A barbearia não abre neste dia.'; end if;
 v_end:=p_start_time+make_interval(mins=>p_duration_minutes);
 if (extract(dow from p_booking_date)=6 and (p_start_time<'08:00' or p_start_time>'15:00')) or (extract(dow from p_booking_date) between 2 and 5 and (p_start_time<'08:00' or p_start_time>'19:00')) then raise exception 'Horário fora do atendimento.'; end if;
 if exists(select 1 from public.schedule_blocks s where s.block_date=p_booking_date and (s.all_day or (p_start_time<s.end_time and v_end>s.start_time))) then raise exception 'Este horário está bloqueado.'; end if;
 if exists(select 1 from public.bookings b where b.booking_date=p_booking_date and b.status in ('pending','confirmed') and p_start_time<b.end_time and v_end>b.start_time) then raise exception 'Este período está indisponível.'; end if;
 insert into public.bookings(customer_name,customer_phone,service_name,service_price,duration_minutes,booking_date,start_time,notes,status)
 values(trim(p_customer_name),regexp_replace(p_customer_phone,'\D','','g'),p_service_name,p_service_price,p_duration_minutes,p_booking_date,p_start_time,nullif(trim(p_notes),''),'confirmed') returning id into v_id;
 return v_id;
end $$;
grant execute on function public.admin_create_booking(text,text,text,numeric,integer,date,time,text) to authenticated;

create or replace function public.admin_reschedule_booking(
 p_booking_id uuid,p_booking_date date,p_start_time time,p_service_name text,p_service_price numeric,p_duration_minutes integer,p_notes text default null
) returns void language plpgsql security definer set search_path=public as $$
declare v_end time;
begin
 if auth.uid() is null then raise exception 'Acesso não autorizado.'; end if;
 if extract(dow from p_booking_date) in (0,1) then raise exception 'A barbearia não abre neste dia.'; end if;
 v_end:=p_start_time+make_interval(mins=>p_duration_minutes);
 if (extract(dow from p_booking_date)=6 and (p_start_time<'08:00' or p_start_time>'15:00')) or (extract(dow from p_booking_date) between 2 and 5 and (p_start_time<'08:00' or p_start_time>'19:00')) then raise exception 'Horário fora do atendimento.'; end if;
 if exists(select 1 from public.schedule_blocks s where s.block_date=p_booking_date and (s.all_day or (p_start_time<s.end_time and v_end>s.start_time))) then raise exception 'Este horário está bloqueado.'; end if;
 if exists(select 1 from public.bookings b where b.id<>p_booking_id and b.booking_date=p_booking_date and b.status in ('pending','confirmed') and p_start_time<b.end_time and v_end>b.start_time) then raise exception 'Este período está indisponível.'; end if;
 update public.bookings set booking_date=p_booking_date,start_time=p_start_time,service_name=p_service_name,service_price=p_service_price,duration_minutes=p_duration_minutes,notes=nullif(trim(p_notes),''),status='confirmed',updated_at=now() where id=p_booking_id;
 if not found then raise exception 'Agendamento não encontrado.'; end if;
end $$;
grant execute on function public.admin_reschedule_booking(uuid,date,time,text,numeric,integer,text) to authenticated;
