-- v29.271.0 — Reativação enxuta (01/10/2026, depois da restrição do WhatsApp por envio em massa).
-- A régua da v29.246.0 (30/45/60/75/90/105/120 e depois a cada 30 até 365) mandava até 13 mensagens
-- por ano para quem sumiu. Pedido do Juliano: "enxugar, evitar ser redundantes" e "reativação: faz 12 dias,
-- quer agendar, ou faz 30 dias, quer marcar uma data"; depois: "60 e 120 legal, mas o máximo é 120, 1 mensaginha
-- só; vamos medindo, se precisar tirar a gente tira". Por visita, então:
--   o convite de retorno do dia 12 (corte) / 5 (barba) — return-invite-dispatch, não muda;
--   reativação: 1ª no intervalo de retorno do cliente (ou 30 dias), 2ª aos 60, 3ª aos 120 — e acabou.
-- Teto por rodada: 8 (era 100), para nenhum dia virar disparo.
create or replace function public.customers_due_for_reactivation(p_default_days integer default 30, p_grace_days integer default 0, p_cooldown_days integer default 14)
 returns table(customer_id uuid, name text, phone text, last_visit date, days_since integer, last_service text, stage integer, contacts_since_visit integer)
 language sql
 security definer
 set search_path to 'public'
as $function$
  with ultimas as (
    select c.id, c.name, c.phone, c.return_interval_days,
           max(b.booking_date) filter (where b.status = 'completed') as ultima_visita
    from public.customer_profiles c
    join public.bookings b
      on public.phone_match_key(b.customer_phone) = public.phone_match_key(c.phone)
    where c.archived = false
      and coalesce(c.survey_opt_out, false) = false
      and c.marketing_opt_out_at is null
      and length(regexp_replace(c.phone, '\D', '', 'g')) >= 10
    group by c.id
  ),
  contatos as (
    select u.id, u.name, u.phone, u.return_interval_days, u.ultima_visita,
           (current_date - u.ultima_visita) as dias,
           (select count(*)::int from public.customer_outreach_log l
             where l.customer_id = u.id and l.kind = 'reactivation'
               and l.created_at::date > u.ultima_visita) as ja_enviados,
           (select max(l.created_at) from public.customer_outreach_log l
             where l.customer_id = u.id and l.kind = 'reactivation') as ultimo_envio
    from ultimas u
    where u.ultima_visita is not null
  ),
  regua as (
    select k.*,
           case
             when k.ja_enviados = 0 then coalesce(k.return_interval_days + p_grace_days, p_default_days)
             when k.ja_enviados = 1 then 60
             when k.ja_enviados = 2 then 120
             else null
           end as vence_em
    from contatos k
  )
  select r.id, r.name, r.phone, r.ultima_visita, r.dias,
         (select b2.service_name from public.bookings b2
           where public.phone_match_key(b2.customer_phone) = public.phone_match_key(r.phone)
             and b2.status = 'completed'
           order by b2.booking_date desc, b2.start_time desc limit 1) as last_service,
         (r.ja_enviados + 1) as stage,
         r.ja_enviados as contacts_since_visit
  from regua r
  where r.vence_em is not null
    and r.dias >= r.vence_em
    -- cada etapa só vale até 30 dias depois do vencimento: quem sumiu há 200 dias não ganha um "faz um
    -- mês" atrasado, e a lista não vira disparo no primeiro dia da régua nova.
    and r.dias <= r.vence_em + 30
    and (r.ultimo_envio is null or r.ultimo_envio <= now() - make_interval(days => p_cooldown_days))
    and not exists (
      select 1 from public.bookings f
      where public.phone_match_key(f.customer_phone) = public.phone_match_key(r.phone)
        and f.status in ('pending', 'confirmed')
        and f.booking_date >= current_date
    )
    and not exists (
      select 1 from public.blocked_customers bc
      where public.phone_match_key(bc.customer_phone) = public.phone_match_key(r.phone)
    )
  order by r.ultima_visita desc
  limit 8
$function$;
