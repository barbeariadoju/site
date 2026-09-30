-- v29.267.1 (30/09/2026) — preço vigente também na EDIÇÃO/REMARCAÇÃO do agendamento.
--
-- Caso Geovana (30/09, 18h30): agendamento de 01/10 criado com 2 serviços (o gatilho converteu para a
-- tabela de outubro: R$ 100) e depois EDITADO no painel para 3 serviços. O painel calcula com a tabela
-- de hoje (3 × R$ 40 = R$ 120) e o trg_bookings_preco_vigente só rodava em INSERT — ficou R$ 120 em vez
-- de R$ 150. Agora roda também quando muda serviço, preço ou data. A trava continua a mesma da função
-- (migração do reajuste): só troca se o preço gravado for EXATAMENTE a tabela de hoje daquele serviço
-- (preço digitado à mão, cortesia, vale-presente e fidelidade ficam como estão), só em pendente/confirmado
-- e só para data futura.
drop trigger if exists trg_bookings_preco_vigente on public.bookings;
create trigger trg_bookings_preco_vigente
  before insert or update of service_name, service_price, booking_date on public.bookings
  for each row execute function public.bookings_preco_vigente_trg();

-- Corrige o que já foi editado assim: pendente/confirmado, data futura, preço = tabela de hoje e
-- tabela da data diferente. (Um UPDATE "neutro" no preço dispara o gatilho com as mesmas travas.)
update public.bookings b
   set service_price = b.service_price
 where b.status in ('pending', 'confirmed')
   and b.booking_date > (timezone('America/Sao_Paulo', now()))::date
   and not coalesce(b.courtesy, false)
   and b.gift_card_id is null and b.loyalty_free_service is null and b.loyalty_reward_id is null
   and b.service_price = (select p.price from public.service_price_on(b.service_name, (timezone('America/Sao_Paulo', now()))::date) p limit 1)
   and b.service_price <> (select p.price from public.service_price_on(b.service_name, b.booking_date) p limit 1);
