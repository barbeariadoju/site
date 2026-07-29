// products-catalog-v1.js — fonte única de produtos (mesmo padrão do services-catalog-v7.js
// pros serviços). Antes desta versão, o mesmo catálogo de produtos existia hardcoded e
// levemente divergente em 4 arquivos diferentes (agenda-v15.js, reagendar-v26-5.js,
// admin-v15-4-core.js, admin-balcao-v29.js) — um deles (agenda-v15/reagendar) já tinha
// ficado desatualizado, faltando "Pasta Modeladora Brilho Extra Forte", "Shampoo Caspbell
// Anticaspa" e os energéticos Monster. Preço/nome real de cada produto vem de produtos.html
// (catálogo público, conferido item a item).
//
// `for`: palavras-chave usadas pelo booking (agenda-v15.js/reagendar-v26-5.js) pra sugerir
// produtos relacionados ao(s) serviço(s) escolhido(s), batendo por substring no nome do
// serviço (ex.: 'Corte' bate em "Corte de cabelo", "Corte + Lavagem" etc). Array vazio =
// produto não é sugerido durante o agendamento (aparece só na lista completa do balcão/
// admin, que vende qualquer item do catálogo, inclusive bebidas).
//
// As duas Edge Functions que também precisam desses preços (supabase/functions/ju-ia-site
// e supabase/functions/create-rebooking) rodam em Deno e não conseguem importar este arquivo
// de front-end — continuam com sua própria cópia (mesma limitação que já existe pros
// serviços). Ao mudar preço/nome aqui, replicar manualmente nessas duas functions também.
window.BDJ_PRODUCTS = [
  { name: 'Shampoo Para Barba 240mL', price: 35, category: 'Cuidados masculinos', for: ['Barba', 'Barboterapia'] },
  { name: 'Condicionador Para Barba 240mL', price: 35, category: 'Cuidados masculinos', for: ['Barba', 'Barboterapia'] },
  { name: 'Óleo Para Barba 30mL', price: 36, category: 'Cuidados masculinos', for: ['Barba', 'Barboterapia'] },
  { name: 'Balm Para Barba 150g', price: 35, category: 'Cuidados masculinos', for: ['Barba', 'Barboterapia'] },
  { name: 'Shampoo Caspbell Anticaspa', price: 42.99, category: 'Cuidados masculinos', for: ['Corte', 'Luzes', 'Platinado', 'Relaxamento'] },
  { name: 'Gel Cola Black Shark Barber', price: 16, category: 'Cuidados masculinos', for: ['Corte', 'Freestyle'] },
  { name: 'Gel Extra Forte 240g', price: 20, category: 'Cuidados masculinos', for: ['Corte', 'Freestyle'] },
  { name: 'Pasta Black 150g', price: 28, category: 'Cuidados masculinos', for: ['Corte', 'Freestyle'] },
  { name: 'Pasta Matte 150g', price: 34, category: 'Cuidados masculinos', for: ['Corte', 'Lavagem', 'Luzes', 'Platinado'] },
  { name: 'Pasta Modeladora Brilho Extra Forte 150g', price: 38, category: 'Cuidados masculinos', for: ['Corte', 'Lavagem', 'Luzes', 'Platinado'] },
  { name: 'Pomada em pó', price: 35, category: 'Cuidados masculinos', for: ['Corte', 'Freestyle'] },
  { name: 'Leave-in Shark Barber', price: 44.99, category: 'Cuidados masculinos', for: [] },
  { name: 'Fibra capilar Preta Shark Barber', price: 90, category: 'Cuidados masculinos', for: [] },
  { name: 'Fibra capilar Castanho Shark Barber', price: 90, category: 'Cuidados masculinos', for: [] },
  { name: 'Bico aplicador de fibra capilar', price: 60, category: 'Cuidados masculinos', for: [] },
  { name: 'Água Mineral', price: 3, category: 'Bebidas frias', for: [] },
  { name: 'Água com Gás', price: 4, category: 'Bebidas frias', for: [] },
  { name: 'Coca-Cola Lata', price: 7, category: 'Bebidas frias', for: [] },
  { name: 'Coca-Cola Zero Lata', price: 7, category: 'Bebidas frias', for: [] },
  { name: 'Energético Monster Energy 473ml', price: 14, category: 'Bebidas frias', for: [] },
  { name: 'Energético Monster Zero Sugar 473ml', price: 14, category: 'Bebidas frias', for: [] },
  { name: 'Suco Del Valle Uva Lata', price: 8, category: 'Bebidas frias', for: [] },
  { name: 'Suco Del Valle Pêssego Lata', price: 8, category: 'Bebidas frias', for: [] },
  { name: 'Cerveja Heineken Long Neck 330ml', price: 12, category: 'Bebidas frias', for: [] },
  { name: 'Cerveja sem Álcool Heineken Long Neck 330mL', price: 12, category: 'Bebidas frias', for: [] },
  { name: 'Cerveja Pilsen Budweiser Lata 350ml', price: 8, category: 'Bebidas frias', for: [] },
];
