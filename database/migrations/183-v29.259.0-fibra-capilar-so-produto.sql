-- v29.259.0 (27/09/2026) — "Aplicação de Fibra Capilar" deixa de ser serviço.
-- Pedido do Juliano: "fibra pode remover este serviço, eu não aplico, só vendo". A fibra continua
-- à venda como PRODUTO (Fibra capilar Preta/Castanho Shark Barber e o bico aplicador, tabela products).
-- Nunca houve agendamento com esse serviço (conferido em bookings antes de desativar).
-- Desativa em vez de apagar: o catálogo lido pela JuIA, pelo site e pelo painel filtra active = true,
-- e a linha fica para o histórico. O reajuste agendado para 01/10 (30 → 35) sai junto.
update public.services
   set active = false, updated_at = now()
 where name = 'Aplicação de Fibra Capilar';

delete from public.service_price_changes
 where service_name = 'Aplicação de Fibra Capilar'
   and effective_at > now();
