// Intercepta a Edge Function `clube` com a resposta real de {action:'planos'} de 26/09/2026 e uma
// cotação calculada pela mesma régua do servidor (_shared/clube-regras.ts). Nada sai para a
// internet: a função de produção só aceita o domínio do site (CORS), e o teste não grava nada.
export const PLANOS = {
  ok: true,
  planos: [
    { id: 'clube-corte', kind: 'fixo', name: 'Clube Corte', summary: '2 cortes por mês', price: 85, table_value: 100, visit_items: ['Corte de cabelo'], visits_per_cycle: 2, sort: 10 },
    { id: 'barba-em-dia', kind: 'fixo', name: 'Barba em Dia', summary: '4 Barba Express por mês (uma por semana)', price: 112, table_value: 140, visit_items: ['Barba Express'], visits_per_cycle: 4, sort: 20 },
    { id: 'corte-barba', kind: 'fixo', name: 'Corte + Barba', summary: '2 Corte + Barba Express por mês', price: 128, table_value: 160, visit_items: ['Corte + Barba Express'], visits_per_cycle: 2, sort: 30 },
    { id: 'sob-medida', kind: 'sob_medida', name: 'Sob Medida', summary: 'Você escolhe os serviços e quantas vezes vem no mês', price: null, table_value: null, visit_items: [], visits_per_cycle: null, sort: 60 },
  ],
  sob_medida: {
    servicos: [
      { name: 'Corte de cabelo', price: 50 }, { name: 'Corte + Lavagem', price: 60 }, { name: 'Raspar a cabeça', price: 40 },
      { name: 'Barba Express', price: 35 }, { name: 'Barba na navalha com toalha quente', price: 50 }, { name: 'Barboterapia com vaporizador de ozônio', price: 60 },
      { name: 'Corte + Barba Express', price: 80 }, { name: 'Corte + Barba na navalha com toalha quente', price: 95 },
      { name: 'Sobrancelha Masculina', price: 20 }, { name: 'Depilação nasal (cera quente)', price: 30 }, { name: 'Depilação orelhas', price: 30 }, { name: 'Pezinho (acabamento)', price: 20 },
    ],
    visitas: { min: 2, max: 4 }, tabela_minima: 90,
  },
  vagas: [{ pool: 'geral', total: 20, ocupadas: 0, livres: 20, vendas_abertas: true }, { pool: 'cativa', total: 0, ocupadas: 0, livres: 0, vendas_abertas: true }],
  cativa_horarios: [], contrato: { versao: 'v2', sha256: 'teste' },
};
const faixa = (t) => (t >= 200 ? 25 : t >= 120 ? 20 : 15);
export function cotar(body) {
  const itens = body.itens || [], visitas = Number(body.visitas || 2);
  const porVisita = itens.reduce((a, n) => a + Number(PLANOS.sob_medida.servicos.find((s) => s.name === n)?.price || 0), 0);
  const tabelaMensal = porVisita * visitas;
  if (tabelaMensal < PLANOS.sob_medida.tabela_minima) return { error: `O Sob Medida começa em R$ ${PLANOS.sob_medida.tabela_minima} de tabela por mês.` };
  const pct = faixa(tabelaMensal);
  return { ok: true, itens, visitas, porVisita, tabelaMensal, pct, preco: Math.floor(tabelaMensal * (100 - pct) / 100) };
}
export async function mockClube(page) {
  const chamadas = [];
  await page.route('**/functions/v1/clube', async (route) => {
    let body = {};
    try { body = JSON.parse(route.request().postData() || '{}'); } catch { /* sem corpo */ }
    chamadas.push(body);
    const resp = body.action === 'planos' ? PLANOS : body.action === 'cotar' ? cotar(body) : { ok: true };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(resp) });
  });
  return chamadas;
}
