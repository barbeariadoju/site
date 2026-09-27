// Compara dois snapshots de estilo calculado (ver snapshot.spec.js).
// Uso: node tests/estilo/comparar.mjs antes depois [--detalhe]
// Sai com código 1 se houver qualquer diferença.
import { readdirSync, readFileSync, existsSync } from 'node:fs';

const [a, b, flag] = process.argv.slice(2);
const DA = `.estilo/${a}`, DB = `.estilo/${b}`;
if (!a || !b || !existsSync(DA) || !existsSync(DB)) {
  console.error('uso: node tests/estilo/comparar.mjs <rotuloA> <rotuloB> [--detalhe]');
  process.exit(2);
}
let total = 0;
const porProp = {};
for (const f of readdirSync(DA).sort()) {
  if (!existsSync(`${DB}/${f}`)) { console.log(`FALTA em ${b}: ${f}`); total++; continue; }
  const A = JSON.parse(readFileSync(`${DA}/${f}`, 'utf8'));
  const B = JSON.parse(readFileSync(`${DB}/${f}`, 'utf8'));
  const difs = [];
  for (const k of Object.keys(A)) {
    if (!B[k]) { difs.push(`  - elemento sumiu: ${k}`); continue; }
    for (const p of Object.keys(A[k])) {
      if (A[k][p] !== B[k][p]) {
        difs.push(`  ${k.split('>').slice(-3).join('>')}  ${p}: ${A[k][p]}  →  ${B[k][p]}`);
        porProp[p] = (porProp[p] || 0) + 1;
      }
    }
  }
  for (const k of Object.keys(B)) if (!A[k]) difs.push(`  + elemento novo: ${k}`);
  if (difs.length) {
    total += difs.length;
    console.log(`${f}: ${difs.length} diferença(s)`);
    if (flag === '--detalhe') console.log(difs.slice(0, 40).join('\n'));
  }
}
console.log(total ? `\nTOTAL: ${total} diferenças. Por propriedade: ${JSON.stringify(porProp)}` : 'Nenhuma diferença.');
process.exit(total ? 1 : 0);
