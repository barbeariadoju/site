-- 044-v28.13.0-reagendamento-e-troca-servico-whatsapp.sql
--
-- A JuIA ja sabe cancelar um agendamento sozinha (v28.12.0), mas quando o
-- cliente queria só mudar de dia/hora ela fazia cancelar + criar de novo como
-- dois passos separados — perde o historico do agendamento original e obriga
-- o cliente a repetir tudo (servico, nome, etc.) numa "criacao" nova.
--
-- Esta migration da à JuIA a capacidade de reagendar direto, no mesmo padrao
-- de seguranca do cancelamento: só quando o telefone de quem esta pedindo
-- bate com o telefone do agendamento (phone_match_key), nunca por token — e o
-- codigo do ju-ia-site so usa isso quando o canal é o WhatsApp (telefone
-- verificado pelo proprio canal), nunca no chat do site.
--
-- phone_reschedule_booking() é a versao autorizada por telefone da
-- customer_reschedule_booking_v25() (que é autorizada por management_token e
-- usada só pelo link de e-mail/SMS em manage-booking) — mesmas validacoes de
-- horario de funcionamento, bloqueio e conflito, so muda a forma de provar
-- que quem esta pedindo é dono do agendamento.
--
-- Corrige tambem uma brecha da migration 043: toda funcao security definer
-- que mexe em dado de cliente por aqui é travada com "revoke all ... from
-- public" + "grant ... to service_role" (é assim que customer_cancel_booking_v25
-- e customer_reschedule_booking_v25 sao protegidas desde a v25), mas
-- phone_upcoming_bookings e whatsapp_cancel_booking foram criadas na 043 sem
-- essa trava — ficaram com a permissao padrao do Supabase (EXECUTE liberado
-- pra anon/authenticated), ou seja, chamaveis direto pela chave publica do
-- site via PostgREST, sem passar pelo fluxo de confirmacao da JuIA nem
-- verificacao de canal WhatsApp. Corrigido travando as duas so pro
-- service_role, igual as demais.
--
-- Alem do reagendamento, esta migration tambem da à JuIA a capacidade de
-- TROCAR O SERVICO de um agendamento existente (ex.: cliente marcou "Corte" e
-- depois pede "pode trocar pra Barba?") sem mexer em data/horario — mesmo
-- padrao de seguranca (phone_match_key) e mesma logica de "so muda o que foi
-- pedido, preserva o resto do registro" do reagendamento. phone_change_booking_service()
-- reusa as mesmas checagens de conflito/bloqueio/horario de funcionamento que
-- phone_reschedule_booking(), porque um servico novo pode ter duracao
-- diferente e empurrar o fim do atendimento pra cima de outro agendamento ou
-- pra depois do horario de fechamento.

-- phone_upcoming_bookings ganha duration_minutes: o ju-ia-site precisa da
-- duracao do agendamento original para consultar get_available_slots antes
-- de reagendar (sem isso, teria que adivinhar ou fazer uma segunda consulta).
-- Precisa dropar antes: mudar as colunas de retorno de uma funcao existente
-- nao é permitido com create or replace.
drop function if exists public.phone_upcoming_bookings(text);

create or replace function public.phone_upcoming_bookings(p_phone text)
returns table(id uuid, booking_date date, start_time time, duration_minutes integer, service_name text, status text)
language sql
stable
security definer
set search_path to 'public'
as $$
  select b.id, b.booking_date, b.start_time, b.duration_minutes, b.service_name, b.status
  from public.bookings b
  where b.status in ('pending','confirmed')
    and public.phone_match_key(b.customer_phone) = public.phone_match_key(p_phone)
    and (
      b.booking_date > (timezone('America/Sao_Paulo', now()))::date
      or (b.booking_date = (timezone('America/Sao_Paulo', now()))::date
          and b.start_time > (timezone('America/Sao_Paulo', now()))::time)
    )
  order by b.booking_date, b.start_time
$$;

revoke all on function public.phone_upcoming_bookings(text) from public;
grant execute on function public.phone_upcoming_bookings(text) to service_role;

-- Mesma trava para a funcao de cancelamento criada na 043 (ver nota acima).
revoke all on function public.whatsapp_cancel_booking(text,uuid) from public;
grant execute on function public.whatsapp_cancel_booking(text,uuid) to service_role;

