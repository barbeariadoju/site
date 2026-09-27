import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { paginasPublicas, carimbar, FLUXO, barra } from '../../scripts/casca.mjs';
import { RAIZ } from '../../scripts/versoes-lib.mjs';

// v29.250.0 — casca única do site público (scripts/casca.mjs). Se alguém editar a barra ou o
// rodapé de uma página à mão, este teste acusa; para corrigir: node scripts/casca.mjs

describe('casca única do site', () => {
  it('toda página pública tem a barra e o rodapé padrão', () => {
    const fora = paginasPublicas().filter((rel) => {
      const html = readFileSync(join(RAIZ, rel), 'utf8');
      return carimbar(rel, html) !== html;
    });
    expect(fora).toEqual([]);
  });

  it('páginas de fluxo não têm o botão "Agendar horário" na barra', () => {
    for (const rel of FLUXO) {
      const html = readFileSync(join(RAIZ, rel), 'utf8');
      expect(html, rel).toContain('class="page-bar is-fluxo"');
      expect(html.match(/<nav class="page-bar[\s\S]*?<\/div><\/nav>/)[0], rel).not.toContain('page-bar-cta');
    }
  });

  it('a navegação principal não se chama "Agendar" (leitor de tela)', () => {
    expect(barra({ modo: 'completo' })).toContain('aria-label="Principal"');
  });
});
