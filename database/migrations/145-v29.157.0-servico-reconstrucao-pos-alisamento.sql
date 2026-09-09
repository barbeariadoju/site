-- 145 — v29.157.0 (09/09/2026) — Serviço novo: Reconstrução Química Pós-Alisamento
--
-- Pedido do Juliano: "reconstrução química pós alisamento — hidratação e reposição de massa
-- e aminoácidos — R$ 50,00". Entra na tabela `services` pra JuIA conhecer o serviço (nome,
-- preço, duração e argumento de venda); o front-end lê services-catalog-v7.js, atualizado
-- na mesma versão. Mesma categoria e tag da Hidratação / Reconstrução Capilar (é um
-- tratamento, não uma química), sort_order igual ao dela pra ficar logo em seguida.
--
-- Duração de 30 min é ASSUNÇÃO (igual à hidratação); o Juliano não informou. Sem
-- priceFrom: o serviço nasce a R$ 50 e o reajuste de 01/10 não o alcança.
insert into public.services (name, description, price, duration_minutes, display_category, upsell_tag, sort_order, sales_pitch) values
  ('Reconstrução Química Pós-Alisamento',
   'Hidratação e reposição de massa e aminoácidos logo após o alisamento, para devolver resistência e maciez ao fio que passou pela química.',
   50, 30, 'Química e tratamentos', 'tratamento', 19,
   'Feita na mesma sentada do alisamento: repõe a massa e os aminoácidos que a química tira do fio e hidrata em seguida, pra o cabelo sair alinhado sem ficar seco ou quebradiço.')
on conflict (name) do nothing;
