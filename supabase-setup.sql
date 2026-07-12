-- Execute no SQL Editor do Supabase
create extension if not exists pgcrypto;
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null check (char_length(customer_name) between 2 and 100),
  customer_phone text not null check (customer_phone ~ '^[0-9]{10,13}$'),
  service_name text not null,
  service_price numeric(10,2) not null check (service_price >= 0),
  duration_minutes integer not null check (duration_minutes between 10 and 240),
  booking_date date not null,
  start_time time not null,
  end_time time generated always as (start_time + make_interval(mins => duration_minutes)) stored,
  status text not null default 'pending' check (status in ('pending','confirmed','cancelled','completed','no_show')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists bookings_date_idx on public.bookings (booking_date,start_time);
alter table public.bookings enable row level security;
create policy "admin read" on public.bookings for select to authenticated using (true);
create policy "admin update" on public.bookings for update to authenticated using (true) with check (true);

create or replace function public.create_public_booking(
 p_customer_name text,p_customer_phone text,p_service_name text,p_service_price numeric,p_duration_minutes integer,p_booking_date date,p_start_time time,p_notes text default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_end time;
begin
 if p_booking_date < current_date then raise exception 'A data escolhida já passou.'; end if;
 if extract(dow from p_booking_date) in (0,1) then raise exception 'A barbearia não abre neste dia.'; end if;
 v_end := p_start_time + make_interval(mins=>p_duration_minutes);
 if (extract(dow from p_booking_date)=6 and (p_start_time<'08:30' or p_start_time>'15:00')) or (extract(dow from p_booking_date) between 2 and 5 and (p_start_time<'08:30' or p_start_time>'19:00')) then raise exception 'Horário fora do atendimento.'; end if;
 if exists(select 1 from public.bookings b where b.booking_date=p_booking_date and b.status in ('pending','confirmed') and p_start_time < b.end_time and v_end > b.start_time) then raise exception 'Este horário ficou indisponível. Escolha outro.'; end if;
 insert into public.bookings(customer_name,customer_phone,service_name,service_price,duration_minutes,booking_date,start_time,notes) values(trim(p_customer_name),regexp_replace(p_customer_phone,'\\D','','g'),p_service_name,p_service_price,p_duration_minutes,p_booking_date,p_start_time,nullif(trim(p_notes),'')) returning id into v_id;
 return v_id;
end $$;
grant execute on function public.create_public_booking(text,text,text,numeric,integer,date,time,text) to anon, authenticated;

create or replace function public.get_available_slots(p_date date,p_duration_minutes integer)
returns table(slot_time time) language plpgsql security definer set search_path=public as $$
declare open_m integer; close_m integer; m integer; s time; e time;
begin
 if extract(dow from p_date) in (0,1) then return; end if;
 open_m:=8*60+30; close_m:=case when extract(dow from p_date)=6 then 15*60 else 19*60 end;
 m:=open_m;
 while m<=close_m loop
  s:=make_time(m/60,m%60,0); e:=s+make_interval(mins=>p_duration_minutes);
  if not exists(select 1 from public.bookings b where b.booking_date=p_date and b.status in ('pending','confirmed') and s<b.end_time and e>b.start_time) then slot_time:=s; return next; end if;
  m:=m+15;
 end loop;
end $$;
grant execute on function public.get_available_slots(date,integer) to anon, authenticated;

-- Permissões necessárias para o painel administrativo autenticado
grant usage on schema public to authenticated;
grant select, update on table public.bookings to authenticated;
