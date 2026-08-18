-- v29.43.0 — JuIA: fila unica de perguntas numericas, confirmacao sem redundancia,
-- convite de retorno na cadencia do cliente.
--
-- Contexto (revisao das conversas de 15/08 a 18/08/2026, pedido do Juliano):
--  1. Pesquisa de satisfacao (1/2), convite de retorno (1/2/3), pedido de confirmacao
--     (1/2/3) e follow-up de lead (1-4) sao robos independentes que nao se enxergam.
--     Quando dois chegam perto um do outro, o "1" do cliente responde a pergunta errada
--     (caso Robson, 13/08). Regra nova, valida para TODOS os robos: antes de mandar uma
--     pergunta numerada, conferir se ja existe outra sem resposta para o mesmo telefone.
--     Se existir, NAO manda — o cron seguinte tenta de novo (tudo e stateful).
--  2. Pedido de confirmacao 3h depois de o cliente marcar (Nuno 17/08: marcou 16:37 pra
--     o dia seguinte, recebeu "confirma presenca?" as 19:45; Alfredo: disse "amanha to
--     ai" e recebeu o pedido as 8h). Redundante e cansativo. Regra nova: so pede
--     confirmacao quando o agendamento foi feito com pelo menos 36h de antecedencia —
--     assim o pedido (que sai na marca de 24h) nunca chega menos de 12h depois de o
--     cliente ter marcado.
--  3. Convite de retorno oferecia sempre "daqui a 4 semanas". O Luiz Andre faz barba a
--     cada ~9 dias e recebeu convite para 11/09 — respondeu "agora nao". A funcao de
--     cadencia devolve a mediana dos intervalos das ultimas visitas do cliente, com o
--     telefone normalizado (o mesmo cliente aparece com e sem o 55, e isso partia o
--     historico ao meio).

-- ---------------------------------------------------------------------------
-- 1) Fila unica: ha alguma pergunta numerada sem resposta para este telefone?
--    Devolve o tipo ('survey' | 'invite' | 'confirmation' | 'lead_followup') ou null.
-- ---------------------------------------------------------------------------
create or replace function public.juia_pending_numeric_question(p_phone text)
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(
    -- pesquisa de satisfacao (48h desde o envio ou desde a ultima recuperacao)
    (select 'survey' from public.find_pending_experience_by_phone(p_phone) limit 1),
    -- convite de retorno enviado ha menos de 72h e ainda sem resposta
    (select 'invite' from public.return_invites r
      where r.status = 'sent'
        and r.sent_at > now() - interval '72 hours'
        and public.phone_match_key(r.phone) = public.phone_match_key(p_phone)
      limit 1),
    -- pedido de confirmacao de presenca enviado e sem resposta, para horario ainda futuro
    (select 'confirmation' from public.bookings b
      where b.status = 'confirmed'
        and b.confirmation_requested_at is not null
        and b.confirmed_at is null
        and b.confirmation_fallback_sent_at is null
        and (b.booking_date::timestamp + b.start_time::time) > timezone('America/Sao_Paulo', now())
        and public.phone_match_key(b.customer_phone) = public.phone_match_key(p_phone)
      limit 1),
    -- follow-up 2 de lead (o que tem opcoes 1-4) enviado ha menos de 24h e sem resposta
    (select 'lead_followup' from public.conversation_leads l
      where l.followup_2_sent_at is not null
        and l.followup_2_sent_at > now() - interval '24 hours'
        and l.responded_at is null
        and public.phone_match_key(l.phone) = public.phone_match_key(p_phone)
      limit 1)
  );
$$;

grant execute on function public.juia_pending_numeric_question(text) to service_role;

-- ---------------------------------------------------------------------------
-- 2) Confirmacao de presenca: so para agendamento feito com >= 36h de antecedencia.
--    A guarda antiga (created_at < now() - 3h) continua, mas sozinha ela deixava o
--    pedido sair 3h depois de marcar quando o horario era pro dia seguinte.
-- ---------------------------------------------------------------------------
create or replace function public.bookings_due_for_confirmation_request(p_within_minutes integer)
returns table(id uuid, customer_name text, customer_phone text, booking_date date, start_time time without time zone, service_name text)
language sql
stable
security definer
set search_path to 'public'
as $$
  select b.id, b.customer_name, b.customer_phone, b.booking_date, b.start_time, b.service_name
  from public.bookings b
  where b.status = 'confirmed'
    and b.confirmation_requested_at is null
    and b.created_at < now() - interval '3 hours'
    -- v29.43.0: marcou com menos de 36h de antecedencia = acabou de marcar, nao precisa
    -- confirmar de novo (o cliente lembra; o pedido viraria ruido).
    and b.created_at <= timezone('America/Sao_Paulo', (b.booking_date::timestamp + b.start_time::time)) - interval '36 hours'
    and (b.booking_date::timestamp + b.start_time::time) > timezone('America/Sao_Paulo', now())
    and (b.booking_date::timestamp + b.start_time::time) <= timezone('America/Sao_Paulo', now()) + make_interval(mins => p_within_minutes)
  order by b.booking_date, b.start_time
$$;

-- ---------------------------------------------------------------------------
-- 3) Cadencia do cliente: mediana (em dias) dos intervalos entre as ultimas visitas
--    concluidas (ate 6 datas distintas). Null quando ha menos de 3 visitas — sem base,
--    o robo cai no padrao. Telefone normalizado por phone_match_key.
-- ---------------------------------------------------------------------------
create or replace function public.customer_visit_cadence_days(p_phone text)
returns integer
language sql
stable
security definer
set search_path to 'public'
as $$
  with visitas as (
    select distinct b.booking_date
    from public.bookings b
    where b.status = 'completed'
      and public.phone_match_key(b.customer_phone) = public.phone_match_key(p_phone)
    order by b.booking_date desc
    limit 6
  ),
  gaps as (
    select (booking_date - lag(booking_date) over (order by booking_date))::int as gap
    from visitas
  )
  select case when count(*) >= 2
              then percentile_cont(0.5) within group (order by gap)::int
              else null end
  from gaps where gap is not null;
$$;

grant execute on function public.customer_visit_cadence_days(text) to service_role;
