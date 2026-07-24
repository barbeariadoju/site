-- Barbearia do Ju — V28.11.0
-- Permite ao admin (só admin — funções continuam SECURITY DEFINER com is_admin())
-- criar/remarcar agendamentos fora do horário normal de funcionamento (ex.: antes das 8h,
-- depois das 19h/15h de sábado, ou domingo/segunda). Parâmetro novo com default 'false',
-- então o comportamento público (create_public_booking_v15, usado pelo site e pela JuIA)
-- e qualquer chamada existente sem esse parâmetro continuam exatamente como antes.
-- Bloqueios manuais (schedule_blocks) e choque de horário com outro agendamento continuam
-- sempre proibidos, mesmo com a exceção ativada — isso evita encaixe duplicado sem querer.

-- Importante: mudar a lista de parâmetros faz o Postgres criar uma SOBRECARGA nova em vez
-- de substituir a função antiga (CREATE OR REPLACE só substitui com assinatura idêntica).
-- Sem este DROP, ficam duas versões (8 e 9 parâmetros) e chamadas existentes passam a
-- correr risco de erro de "função ambígua". Remove a assinatura antiga antes de recriar.
drop function if exists public.admin_create_booking(text, text, text, numeric, integer, date, time without time zone, text);
drop function if exists public.admin_reschedule_booking(uuid, date, time without time zone, text, numeric, integer, text);

create or replace function public.admin_create_booking(
  p_customer_name text,
  p_customer_phone text,
  p_service_name text,
  p_service_price numeric,
  p_duration_minutes integer,
  p_booking_date date,
  p_start_time time without time zone,
  p_notes text default null::text,
  p_allow_outside_hours boolean default false
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_id uuid; v_end time;
begin
  if not public.is_admin() then raise exception 'Acesso não autorizado.'; end if;
  if not p_allow_outside_hours then
    if extract(dow from p_booking_date) in (0,1) then raise exception 'A barbearia não abre neste dia.'; end if;
  end if;
  v_end:=p_start_time+make_interval(mins=>p_duration_minutes);
  if not p_allow_outside_hours then
    if (extract(dow from p_booking_date)=6 and (p_start_time<'08:00' or p_start_time>'15:00')) or (extract(dow from p_booking_date) between 2 and 5 and (p_start_time<'08:00' or p_start_time>'19:00')) then raise exception 'Horário fora do atendimento.'; end if;
  end if;
  if exists(select 1 from public.schedule_blocks s where s.block_date=p_booking_date and (s.all_day or (p_start_time<s.end_time and v_end>s.start_time))) then raise exception 'Este horário está bloqueado.'; end if;
  if exists(select 1 from public.bookings b where b.booking_date=p_booking_date and b.status in ('pending','confirmed') and p_start_time<b.end_time and v_end>b.start_time) then raise exception 'Este período está indisponível.'; end if;
  insert into public.bookings(customer_name,customer_phone,service_name,service_price,duration_minutes,booking_date,start_time,notes,status)
  values(trim(p_customer_name),regexp_replace(p_customer_phone,'\D','','g'),p_service_name,p_service_price,p_duration_minutes,p_booking_date,p_start_time,nullif(trim(p_notes),''),'confirmed') returning id into v_id;
  return v_id;
end $function$;

create or replace function public.admin_reschedule_booking(
  p_booking_id uuid,
  p_booking_date date,
  p_start_time time without time zone,
  p_service_name text,
  p_service_price numeric,
  p_duration_minutes integer,
  p_notes text default null::text,
  p_allow_outside_hours boolean default false
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_end time;
begin
  if not public.is_admin() then raise exception 'Acesso não autorizado.'; end if;
  if not p_allow_outside_hours then
    if extract(dow from p_booking_date) in (0,1) then raise exception 'A barbearia não abre neste dia.'; end if;
  end if;
  v_end:=p_start_time+make_interval(mins=>p_duration_minutes);
  if not p_allow_outside_hours then
    if (extract(dow from p_booking_date)=6 and (p_start_time<'08:00' or p_start_time>'15:00')) or (extract(dow from p_booking_date) between 2 and 5 and (p_start_time<'08:00' or p_start_time>'19:00')) then raise exception 'Horário fora do atendimento.'; end if;
  end if;
  if exists(select 1 from public.schedule_blocks s where s.block_date=p_booking_date and (s.all_day or (p_start_time<s.end_time and v_end>s.start_time))) then raise exception 'Este horário está bloqueado.'; end if;
  if exists(select 1 from public.bookings b where b.id<>p_booking_id and b.booking_date=p_booking_date and b.status in ('pending','confirmed') and p_start_time<b.end_time and v_end>b.start_time) then raise exception 'Este período está indisponível.'; end if;
  update public.bookings set booking_date=p_booking_date,start_time=p_start_time,service_name=p_service_name,service_price=p_service_price,duration_minutes=p_duration_minutes,notes=nullif(trim(p_notes),''),status='confirmed',updated_at=now() where id=p_booking_id;
  if not found then raise exception 'Agendamento não encontrado.'; end if;
end $function$;

notify pgrst, 'reload schema';
