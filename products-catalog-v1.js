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

// v29.34.0 — os preços acima passam a ser FALLBACK, não a verdade.
//
// A partir da aba Equipe o Juliano reajusta preço sozinho, e o reajuste é gravado na tabela
// `products`. Sem esta sincronização, o site, a agenda e o balcão continuariam vendendo
// pelo preço deste arquivo — cliente pagando um valor, sistema calculando outro, e a
// diferença aparecendo no repasse do parceiro. Preço em dois lugares só funciona enquanto
// ninguém mexe em nenhum dos dois.
//
// A lista estática continua existindo de propósito: é ela que segura a tela quando a rede
// falha ou o Supabase está fora. Melhor vender pelo preço de ontem do que não vender.
(() => {
  const cfg = window.BDJ_AGENDA_CONFIG || {};
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) return;

  fetch(`${cfg.supabaseUrl}/rest/v1/products?select=name,price&active=eq.true`, {
    headers: { apikey: cfg.supabaseAnonKey, Authorization: `Bearer ${cfg.supabaseAnonKey}` },
  })
    .then(r => (r.ok ? r.json() : null))
    .then(rows => {
      if (!Array.isArray(rows) || !rows.length) return;
      const porNome = new Map(rows.map(r => [String(r.name).trim().toLowerCase(), Number(r.price)]));
      let mudou = 0;
      // Atualização in-place: todos os consumidores leem o MESMO array (agenda, balcão,
      // reagendamento, vale-presente), então mutar aqui alcança todos sem tocar em nenhum.
      window.BDJ_PRODUCTS.forEach(p => {
        const novo = porNome.get(String(p.name).trim().toLowerCase());
        if (Number.isFinite(novo) && novo !== p.price) { p.price = novo; mudou++; }
      });
      // Quem já renderizou a lista antes da resposta chegar pode se redesenhar ouvindo isto.
      if (mudou) document.dispatchEvent(new CustomEvent('bdj:products-updated', { detail: { changed: mudou } }));
    })
    .catch(() => { /* silêncio proposital: preço de fallback é melhor que tela quebrada */ });
})();
