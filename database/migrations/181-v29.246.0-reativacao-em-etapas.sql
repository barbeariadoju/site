-- 181 — v29.246.0 (26/09/2026) — Reativação em etapas: 30, 45, 60, 75, 90, 105, 120 dias e depois a cada 30
--
-- Pedido do Juliano: "crie reativação para clientes também com 45/60/75/90/105/120/etc." e
-- "mensagem curta, breve; o objetivo é lembrar, não incomodar".
--
-- Antes (v29.66.0): um toque aos 30 dias e depois o mesmo texto a cada 40 dias, sem fim. Agora
-- cada cliente tem uma ETAPA: o número de lembretes que já recebeu desde a última visita.
--   etapa 1 → aos 30 dias (ou no ritmo próprio dele, return_interval_days + carência)
--   etapas 2–7 → a cada 15 dias: 45, 60, 75, 90, 105, 120
--   etapas 8+ → a cada 30 dias: 150, 180, … até 365
--   depois de um ano sem voltar, para: quem não respondeu a 15 lembretes não quer mais um; volta
--   a ser cliente pelo balcão, pelo site ou pela JuIA, nunca por insistência.
-- O "cooldown" continua como rede de segurança (nunca dois lembretes com menos de p_cooldown_days
-- de intervalo, mesmo que a régua diga que sim). Quem tem horário futuro, está bloqueado, pediu
-- SAIR, não quer pesquisa ou está arquivado continua fora, como antes.
--
-- Devolve também `stage` (a etapa que vai ser enviada) e `contacts_since_visit`, para a mensagem
-- variar e para o log (customer_outreach_log.details.stage).
-- A mudança no tipo de retorno exige DROP + CREATE.
drop function if exists public.customers_due_for_reactivation(integer, integer, integer);

create function public.customers_due_for_reactivation(
  p_default_days integer default 30,
  p_grace_days integer default 0,
  p_cooldown_days integer default 14
)
returns table(customer_id uuid, name text, phone text, last_visit date, days_since integer, last_service text, stage integer, contacts_since_visit integer)
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
           -- Dia em que a próxima etapa vence: 1ª no ritmo do cliente (ou 30), depois +15 até 120, depois +30.
           case
             when k.ja_enviados = 0 then coalesce(k.return_interval_days + p_grace_days, p_default_days)
             when k.ja_enviados < 7 then p_default_days + 15 * k.ja_enviados
             else 120 + 30 * (k.ja_enviados - 6)
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
  where r.dias >= r.vence_em
    and r.dias <= 365
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
  order by r.ultima_visita asc
  limit 100
$$;

-- Cron (job 6): mesma janela (ter–sáb 14h, só fora do quiet), cooldown de 14 dias — a régua de
-- etapas é que manda; o cooldown só impede dois toques colados.
select cron.alter_job(
  6,
  command := $cmd$
  -- v29.26.0: so dispara dentro da janela de contato da JuIA (dom/feriado nunca; sab ate 15h; demais 8h-20h)
  -- v29.66.0: regua de 30 dias (pedido do Juliano, 22/08/2026); ter-sab
  -- v29.246.0: etapas 30/45/60/75/90/105/120 e depois a cada 30 ate 365 (regua na funcao); cooldown 14
  select case when not public.juia_quiet_now() then (net.http_post(
    url := 'https://rpkqluaxhqsxnewunhfm.supabase.co/functions/v1/customer-reactivation',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-webhook-secret',(select decrypted_secret from vault.decrypted_secrets where name='whatsapp_webhook_secret' limit 1)
    ),
    body := '{"default_days":30,"grace_days":0,"cooldown_days":14}'::jsonb,
    timeout_milliseconds := 25000
  )) end;
  $cmd$
);
