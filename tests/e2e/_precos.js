// v29.211.0 — preço esperado nos testes conforme a data (reajuste de 01/10/2026).
// Antes os testes tinham "R$ 40,00" escrito à mão e quebrariam na virada. A tabela vem do
// mesmo lugar que o site: services-catalog-v7.js (price = até 30/09, priceFrom = a partir de
// 01/10). BDJ_PRECO_HOJE=2026-10-01 força a tabela nova (ensaio da virada numa cópia).
import fs from 'node:fs';

const VIGENCIA = '2026-10-01';
const src = fs.readFileSync(new URL('../../services-catalog-v7.js', import.meta.url), 'utf8');

const hojeSP = () => process.env.BDJ_PRECO_HOJE
  || new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

// `dia` = data do atendimento (AAAA-MM-DD): quem marca antes de 01/10 para outubro vê a tabela nova.
export function valor(nome, dia = hojeSP()) {
  const i = src.indexOf(`name:'${nome}'`);
  if (i < 0) throw new Error(`serviço fora do catálogo: ${nome}`);
  const bloco = src.slice(i, src.indexOf('}', i));
  const antes = Number((bloco.match(/price:(\d+(?:\.\d+)?)/) || [])[1]);
  const depois = Number((bloco.match(/priceFrom:(\d+(?:\.\d+)?)/) || [])[1]);
  const v = String(dia) >= VIGENCIA && Number.isFinite(depois) ? depois : antes;
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/ /g, ' ');
}
