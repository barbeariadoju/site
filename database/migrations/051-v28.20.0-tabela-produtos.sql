-- Barbearia do Ju — V28.20.0
-- Tabela `products`: fonte única de produtos que TAMBÉM alcança as Edge Functions
-- (ju-ia-site, create-rebooking), que rodam em Deno e não conseguem importar o
-- products-catalog-v1.js do front-end (mesma limitação que services-catalog-v7.js
-- já tinha, nunca resolvida). Front-end continua lendo products-catalog-v1.js
-- (arquivo estático, sem custo de rede extra por carregamento) — as duas Edge
-- Functions passam a consultar esta tabela em vez de manter um array hardcoded
-- que só divergia com o tempo.
--
-- upsell_tags: mesmo esquema de tags que já existia hardcoded em ju-ia-site/index.ts
-- (usado por productSuggestions() pra sugerir complemento conforme o serviço
-- escolhido). Só os 9 produtos que a JuIA já sugeria hoje têm tags — os outros 18
-- (bebidas, itens especiais) ficam com array vazio, ou seja, comportamento da JuIA
-- não muda nada, só passa a vir do banco em vez do código.
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  price numeric(10,2) not null check (price >= 0),
  category text not null,
  upsell_tags text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.products is 'Catálogo de produtos vendáveis (nome, preço, categoria) — fonte única consultada pelas Edge Functions ju-ia-site e create-rebooking. O front-end (agenda, balcão, atendimento) continua usando products-catalog-v1.js; manter os dois em sincronia ao mudar preço/nome.';
comment on column public.products.upsell_tags is 'Tags usadas por ju-ia-site (productSuggestions) pra sugerir complemento conforme o(s) serviço(s) escolhido(s): corte, barba, combo, quimica, tratamento, all. Vazio = a JuIA nunca sugere esse produto sozinha (ainda aparece no balcão/atendimento).';

alter table public.products enable row level security;

-- Leitura pública: produtos ativos são informação já exposta em produtos.html (site
-- público), então não há motivo pra restringir SELECT. Escrita só via service_role
-- (nenhuma policy de insert/update/delete — bypassed automaticamente pelo service_role
-- usado pelas Edge Functions e pelas migrations; não existe tela de admin pra editar
-- produtos ainda, então não precisa de policy pra usuário autenticado escrever).
create policy products_select_active on public.products
  for select
  using (active = true);

insert into public.products (name, price, category, upsell_tags) values
  ('Shampoo Para Barba 240mL', 35, 'Cuidados masculinos', '{}'),
  ('Condicionador Para Barba 240mL', 35, 'Cuidados masculinos', '{}'),
  ('Óleo Para Barba 30mL', 36, 'Cuidados masculinos', '{barba,combo}'),
  ('Balm Para Barba 150g', 35, 'Cuidados masculinos', '{barba,combo}'),
  ('Shampoo Caspbell Anticaspa', 42.99, 'Cuidados masculinos', '{tratamento,quimica,corte}'),
  ('Gel Cola Black Shark Barber', 16, 'Cuidados masculinos', '{}'),
  ('Gel Extra Forte 240g', 20, 'Cuidados masculinos', '{}'),
  ('Pasta Black 150g', 28, 'Cuidados masculinos', '{}'),
  ('Pasta Matte 150g', 34, 'Cuidados masculinos', '{corte,combo}'),
  ('Pasta Modeladora Brilho Extra Forte 150g', 38, 'Cuidados masculinos', '{corte,combo}'),
  ('Pomada em pó', 35, 'Cuidados masculinos', '{corte,combo}'),
  ('Leave-in Shark Barber', 44.99, 'Cuidados masculinos', '{}'),
  ('Fibra capilar Preta Shark Barber', 90, 'Cuidados masculinos', '{}'),
  ('Fibra capilar Castanho Shark Barber', 90, 'Cuidados masculinos', '{}'),
  ('Bico aplicador de fibra capilar', 60, 'Cuidados masculinos', '{}'),
  ('Água Mineral', 3, 'Bebidas frias', '{}'),
  ('Água com Gás', 4, 'Bebidas frias', '{}'),
  ('Coca-Cola Lata', 7, 'Bebidas frias', '{}'),
  ('Coca-Cola Zero Lata', 7, 'Bebidas frias', '{}'),
  ('Energético Monster Energy 473ml', 14, 'Bebidas frias', '{all}'),
  ('Energético Monster Zero Sugar 473ml', 14, 'Bebidas frias', '{all}'),
  ('Suco Del Valle Uva Lata', 8, 'Bebidas frias', '{}'),
  ('Suco Del Valle Pêssego Lata', 8, 'Bebidas frias', '{}'),
  ('Cerveja Heineken Long Neck 330ml', 12, 'Bebidas frias', '{}'),
  ('Cerveja sem Álcool Heineken Long Neck 330mL', 12, 'Bebidas frias', '{}'),
  ('Cerveja Pilsen Budweiser Lata 350ml', 8, 'Bebidas frias', '{}')
on conflict (name) do nothing;

notify pgrst, 'reload schema';