create or replace function public.phone_reschedule_booking(
  p_phone text,
  p_booking_id uuid,
  p_new_booking_date date,
  p_new_start_time time
)
returns setof public.bookings
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_booking public.bookings%rowtype;
  v_end time;
  v_close time;
  v_now_sp timestamp := timezone('America/Sao_Paulo', now());
  v_new_start timestamp;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'Agendamento não encontrado.'; end if;
  if public.phone_match_key(v_booking.customer_phone) <> public.phone_match_key(p_phone) then
    raise exception 'Este agendamento não pertence a este telefone.';
  end if;
  if v_booking.status not in ('pending','confirmed') then
    raise exception 'Este agendamento não pode mais ser reagendado.';
  end if;

  v_new_start := p_new_booking_date + p_new_start_time;
  if p_new_booking_date < v_now_sp::date then raise exception 'A data escolhida já passou.'; end if;
  if v_new_start < v_now_sp + interval '15 minutes' then raise exception 'Escolha um horário com pelo menos 15 minutos de antecedência.'; end if;
  if extract(dow from p_new_booking_date) in (0,1) then raise exception 'A barbearia não abre neste dia.'; end if;

  v_close := case when extract(dow from p_new_booking_date)=6 then '15:00'::time else '19:00'::time end;
  v_end := p_new_start_time + make_interval(mins => v_booking.duration_minutes);
  if p_new_start_time < '08:00'::time or v_end > v_close then raise exception 'Horário fora do atendimento.'; end if;

  if exists (
    select 1 from public.schedule_blocks s
    where s.block_date=p_new_booking_date
      and (s.all_day or (p_new_start_time<s.end_time and v_end>s.start_time))
  ) then raise exception 'Este horário está bloqueado. Escolha outro.'; end if;

  if exists (
    select 1 from public.bookings b
    where b.id<>p_booking_id
      and b.booking_date=p_new_booking_date
      and b.status in ('pending','confirmed')
      and p_new_start_time<b.end_time and v_end>b.start_time
  ) then raise exception 'Este horário ficou indisponível. Escolha outro.'; end if;

  insert into public.booking_customer_actions(
    booking_id,action,old_booking_date,old_start_time,new_booking_date,new_start_time
  ) values (
    p_booking_id,'rescheduled',v_booking.booking_date,v_booking.start_time,p_new_booking_date,p_new_start_time
  );

  update public.bookings set
    previous_booking_date=booking_date,
    previous_start_time=start_time,
    booking_date=p_new_booking_date,
    start_time=p_new_start_time,
    rescheduled_at=now(),
    updated_at=now(),
    status='confirmed'
  where id=p_booking_id;

  return query select * from public.bookings where id = p_booking_id;
end;
$function$;

revoke all on function public.phone_reschedule_booking(text,uuid,date,time) from public;
grant execute on function public.phone_reschedule_booking(text,uuid,date,time) to service_role;

-- 'service_changed' precisa entrar na lista de acoes permitidas antes de ser
-- usado por phone_change_booking_service() abaixo.
alter table public.booking_customer_actions drop constraint if exists booking_customer_actions_action_check;
alter table public.booking_customer_actions add constraint booking_customer_actions_action_check
  check (action in ('created_link','viewed','cancelled','rescheduled','service_changed'));
alter table public.booking_customer_actions add column if not exists old_service_name text;
alter table public.booking_customer_actions add column if not exists new_service_name text;

create or replace function public.phone_change_booking_service(
  p_phone text,
  p_booking_id uuid,
  p_service_name text,
  p_service_price numeric,
  p_duration_minutes integer
)
returns setof public.bookings
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_booking public.bookings%rowtype;
  v_end time;
  v_close time;
  v_now_sp timestamp := timezone('America/Sao_Paulo', now());
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'Agendamento não encontrado.'; end if;
  if public.phone_match_key(v_booking.customer_phone) <> public.phone_match_key(p_phone) then
    raise exception 'Este agendamento não pertence a este telefone.';
  end if;
  if v_booking.status not in ('pending','confirmed') then
    raise exception 'Este agendamento não pode mais ser alterado.';
  end if;
  if v_booking.booking_date::timestamp + v_booking.start_time::time <= v_now_sp then
    raise exception 'Não é possível alterar um horário que já começou.';
  end if;
  if p_duration_minutes is null or p_duration_minutes <= 0 then
    raise exception 'Duração do serviço inválida.';
  end if;

  v_close := case when extract(dow from v_booking.booking_date)=6 then '15:00'::time else '19:00'::time end;
  v_end := v_booking.start_time + make_interval(mins => p_duration_minutes);
  if v_booking.start_time < '08:00'::time or v_end > v_close then
    raise exception 'Esse serviço não cabe mais nesse horário — escolha outro horário ou fale com a barbearia.';
  end if;

  if exists (
    select 1 from public.schedule_blocks s
    where s.block_date=v_booking.booking_date
      and (s.all_day or (v_booking.start_time<s.end_time and v_end>s.start_time))
  ) then raise exception 'Este horário está bloqueado. Escolha outro.'; end if;

  if exists (
    select 1 from public.bookings b
    where b.id<>p_booking_id
      and b.booking_date=v_booking.booking_date
      and b.status in ('pending','confirmed')
      and v_booking.start_time<b.end_time and v_end>b.start_time
  ) then raise exception 'Esse serviço não cabe mais nesse horário — colide com outro agendamento.'; end if;

  insert into public.booking_customer_actions(
    booking_id,action,old_booking_date,old_start_time,new_booking_date,new_start_time,old_service_name,new_service_name
  ) values (
    p_booking_id,'service_changed',v_booking.booking_date,v_booking.start_time,v_booking.booking_date,v_booking.start_time,v_booking.service_name,p_service_name
  );

  update public.bookings set
    service_name=p_service_name,
    service_price=p_service_price,
    duration_minutes=p_duration_minutes,
    updated_at=now()
  where id=p_booking_id;

  return query select * from public.bookings where id = p_booking_id;
end;
$function$;

revoke all on function public.phone_change_booking_service(text,uuid,text,numeric,integer) from public;
grant execute on function public.phone_change_booking_service(text,uuid,text,numeric,integer) to service_role;
