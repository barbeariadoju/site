-- v28.23.0: forma de pagamento separada para produtos vendidos no atendimento
--
-- Motivo: até aqui um atendimento tinha só 1 forma de pagamento (bookings.payment_method)
-- pra tudo. Caso real: cliente concluiu o corte no Pix, mas comprou uma água na hora de
-- sair e pagou no Débito -- não tinha como registrar isso certo, só sobrescrevendo o Pix
-- do serviço. Coluna nova e opcional: quando null, o produto é considerado pago na mesma
-- forma do serviço (compatível com todo registro já existente).

alter table public.bookings
  add column if not exists products_payment_method text;

alter table public.bookings
  add constraint bookings_products_payment_method_check
  check (products_payment_method = any (array['pix','debito','credito','dinheiro','fidelidade']));
