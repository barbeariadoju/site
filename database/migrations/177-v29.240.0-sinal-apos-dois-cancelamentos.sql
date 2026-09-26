-- v29.240.0 — Sinal de 50% depois de dois cancelamentos em cima da hora (regra do Juliano, 26/09/2026).
--
-- Pedido: "cliente cancelou 2x seguidas só remarca com pagamento de 50%". Aprovado com os ajustes:
--   * Conta só o que custa horário: cancelamento FEITO PELO CLIENTE com menos de 24 h de antecedência
--     (customer_cancelled_at — JuIA, confirmação de presença, link do site) e falta (no_show).
--     Cancelamento pelo painel, pela falta de sinal (prepay-deadline) ou com 24 h+ de aviso não conta.
--   * "Seguidas" = os dois últimos acontecimentos do cliente (atendido, falta, cancelamento tardio).
--     Um atendimento concluído zera.
--   * O sinal é 50% do serviço, pelo Pix, descontado no dia, com o prazo de 1 h do sinal de química.
--   * O Juliano pode dispensar (sinal_dispensas): o que aconteceu antes da dispensa deixa de contar.
-- A lista blocked_customers (pagamento antecipado integral, 20/08) continua valendo por cima desta.
--
-- Tabela nova depois do aviso da Supabase de 23/09: RLS ligada, sem policy, GRANT explícito só pro
-- service_role; o painel mexe nela pelas funções admin_* (security definer + is_admin()).

create table if not exists public.sinal_dispensas (
  phone_key text primary key,
  dispensado_em timestamptz not null default now(),
  dispensado_por uuid
);
alter table public.sinal_dispensas enable row level security;
revoke all on public.sinal_dispensas from anon, authenticated;
grant select, insert, update, delete on public.sinal_dispensas to service_role;

-- Os dois últimos acontecimentos que contam, do mais novo pro mais velho.
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
  )
  select ev.id, ev.booking_date, ev.start_time, ev.tipo
  from ev
  where not exists (select 1 from disp where ev.quando <= disp.dispensado_em)
  order by ev.booking_date desc, ev.start_time desc
  limit 2
$function$;

create or replace function public.sinal_cancelamentos_ativo(p_phone text)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select count(*) = 2 and bool_and(tipo <> 'atendido')
  from public.sinal_cancelamentos_eventos(p_phone)
$function$;

-- Painel: ver se a regra está ativa pra um cliente, e dispensar.
create or replace function public.admin_sinal_cancelamentos(p_phone text)
 returns boolean
 language plpgsql
 stable security definer
 set search_path to 'public'
as $function$
begin
  if not public.is_admin() then raise exception 'Acesso negado.'; end if;
  return public.sinal_cancelamentos_ativo(p_phone);
end;
$function$;

create or replace function public.admin_dispensar_sinal(p_phone text)
 returns boolean
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_k text := public.phone_match_key(p_phone);
begin
  if not public.is_admin() then raise exception 'Acesso negado.'; end if;
  if coalesce(v_k, '') = '' then raise exception 'Telefone inválido.'; end if;
  insert into public.sinal_dispensas (phone_key, dispensado_em, dispensado_por)
  values (v_k, now(), auth.uid())
  on conflict (phone_key) do update set dispensado_em = excluded.dispensado_em, dispensado_por = excluded.dispensado_por;
  return true;
end;
$function$;

revoke all on function public.sinal_cancelamentos_eventos(text) from public, anon, authenticated;
revoke all on function public.sinal_cancelamentos_ativo(text) from public, anon, authenticated;
grant execute on function public.sinal_cancelamentos_eventos(text) to service_role;
grant execute on function public.sinal_cancelamentos_ativo(text) to service_role;
revoke all on function public.admin_sinal_cancelamentos(text) from public, anon;
revoke all on function public.admin_dispensar_sinal(text) from public, anon;
grant execute on function public.admin_sinal_cancelamentos(text) to authenticated, service_role;
grant execute on function public.admin_dispensar_sinal(text) to authenticated, service_role;
