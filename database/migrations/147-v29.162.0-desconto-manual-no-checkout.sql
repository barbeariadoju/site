-- 147 — v29.162.0 (09/09/2026) — Desconto manual no "Concluir atendimento"
--
-- Caso real: Jessica, 09/09 às 17h30, corte de cabelo (R$ 40). O Juliano fechou com ela por
-- metade do valor — o corte foi rápido e ficou combinado que ela volta toda semana pra
-- manutenção. Não havia onde registrar isso: o modal "Concluir" só conhecia o prêmio da
-- fidelidade (loyalty_discount) e a cortesia (R$ 0). Sem campo, ou o Financeiro ficava com
-- R$ 40 que não entraram, ou ele editava o serviço na mão e perdia o rastro do preço cheio.
--
-- Convenção (diferente da fidelidade, de propósito):
--   service_price  = o que o cliente PAGOU pelo serviço (líquido, já com o desconto abatido);
--   discount_amount = quanto foi abatido do preço de tabela;  discount_reason = por quê.
--   Preço cheio = service_price + discount_amount.
-- Por que líquido, e não bruto como a fidelidade: tudo que soma receita — Financeiro,
-- Relatórios, Visão geral, cota-parte em dinheiro (migration 114), conversão offline do
-- Google Ads (134) — lê service_price. Guardar o líquido nele deixa todos esses lugares
-- certos sem mexer em nenhum; a fidelidade escolheu o bruto e cada tela precisou aprender a
-- subtrair. O comprovante do cliente reconstrói o preço cheio a partir das duas colunas.
alter table public.bookings
  add column if not exists discount_amount numeric(10,2) not null default 0,
  add column if not exists discount_reason text;

comment on column public.bookings.discount_amount is
  'Desconto manual concedido no Concluir (R$). service_price já está líquido deste valor; preço cheio = service_price + discount_amount.';
comment on column public.bookings.discount_reason is
  'Motivo do desconto manual (anotação interna do Juliano; ex.: "50% · corte rápido, manutenção semanal"). Não vai pro cliente.';

notify pgrst, 'reload schema';
