-- v29.335.0 — Crédito deixado pago e observação que vai no comprovante (pedido do Juliano, 03/11/2026).
-- Caso Marcelo: a mãe pagou o corte dele e deixou R$ 50 a mais, já pagos, para o corte do outro filho (Davi).
-- O comprovante precisava sair com R$ 100 e dizer que ficou um corte do Davi pago.
--
-- credit_amount: valor recebido a mais neste atendimento como crédito para um atendimento futuro. NÃO entra
--   em service_price/products_price (o faturamento do serviço de hoje não muda); sai no cupom e soma no total pago.
-- client_note: observação PARA O CLIENTE, sai no comprovante. Diferente de discount_reason/courtesy_reason,
--   que são anotação interna e nunca vão pro cliente.
alter table public.bookings
  add column if not exists credit_amount numeric(10,2) not null default 0 check (credit_amount >= 0 and credit_amount <= 2000),
  add column if not exists client_note text check (client_note is null or char_length(client_note) <= 300);
