-- v29.383.0 — Pagamento a prazo (pedido do Juliano, 26/11/2026, caso Filipe: corte feito hoje, pagamento combinado
-- para o dia 30). Forma de pagamento nova 'prazo' + a data combinada. O comprovante sai na hora com o valor, a data
-- e a chave Pix. Quando o dinheiro cair, o Juliano troca a forma de pagamento no "Editar" do card (Pix, dinheiro…):
-- enquanto estiver 'prazo', o atendimento está a receber. A data fica gravada mesmo depois de pago (histórico).
-- Taxa da maquininha: 'prazo' não está em finance_fee_rates, então conta 0 (como Pix/dinheiro).

alter table public.bookings drop constraint if exists bookings_payment_method_check;
alter table public.bookings add constraint bookings_payment_method_check
  check (payment_method = any (array['pix','debito','credito','dinheiro','fidelidade','prazo']));

alter table public.bookings drop constraint if exists bookings_products_payment_method_check;
alter table public.bookings add constraint bookings_products_payment_method_check
  check (products_payment_method = any (array['pix','debito','credito','dinheiro','fidelidade','prazo']));

alter table public.bookings add column if not exists payment_due_date date;
comment on column public.bookings.payment_due_date is
  'v29.383.0 — data combinada para pagar quando payment_method = prazo. Fica gravada depois de pago (histórico).';
