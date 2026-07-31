-- Barbearia do Ju — V28.28.0
-- Tabela `services`: fonte única de serviços que TAMBÉM alcança a Edge Function
-- ju-ia-site (roda em Deno, não consegue importar services-catalog-v7.js, arquivo
-- de front-end). Front-end continua lendo services-catalog-v7.js (arquivo estático,
-- sem custo de rede extra por carregamento) — mesmo padrão já adotado pra produtos
-- em public.products (migration 051-v28.20.0). A Edge Function passa a consultar
-- esta tabela em vez de manter um array hardcoded que só divergia com o tempo.
--
-- display_category = categoria de exibição (igual ao `category` de
-- services-catalog-v7.js, ex. "Cortes e combos", "Barba"...), usada só pra
-- eventual agrupamento visual.
-- upsell_tag = tag interna que já existia hardcoded em ju-ia-site/index.ts
-- (corte/barba/combo/adicional/quimica/tratamento/pigmentacao/estetica), usada por
-- serviceSuggestions()/productSuggestions() pra decidir complementos e produtos
-- sugeridos conforme o serviço escolhido. É uma taxonomia diferente da
-- display_category — não confundir as duas.
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text not null,
  price numeric(10,2) not null check (price >= 0),
  duration_minutes integer not null check (duration_minutes > 0),
  display_category text not null,
  upsell_tag text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.services is 'Catálogo de serviços (nome, descrição, preço, duração, categorias) — fonte única consultada pela Edge Function ju-ia-site. O front-end (agenda, admin) continua usando services-catalog-v7.js; manter os dois em sincronia ao mudar preço/nome/serviço.';
comment on column public.services.display_category is 'Categoria de exibição (igual ao campo `category` de services-catalog-v7.js) — agrupamento visual.';
comment on column public.services.upsell_tag is 'Tag interna (corte/barba/combo/adicional/quimica/tratamento/pigmentacao/estetica) usada pela JuIA (serviceSuggestions/productSuggestions) pra sugerir complementos e produtos conforme o serviço escolhido.';

alter table public.services enable row level security;

-- Leitura pública: serviços ativos já são informação exposta em /agendar/, então não
-- há motivo pra restringir SELECT. Escrita só via service_role (nenhuma policy de
-- insert/update/delete — bypassed automaticamente pelo service_role usado pelas
-- migrations; não existe tela de admin pra editar serviços ainda, mesmo padrão de
-- public.products).
create policy services_select_active on public.services
  for select
  using (active = true);

insert into public.services (name, description, price, duration_minutes, display_category, upsell_tag, sort_order) values
  ('Corte + Lavagem', 'Corte masculino personalizado com lavagem profissional para maior conforto, sensação de limpeza e acabamento caprichado.', 50, 40, 'Cortes e combos', 'corte', 1),
  ('Corte de cabelo', 'Corte de cabelo masculino realizado com técnica, precisão e atenção aos detalhes para valorizar seu estilo.', 40, 30, 'Cortes e combos', 'corte', 2),
  ('Raspar a cabeça', 'Raspagem completa da cabeça, com ou sem navalha, para um acabamento liso e impecável.', 40, 30, 'Cortes e combos', 'corte', 3),
  ('Corte de cabelo infantil', 'Corte infantil feito na tesoura ou na tesoura com máquina, com toda a paciência, cuidado e capricho para o seu filho sair sorrindo — e você, tranquilo.', 40, 30, 'Cortes e combos', 'corte', 4),
  ('Corte + Barboterapia', 'Corte de cabelo aliado à barboterapia completa com toalha quente, navalha e acabamento premium.', 80, 60, 'Cortes e combos', 'combo', 5),
  ('Corte + Barba Express', 'Corte masculino + alinhamento de barba em versão rápida, ideal para manutenção do visual no dia a dia.', 65, 50, 'Cortes e combos', 'combo', 6),
  ('Barboterapia com vaporizador de ozônio', 'Ritual de cuidado com vaporizador de ozônio, toalha quente, espuma e acabamento com navalha.', 50, 40, 'Barba', 'barba', 7),
  ('Barboterapia', 'Barboterapia completa com toalha quente, espuma, acabamento na navalha e produtos profissionais.', 40, 30, 'Barba', 'barba', 8),
  ('Barba Express', 'Alinhamento rápido da barba com acabamento realizado na máquina.', 25, 20, 'Barba', 'barba', 9),
  ('Pezinho (acabamento)', 'Acabamento preciso do contorno do cabelo, nuca e laterais.', 15, 10, 'Acabamentos e adicionais', 'adicional', 10),
  ('Sobrancelha Masculina', 'Alinhamento e limpeza da sobrancelha masculina de forma discreta e natural.', 15, 10, 'Acabamentos e adicionais', 'adicional', 11),
  ('Depilação nasal (cera quente)', 'Remoção dos pelos nasais com cera quente.', 25, 20, 'Acabamentos e adicionais', 'adicional', 12),
  ('Depilação orelhas', 'Remoção dos pelos das orelhas com cera quente.', 25, 20, 'Acabamentos e adicionais', 'adicional', 13),
  ('Freestyle (risquinho)', 'Desenhos e detalhes personalizados feitos no corte.', 15, 10, 'Acabamentos e adicionais', 'adicional', 14),
  ('Nevou / Platinado', 'Descoloração capilar completa para efeito platinado.', 150, 120, 'Química e tratamentos', 'quimica', 15),
  ('Luzes', 'Aplicação de luzes para criar pontos de destaque e iluminar o cabelo.', 120, 90, 'Química e tratamentos', 'quimica', 16),
  ('Alisamento / Relaxamento', 'Redução de volume e alinhamento dos fios através de técnica profissional.', 70, 45, 'Química e tratamentos', 'quimica', 17),
  ('Pigmentação Capilar (Tintura)', 'Coloração capilar para cobertura de fios brancos ou realce do visual.', 50, 30, 'Química e tratamentos', 'quimica', 18),
  ('Hidratação / Reconstrução Capilar', 'Tratamento capilar focado em hidratação, reconstrução e melhora do aspecto dos fios.', 40, 20, 'Química e tratamentos', 'tratamento', 19),
  ('Pigmentação de Barba', 'Pigmentação da barba para correção de falhas e aparência uniforme.', 35, 20, 'Pigmentações', 'pigmentacao', 20),
  ('Pigmentação de Sobrancelha', 'Pigmentação suave da sobrancelha para correção de falhas.', 20, 20, 'Pigmentações', 'pigmentacao', 21),
  ('Aparação Corporal Masculina', 'Redução uniforme dos pelos corporais (peito, abdômen, costas, ombros, braços, pernas, axilas e virilha externa) com máquina profissional, sem cera e sem arrancar os fios pela raiz. Atendimento reservado, com horário exclusivo e total discrição. Não inclui região íntima.', 120, 60, 'Estética corporal', 'estetica', 22)
on conflict (name) do nothing;

notify pgrst, 'reload schema';
