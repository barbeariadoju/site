-- v29.237.0 (25/09/2026) — conversão offline do Google Ads com o agendamento do SITE.
--
-- O Google Ads acusava "Conversão off-line: sem dados recentes" e a meta "Reservar horário" ficou em
-- "Requer atenção". O arquivo (google-ads-conversions-csv) respondia 200, mas só com o cabeçalho:
-- a view só olhava whatsapp_attribution (anúncio → site → botão do WhatsApp → JuIA), caminho que teve
-- 9 registros na vida e 1 com clique de anúncio (cancelado). Quem vem do anúncio agenda direto no
-- /agendar/ (33 clientes novos pelo site nos 30 dias até 24/09), e esse caminho não entrava.
--
-- Agora:
--  1. booking_ad_clicks guarda o identificador do clique (gclid/wbraid/gbraid) que o site já tinha
--     no localStorage (whatsapp-attrib-v29.js) e passa a mandar junto com o agendamento.
--  2. A view manda ao Google SÓ atendimento CONCLUÍDO (quem sentou na cadeira), com o valor líquido
--     pago e a hora do atendimento — dos dois caminhos. Antes contava o agendamento na hora em que
--     era criado, inclusive de quem depois faltava. Cortesia não entra (valor zero não é venda).
--  3. A ação de conversão no Google continua a mesma ("Agendamento confirmado (WhatsApp)"): trocar o
--     nome exigiria reconfigurar a fonte no Data Manager, e o Google descarta em silêncio linha com
--     nome que não bate. Promover essa ação a principal é decisão separada (plano: ~16/10/2026).

create table if not exists public.booking_ad_clicks (
  booking_id uuid primary key references public.bookings(id) on delete cascade,
  gclid text check (gclid is null or length(gclid) between 10 and 512),
  wbraid text check (wbraid is null or length(wbraid) between 10 and 512),
  gbraid text check (gbraid is null or length(gbraid) between 10 and 512),
  clicked_at timestamptz,
  created_at timestamptz not null default now(),
  check (coalesce(gclid, wbraid, gbraid) is not null)
);

alter table public.booking_ad_clicks enable row level security;
-- Sem policy: só o service_role (create-public-booking e a view do CSV) mexe aqui.
revoke all on public.booking_ad_clicks from anon, authenticated;
grant select, insert on public.booking_ad_clicks to service_role;

create or replace view public.google_ads_offline_conversions as
with cliques as (
  -- caminho do site (novo)
  select c.booking_id, c.gclid, c.wbraid, c.gbraid, coalesce(c.clicked_at, c.created_at) as clique_em, 1 as prioridade
  from public.booking_ad_clicks c
  union all
  -- caminho do WhatsApp (v29.134.0)
  select a.booking_id, nullif(a.gclid, ''), nullif(a.wbraid, ''), nullif(a.gbraid, ''), a.created_at, 2
  from public.whatsapp_attribution a
  where a.booking_id is not null
    and coalesce(nullif(a.gclid, ''), nullif(a.wbraid, ''), nullif(a.gbraid, '')) is not null
),
um_por_agendamento as (
  select distinct on (booking_id) * from cliques order by booking_id, prioridade
),
conv as (
  select u.*, b.service_price, b.products_price, b.loyalty_discount, b.discount_amount,
         ((b.booking_date + b.start_time) at time zone 'America/Sao_Paulo') as atendido_em
  from um_por_agendamento u
  join public.bookings b on b.id = u.booking_id
  where b.status = 'completed' and not coalesce(b.courtesy, false)
)
select coalesce(gclid, '') as "Google Click ID",
       coalesce(wbraid, '') as "WBRAID",
       coalesce(gbraid, '') as "GBRAID",
       'Agendamento confirmado (WhatsApp)'::text as "Conversion Name",
       to_char(atendido_em at time zone 'America/Sao_Paulo', 'YYYY-MM-DD HH24:MI:SS') || '-03:00' as "Conversion Time",
       round(greatest(coalesce(service_price, 0) + coalesce(products_price, 0)
             - coalesce(loyalty_discount, 0) - coalesce(discount_amount, 0), 0), 2) as "Conversion Value",
       'BRL'::text as "Conversion Currency"
from conv
where atendido_em >= clique_em
  and atendido_em <= clique_em + interval '90 days'
  and atendido_em <= now();
