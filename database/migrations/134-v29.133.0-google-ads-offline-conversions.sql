-- 134 — v29.133.0 — a última seta da atribuição
--
-- O circuito era: Google -> gclid -> site -> WhatsApp -> JuIA -> agendamento -> (nada).
-- Sem devolver o agendamento ao Google, o algoritmo só aprendia com pedido de rota e
-- clique, que era a única coisa que ele conseguia medir. Daí 23 conversões de rota
-- contra 1 de agendamento nos 30 dias até 02/09.
--
-- Esta view entrega as linhas no formato exato da importação de conversões offline do
-- Google Ads (planilha / Data Manager). NÃO depende da API nem de developer token —
-- essa era a minha suposição errada na v29.131.0, corrigida pela auditoria do ChatGPT.
--
-- Deduplicação fica por conta do Google: gclid + nome + horário repetidos são ignorados,
-- então reenviar a planilha inteira todo dia é seguro e idempotente.
--
-- Cancelamento e no-show NÃO entram: mandar ao Google uma conversão que não virou
-- cadeira ocupada é ensinar o algoritmo a buscar mais gente que cancela.

create or replace view public.google_ads_offline_conversions
with (security_invoker = true) as
select
  a.gclid                                                as "Google Click ID",
  'Agendamento confirmado (WhatsApp)'                    as "Conversion Name",
  to_char(a.converted_at at time zone 'America/Sao_Paulo',
          'YYYY-MM-DD HH24:MI:SS')  || '-03:00'          as "Conversion Time",
  round(
    coalesce(b.service_price, 0)
  + coalesce(b.products_price, 0)
  - coalesce(b.loyalty_discount, 0)
  , 2)                                                   as "Conversion Value",
  'BRL'                                                  as "Conversion Currency"
from public.whatsapp_attribution a
join public.bookings b on b.id = a.booking_id
where a.gclid is not null
  and a.gclid <> ''
  and a.converted_at is not null
  and b.status not in ('cancelled', 'cancelado', 'no_show')
  -- fora da janela de 90 dias o Google recusa a linha
  and a.converted_at >= a.created_at
  and a.converted_at <= a.created_at + interval '90 days';

comment on view public.google_ads_offline_conversions is
  'Conversoes offline prontas para importar no Google Ads (planilha/Data Manager). Uma linha por agendamento que nasceu de um clique pago. Ver CHANGELOG v29.133.0.';

-- Não expor por PostgREST: só quem tem service_role lê isso.
revoke all on public.google_ads_offline_conversions from anon, authenticated;
