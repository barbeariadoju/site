-- 129 — v29.66.0 (22/08/2026) — Reativação de quem completou 30 dias sem voltar
--
-- Juliano aprovou ligar o convite de retorno pra quem completou 30+ dias sem vir
-- (regra dele desde 11/08: nunca antes de 30 dias, e só com a base madura — agora tem
-- 6 semanas de histórico). Primeiro disparo: terça 25/08/2026, 14h.
--
-- Correções na função de elegibilidade (existia desde a v28 com régua de 45 dias e
-- nunca tinha enviado nada):
--   1. NÃO convida quem já tem horário futuro marcado (pending/confirmed) — "sentimos sua
--      falta" pra quem já agendou é constrangedor.
--   2. NÃO convida cliente bloqueado (blocked_customers) nem quem pediu pra não receber
--      pesquisa (survey_opt_out — quem não quer mensagem, não quer mensagem).
--   3. Devolve o último serviço (last_service) pra mensagem citar o que ele fez.
-- A mudança no tipo de retorno exige DROP + CREATE (CREATE OR REPLACE não muda o RETURNS).
drop function if exists public.customers_due_for_reactivation(integer, integer, integer);

create function public.customers_due_for_reactivation(
  p_default_days integer default 30,
  p_grace_days integer default 0,
  p_cooldown_days integer default 40
)
returns table(customer_id uuid, name text, phone text, last_visit date, days_since integer, last_service text)
language sql
security definer
set search_path to 'public'
as $$
  with ultimas as (
    select c.id, c.name, c.phone, c.return_interval_days,
           max(b.booking_date) filter (where b.status = 'completed') as ultima_visita
    from public.customer_profiles c
    join public.bookings b
      on public.phone_match_key(b.customer_phone) = public.phone_match_key(c.phone)
    where c.archived = false
      and coalesce(c.survey_opt_out, false) = false
      and length(regexp_replace(c.phone, '\D', '', 'g')) >= 10
    group by c.id
  )
  select u.id, u.name, u.phone, u.ultima_visita,
         (current_date - u.ultima_visita) as days_since,
         (select b2.service_name from public.bookings b2
           where public.phone_match_key(b2.customer_phone) = public.phone_match_key(u.phone)
             and b2.status = 'completed'
           order by b2.booking_date desc, b2.start_time desc limit 1) as last_service
  from ultimas u
  where u.ultima_visita is not null
    and (current_date - u.ultima_visita) >=
        coalesce(u.return_interval_days + p_grace_days, p_default_days)
    and not exists (
      select 1 from public.bookings f
      where public.phone_match_key(f.customer_phone) = public.phone_match_key(u.phone)
        and f.status in ('pending', 'confirmed')
        and f.booking_date >= current_date
    )
    and not exists (
      select 1 from public.blocked_customers bc
      where public.phone_match_key(bc.customer_phone) = public.phone_match_key(u.phone)
    )
    and not exists (
      select 1 from public.customer_outreach_log l
      where l.customer_id = u.id
        and l.kind = 'reactivation'
        and l.created_at > now() - make_interval(days => p_cooldown_days)
    )
  order by u.ultima_visita asc
  limit 100
$$;

-- Cron: régua de 30 dias e só de terça a sábado (segunda a barbearia está fechada e o
-- Juliano pediu pra começar na terça 25/08). 17:00 UTC = 14h em Bragança Paulista.
select cron.alter_job(
  6,
  schedule := '0 17 * * 2-6',
  command := $cmd$
  -- v29.26.0: so dispara dentro da janela de contato da JuIA (dom/feriado nunca; sab ate 15h; demais 8h-20h)
  -- v29.66.0: regua de 30 dias (pedido do Juliano, 22/08/2026); ter-sab
  select case when not public.juia_quiet_now() then (net.http_post(
    url := 'https://rpkqluaxhqsxnewunhfm.supabase.co/functions/v1/customer-reactivation',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-webhook-secret',(select decrypted_secret from vault.decrypted_secrets where name='whatsapp_webhook_secret' limit 1)
    ),
    body := '{"default_days":30,"grace_days":0,"cooldown_days":40}'::jsonb,
    timeout_milliseconds := 25000
  )) end;
  $cmd$
);
