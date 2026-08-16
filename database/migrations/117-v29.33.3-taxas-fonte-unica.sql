-- Barbearia do Ju — v29.33.3 — Cota-parte lê as taxas de finance_fee_rates
--
-- Erro meu na migration 114: criei `payment_method_fees` sem verificar que
-- `finance_fee_rates` já existia desde 09/08/2026, preenchida pelo Juliano no Financeiro
-- (crédito 4,61%, débito 2,12%, Pix 0%). Ele percebeu ao ver o painel pedir as taxas de
-- novo — "as taxas de cartão e pix já tem salvas em algum canto aí".
--
-- Duas tabelas de taxa é como divergência nasce: um dia ele reajusta num lugar, o repasse
-- continua calculando pelo outro, e o erro aparece no bolso do parceiro — que é a última
-- pessoa com condição de conferir isso.
--
-- Fonte única: finance_fee_rates, que já tem tela de edição própria no Financeiro. Métodos
-- ausentes de lá (dinheiro, cortesia) resolvem em 0 pelo coalesce — que é a taxa correta.
--
-- O corpo completo de record_booking_shares foi reaplicado; a única mudança são os dois
-- SELECTs de taxa, que passam de payment_method_fees para finance_fee_rates. Ver a versão
-- integral e comentada na migration 114.

-- (função record_booking_shares reaplicada — ver migration 114 para o corpo comentado;
--  aqui só mudam os dois selects de taxa, de payment_method_fees para finance_fee_rates)

-- Depois de a função passar a ler da fonte certa, a tabela duplicada sai de cena para não
-- voltar a ser preenchida por engano.
drop function if exists public.admin_set_payment_fee(text, numeric);
drop table if exists public.payment_method_fees;
