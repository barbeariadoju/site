-- 093 — v28.63.0 — Funil de conversão da JuIA (melhoria B, aprovada pelo Juliano em 05/08/2026)
--
-- Problema: a conversão da JuIA nunca foi medida em lugar nenhum. Em 05/08 foi calculada
-- À MÃO uma única vez (62 pessoas conversaram em 14 dias, 39 agendaram) e o número sumiu.
-- Sem isso, toda melhoria na JuIA é chute: não dá pra saber se mexer no prompt ajudou ou
-- piorou, nem onde as pessoas desistem.
--
-- Por que NÃO usar conversation_leads como fonte: aquela tabela é do fluxo de REATIVAÇÃO,
-- não um funil. Ela só guarda os casos "quentes" (citou serviço/data, ou mandou só "oi") e
-- APAGA a linha em qualquer outro caso — por isso tem só 4 registros. Usá-la como medida de
-- conversão daria um número errado por construção.
--
-- Fonte correta: quem realmente escreveu (whatsapp_messages direction='in') versus quem tem
-- agendamento criado depois de ter escrito. Telefone é comparado por phone_match_key, nunca
-- por igualdade de dígitos (o WhatsApp às vezes entrega o número sem o 9 — gotcha recorrente
-- deste projeto).

create or replace function public.juia_conversion_funnel(p_days integer default 14)
returns table (
  periodo_dias integer,
  conversaram bigint,
  agendaram bigint,
  taxa_conversao numeric,
  sem_agendar bigint,
  parou_em_disponibilidade bigint,
  parou_em_servico_preco bigint,
  parou_na_saudacao bigint,
  sem_lead_registrado bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- `authenticated` aqui NÃO é só o dono: a área do cliente também loga gente nesse papel.
  -- Uma view SECURITY DEFINER concedida a `authenticated` sem essa checagem foi exatamente
  -- o vazamento corrigido na migration 059 — não repetir o mesmo erro.
  if not public.is_admin() then
    raise exception 'Acesso restrito ao administrador.' using errcode = '42501';
  end if;

  return query
  with janela as (
    select (now() - make_interval(days => greatest(1, p_days))) as inicio
  ),
  -- Uma linha por pessoa que escreveu no período, com o momento da primeira mensagem dela.
  conversas as (
    select
      public.phone_match_key(m.phone) as chave,
      min(m.created_at) as primeira_msg
    from public.whatsapp_messages m, janela j
    where m.direction = 'in'
      and m.created_at >= j.inicio
      and m.phone is not null
      and public.phone_match_key(m.phone) is not null
    group by 1
  ),
  -- Agendou quem tem booking criado a partir da primeira mensagem dela (não vale booking
  -- anterior à conversa: aquilo não foi a JuIA que converteu).
  convertidos as (
    select distinct c.chave
    from conversas c
    join public.bookings b
      on public.phone_match_key(b.customer_phone) = c.chave
     and b.created_at >= c.primeira_msg
  ),
  -- Para quem não agendou, o estágio registrado no funil de reativação explica ONDE parou.
  estagios as (
    select
      c.chave,
      (select l.kind from public.conversation_leads l
        where public.phone_match_key(l.phone) = c.chave
        order by l.updated_at desc limit 1) as kind
    from conversas c
    where c.chave not in (select chave from convertidos)
  )
  select
    greatest(1, p_days) as periodo_dias,
    (select count(*) from conversas) as conversaram,
    (select count(*) from convertidos) as agendaram,
    case when (select count(*) from conversas) = 0 then 0
         else round(100.0 * (select count(*) from convertidos) / (select count(*) from conversas), 1)
    end as taxa_conversao,
    (select count(*) from estagios) as sem_agendar,
    (select count(*) from estagios where kind = 'availability') as parou_em_disponibilidade,
    (select count(*) from estagios where kind = 'price_or_service') as parou_em_servico_preco,
    (select count(*) from estagios where kind = 'greeting') as parou_na_saudacao,
    (select count(*) from estagios where kind is null) as sem_lead_registrado;
end;
$$;

comment on function public.juia_conversion_funnel(integer) is
  'Funil de conversão da JuIA: quantos escreveram no WhatsApp no período, quantos viraram agendamento e em que etapa os demais pararam. Telefone casado por phone_match_key.';

-- Mesma trava das demais RPCs administrativas: só o admin logado enxerga (ver migration 088).
revoke all on function public.juia_conversion_funnel(integer) from public;
grant execute on function public.juia_conversion_funnel(integer) to service_role;
grant execute on function public.juia_conversion_funnel(integer) to authenticated;
