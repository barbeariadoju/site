-- v29.240.0 (parte 2) — o botão "Excluir registro" da Agenda apagava o histórico que a regra do sinal lê.
--
-- Ao conferir a regra com os casos do dia (Lucas e Venilson cancelaram em cima da hora em 26/09), os dois
-- agendamentos não existiam mais: o card cancelado tem "🗑 Excluir registro" (admin-v15-4-agenda.js), que
-- faz DELETE. Sem o registro, sinal_cancelamentos_ativo nunca veria dois seguidos — e a estatística de
-- cancelamentos também subcontava.
--
-- Solução sem mudar o jeito do Juliano trabalhar: antes de apagar um agendamento que conta pra regra
-- (falta, ou cancelado pelo cliente com menos de 24 h), guarda o mínimo — chave do telefone, dia, hora,
-- tipo e quando — em cancelamentos_arquivados, que a regra também lê. "Excluir cliente definitivamente"
-- (LGPD) apaga o arquivo junto.
-- Tabela nova: RLS ligada, sem policy, GRANT explícito só pro service_role.

create table if not exists public.cancelamentos_arquivados (
  booking_id uuid primary key,
  phone_key text not null,
  booking_date date not null,
  start_time time not null,
  tipo text not null check (tipo in ('falta', 'cancelou_em_cima')),
  quando timestamptz,
  arquivado_em timestamptz not null default now()
);
create index if not exists cancelamentos_arquivados_phone_key on public.cancelamentos_arquivados (phone_key);
alter table public.cancelamentos_arquivados enable row level security;
revoke all on public.cancelamentos_arquivados from anon, authenticated;
grant select, insert, update, delete on public.cancelamentos_arquivados to service_role;

create or replace function public.bookings_arquiva_cancelamento()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if old.status = 'no_show'
     or (old.status = 'cancelled' and old.customer_cancelled_at is not null
         and ((old.booking_date + old.start_time) at time zone 'America/Sao_Paulo') - old.customer_cancelled_at < interval '24 hours') then
    insert into public.cancelamentos_arquivados (booking_id, phone_key, booking_date, start_time, tipo, quando)
    values (old.id, public.phone_match_key(old.customer_phone), old.booking_date, old.start_time,
            case when old.status = 'no_show' then 'falta' else 'cancelou_em_cima' end,
            case when old.status = 'no_show' then (old.booking_date + old.start_time) at time zone 'America/Sao_Paulo' else old.customer_cancelled_at end)
    on conflict (booking_id) do nothing;
  end if;
  return old;
end;
$function$;

drop trigger if exists trg_bookings_arquiva_cancelamento on public.bookings;
create trigger trg_bookings_arquiva_cancelamento before delete on public.bookings
  for each row execute function public.bookings_arquiva_cancelamento();

create or replace function public.sinal_cancelamentos_eventos(p_phone text)
 returns table(booking_id uuid, booking_date date, start_time time, tipo text)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  with chave as (select public.phone_match_key(p_phone) k),
  disp as (select d.dispensado_em from public.sinal_dispensas d, chave where d.phone_key = chave.k),
  ev as (
    select b.id, b.booking_date, b.start_time,
      case
        when b.status = 'completed' then 'atendido'
        when b.status = 'no_show' then 'falta'
        else 'cancelou_em_cima'
      end as tipo,
      case when b.status = 'cancelled' then b.customer_cancelled_at
           else (b.booking_date + b.start_time) at time zone 'America/Sao_Paulo' end as quando
    from public.bookings b, chave
    where public.phone_match_key(b.customer_phone) = chave.k
      and (
        b.status in ('completed', 'no_show')
        or (b.status = 'cancelled' and b.customer_cancelled_at is not null
            and ((b.booking_date + b.start_time) at time zone 'America/Sao_Paulo') - b.customer_cancelled_at < interval '24 hours')
      )
    union all
    select a.booking_id, a.booking_date, a.start_time, a.tipo, a.quando
    from public.cancelamentos_arquivados a, chave
    where a.phone_key = chave.k
  )
  select ev.id, ev.booking_date, ev.start_time, ev.tipo
  from ev
  where not exists (select 1 from disp where ev.quando <= disp.dispensado_em)
  order by ev.booking_date desc, ev.start_time desc
  limit 2
$function$;
revoke all on function public.sinal_cancelamentos_eventos(text) from public, anon, authenticated;
grant execute on function public.sinal_cancelamentos_eventos(text) to service_role;

create or replace function public.admin_delete_customer_permanently(p_customer_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
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

  -- v29.240.0: o gatilho de exclusão arquiva faltas/cancelamentos; apagar o cliente apaga isso também.
  delete from public.cancelamentos_arquivados where phone_key = public.phone_match_key(v_phone);
  delete from public.sinal_dispensas where phone_key = public.phone_match_key(v_phone);

  delete from public.customer_profiles
  where id = p_customer_id;
end;
$function$;
