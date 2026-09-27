// Leitura das referências ?v= do site. Usado pelo scripts/bump-v.mjs e pelo teste
// tests/unit/integridade-arquivos.spec.js.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const FORA = new Set(['node_modules', 'test-results', 'tests', 'supabase', 'whatsapp-ai', 'scripts', 'database', 'artes', '.git', '.claude', '.impeccable']);

export function arquivosDoSite(dir = RAIZ, extensoes = ['.html', '.js', '.css']) {
  const saida = [];
  for (const nome of readdirSync(dir)) {
    if (FORA.has(nome)) continue;
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) saida.push(...arquivosDoSite(p, extensoes));
    else if (extensoes.some((e) => nome.endsWith(e))) saida.push(p);
  }
  return saida;
}

// Map nomeDoArquivo -> { versao: [arquivos que referenciam] }
export function referenciasVersionadas() {
  const mapa = new Map();
  for (const f of arquivosDoSite()) {
    const s = readFileSync(f, 'utf8');
    for (const m of s.matchAll(/([^"'()\s]+?\.(?:css|js|mjs))\?v=([\w.\-]+)/g)) {
      const nome = m[1].split('/').pop();
      const v = mapa.get(nome) || {};
      (v[m[2]] ||= []).push(relative(RAIZ, f));
      mapa.set(nome, v);
    }
  }
  return mapa;
}

export { RAIZ };
