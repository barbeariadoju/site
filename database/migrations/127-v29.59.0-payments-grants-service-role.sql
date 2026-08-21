-- 127 (v29.59.0) — GRANT que faltava em public.payments para o service_role.
--
-- Descoberto em 21/08/2026, no primeiro teste real do Checkout PagBank depois de a
-- conta ser liberada para produção. O checkout foi criado com sucesso no PagBank
-- (link de pagamento e tudo), mas a linha em `payments` NUNCA era gravada:
--
--   [pagbank-checkout] insert payments {
--     code: "42501", message: "permission denied for table payments" }
--
-- A migration que criou a tabela concedeu SELECT ao authenticated (o admin lê a
-- tela) e esqueceu o service_role — que é justamente quem as edge functions usam.
-- Efeito silencioso e grave: o pagamento seria feito pelo cliente, o PagBank
-- chamaria o nosso webhook, e o webhook não acharia registro nenhum pra casar.
-- Ou seja: dinheiro entrando e agendamento sem confirmação — o oposto do que a
-- Fase 2 existe pra resolver.
--
-- RLS não está em jogo aqui: service_role a ignora. O que faltava era o GRANT
-- de tabela, que é verificado ANTES da RLS.

grant select, insert, update on public.payments to service_role;

-- O webhook também marca o agendamento como pago; garante o mesmo para bookings.
grant select, insert, update on public.bookings to service_role;
