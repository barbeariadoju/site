// v29.211.0 — Virada do SITE ESTÁTICO para a tabela de preços de 1º de outubro de 2026.
//
// O banco, a JuIA, o agendamento e o catálogo JS já viram sozinhos (service_price_changes +
// apply_scheduled_price_changes; services-catalog-v7.js com priceFrom). Faltava o texto fixo
// das páginas: ~290 menções de preço em ~40 arquivos (descrição, JSON-LD, FAQ, cartões do
// /agendar/). Regra do Juliano (19/09/2026): o preço novo só aparece para o cliente a partir
// de 01/10; quem marca antes para uma data de outubro já paga a tabela nova (isso é do banco).
//
// Como funciona: `plano.json` é uma lista de trechos EXATOS {arquivo, de, para, n} revisada à
// mão (gerada por classificação serviço+valor e conferida trecho a trecho), mais reescritas
// de frase — com a tabela nova, os combos passam a sair R$ 5 mais baratos que os serviços
// separados, e várias páginas diziam "custa o mesmo que os dois separados". Trocar por número
// às cegas erraria: "R$ 25" é Barba Express (→35) e depilação (→30); "R$ 50" é Corte+Lavagem
// (→60) e Pigmentação Capilar (fica 50).
//
// Tudo ou nada: se QUALQUER trecho não aparecer exatamente `n` vezes, nada é gravado e o
// script sai com erro (a automação do GitHub falha e manda e-mail). Depois de gravar, confere
// que todo JSON-LD das páginas alteradas continua JSON válido.
//
//   node scripts/reajuste-2026-10/aplicar.mjs --conferir   só confere (é o que o teste unitário faz)
//   node scripts/reajuste-2026-10/aplicar.mjs --aplicar    aplica; recusa antes de 01/10 00:00 (Brasília)
//   ... --aplicar --ignorar-data                           só para ensaio numa cópia, nunca no main
//
// Quem roda na virada: .github/workflows/reajuste-2026-10.yml. Depois de aplicado, grava
// APLICADO nesta pasta; a automação e o teste passam a ignorar o plano.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..', '..');
export const VIGENCIA_UTC = Date.parse('2026-10-01T03:00:00Z'); // 00:00 em America/Sao_Paulo
export const MARCA = path.join(AQUI, 'APLICADO');

export function carregarPlano() {
  return JSON.parse(fs.readFileSync(path.join(AQUI, 'plano.json'), 'utf8'));
}

const ocorrencias = (texto, trecho) => (trecho ? texto.split(trecho).length - 1 : 0);
// O repositório guarda LF, mas um checkout no Windows pode trazer CRLF: o trecho segue o arquivo.
const noFormato = (texto, trecho) => (texto.includes('\r\n') ? trecho.replace(/\r?\n/g, '\r\n') : trecho);

// Devolve { erros, novos } sem gravar nada. `novos` = Map(arquivo absoluto -> conteúdo final).
export function montar(plano = carregarPlano(), raiz = RAIZ) {
  const erros = [];
  const novos = new Map();
  const ler = (rel) => {
    const abs = path.join(raiz, rel);
    if (!novos.has(abs)) {
      if (!fs.existsSync(abs)) { erros.push(`${rel}: arquivo não existe`); return null; }
      novos.set(abs, fs.readFileSync(abs, 'utf8'));
    }
    return abs;
  };
  // 1ª passada: confere TODAS as contagens no conteúdo original, antes de trocar qualquer coisa
  for (const p of plano) {
    if (typeof p.conteudo === 'string') continue;
    const abs = ler(p.arquivo); if (!abs) continue;
    const n = ocorrencias(novos.get(abs), noFormato(novos.get(abs), p.de));
    if (n !== p.n) erros.push(`${p.arquivo}: esperava ${p.n}x, achou ${n}x → ${p.de.slice(0, 90)}`);
  }
  if (erros.length) return { erros, novos: new Map() };
  for (const p of plano) {
    if (typeof p.conteudo === 'string') { novos.set(path.join(raiz, p.arquivo), p.conteudo); continue; }
    const abs = path.join(raiz, p.arquivo);
    const t = novos.get(abs);
    // Confere de novo NA HORA de trocar: um trecho que se sobrepõe a outro já trocado some do
    // texto e seria pulado em silêncio (foi o que o ensaio de 19/09 pegou na lista do FAQ).
    const n = ocorrencias(t, noFormato(t, p.de));
    if (n !== p.n) { erros.push(`${p.arquivo}: na hora de trocar, esperava ${p.n}x e achou ${n}x (trecho sobreposto?) → ${p.de.slice(0, 90)}`); continue; }
    novos.set(abs, t.split(noFormato(t, p.de)).join(noFormato(t, p.para)));
  }
  if (erros.length) return { erros, novos: new Map() };
  // JSON-LD continua válido em toda página alterada
  for (const [abs, t] of novos) {
    const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g; let m;
    while ((m = re.exec(t))) {
      try { JSON.parse(m[1]); } catch (e) { erros.push(`${path.relative(raiz, abs)}: JSON-LD inválido depois da troca (${e.message})`); }
    }
  }
  return { erros, novos: erros.length ? new Map() : novos };
}

function main() {
  const args = new Set(process.argv.slice(2));
  if (fs.existsSync(MARCA)) { console.log('Reajuste já aplicado (', fs.readFileSync(MARCA, 'utf8').trim(), '). Nada a fazer.'); return 0; }
  const { erros, novos } = montar();
  if (erros.length) { console.error(`FALHOU: ${erros.length} problema(s), nada foi gravado:\n- ${erros.join('\n- ')}`); return 1; }
  const plano = carregarPlano();
  const total = plano.reduce((a, p) => a + (p.n || 0), 0);
  if (!args.has('--aplicar')) { console.log(`OK: ${plano.length} trechos, ${total} ocorrências, ${novos.size} arquivos. Nada gravado (--conferir).`); return 0; }
  if (Date.now() < VIGENCIA_UTC && !args.has('--ignorar-data')) { console.error('Recusado: a tabela nova só pode aparecer a partir de 01/10/2026 00:00 (Brasília).'); return 1; }
  for (const [abs, t] of novos) { fs.mkdirSync(path.dirname(abs), { recursive: true }); fs.writeFileSync(abs, t); }
  fs.writeFileSync(MARCA, `${new Date().toISOString()} · ${plano.length} trechos · ${total} ocorrências · ${novos.size} arquivos\n`);
  console.log(`APLICADO: ${plano.length} trechos, ${total} ocorrências, ${novos.size} arquivos.`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main();
