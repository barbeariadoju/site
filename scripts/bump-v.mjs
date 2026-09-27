// Troca o ?v= de um ou mais arquivos em TODAS as referências do site de uma vez.
// Motivo (v29.249.0, auditoria de 27/09/2026): o bump feito à mão, página por página, deixou
// o mesmo arquivo com até 4 versões diferentes (agenda-config-v6.js) e a home baixando o
// css/02 duas vezes (preload com uma versão, @import com outra). O teste
// tests/unit/integridade-arquivos.spec.js falha se isso voltar a acontecer.
//
// Uso:  node scripts/bump-v.mjs 29.249.0 css/06-admin-reforma.css admin-pwa.js
//       node scripts/bump-v.mjs --check      (lista divergências, sai com erro se houver)
import { readFileSync, writeFileSync } from 'node:fs';
import { referenciasVersionadas, arquivosDoSite } from './versoes-lib.mjs';

const args = process.argv.slice(2);

if (args[0] === '--check') {
  const div = divergencias();
  for (const [nome, versoes] of div) console.log(nome, JSON.stringify(versoes));
  process.exit(div.length ? 1 : 0);
}

const [versao, ...alvos] = args;
if (!/^\d+\.\d+\.\d+$/.test(versao || '') || !alvos.length) {
  console.error('uso: node scripts/bump-v.mjs <versao> <arquivo> [arquivo...]');
  process.exit(2);
}
const nomes = new Set(alvos.map((a) => a.split(/[\\/]/).pop()));
let trocas = 0;
for (const f of arquivosDoSite()) {
  const antes = readFileSync(f, 'utf8');
  const depois = antes.replace(/([^"'()\s]+?\.(?:css|js|mjs))\?v=[\w.\-]+/g, (tudo, caminho) => {
    if (!nomes.has(caminho.split('/').pop())) return tudo;
    trocas++;
    return `${caminho}?v=${versao}`;
  });
  if (depois !== antes) writeFileSync(f, depois);
}
console.log(`${trocas} referências atualizadas para ?v=${versao}`);
const sobra = divergencias();
if (sobra.length) {
  console.log('Ainda divergentes:');
  for (const [nome, versoes] of sobra) console.log(' ', nome, JSON.stringify(versoes));
}

function divergencias() {
  const mapa = referenciasVersionadas();
  return [...mapa].filter(([, v]) => Object.keys(v).length > 1);
}
