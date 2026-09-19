import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { montar, carregarPlano, MARCA, VIGENCIA_UTC } from '../../scripts/reajuste-2026-10/aplicar.mjs';

// v29.211.0 — virada do site estático em 01/10/2026 (scripts/reajuste-2026-10).
// Até a virada, este teste é a trava contra "o plano envelheceu": se alguém editar uma página
// e mudar um trecho que o plano precisa trocar, o `npm test` falha aqui, com o trecho, em vez
// de a automação da meia-noite falhar sozinha. Depois de aplicado (existe APLICADO), só os
// testes da mecânica continuam.

const aplicado = fs.existsSync(MARCA);

describe('plano do reajuste de 01/10/2026', () => {
  it.skipIf(aplicado)('todo trecho ainda aparece o número de vezes esperado no site de hoje', () => {
    const { erros } = montar();
    expect(erros).toEqual([]);
  });

  it('só troca por pares da tabela aprovada (nada de química, Luzes nem Freestyle)', () => {
    const pares = new Set(['40>50', '50>60', '65>80', '80>95', '25>35', '25>30', '15>20', '35>40', '20>25', '30>35', '120>150']);
    for (const p of carregarPlano()) {
      if (typeof p.conteudo === 'string') continue;
      const de = [...p.de.matchAll(/R\$\s?(\d+)|"price":"(\d+)\.00"|data-price="(\d+)\.00"/g)].map((m) => m[1] || m[2] || m[3]);
      const para = [...p.para.matchAll(/R\$\s?(\d+)|"price":"(\d+)\.00"|data-price="(\d+)\.00"/g)].map((m) => m[1] || m[2] || m[3]);
      if (de.length !== para.length) continue; // reescrita de frase (combos): conferida à mão
      de.forEach((v, i) => { if (v !== para[i]) expect(pares.has(`${v}>${para[i]}`), `${p.arquivo}: ${v}→${para[i]} em "${p.de}"`).toBe(true); });
    }
  });

  it('vigência é 01/10/2026 00:00 em Brasília', () => {
    expect(new Date(VIGENCIA_UTC).toISOString()).toBe('2026-10-01T03:00:00.000Z');
  });
});

describe('mecânica do aplicador', () => {
  const pasta = () => fs.mkdtempSync(path.join(os.tmpdir(), 'reajuste-'));

  it('tudo ou nada: um trecho faltando não grava nada', () => {
    const raiz = pasta();
    fs.writeFileSync(path.join(raiz, 'a.html'), 'Corte R$ 40,00');
    const r = montar([{ arquivo: 'a.html', de: 'Corte R$ 40', para: 'Corte R$ 50', n: 1 }, { arquivo: 'a.html', de: 'Barba R$ 25', para: 'Barba R$ 35', n: 1 }], raiz);
    expect(r.erros.length).toBe(1);
    expect(r.novos.size).toBe(0);
  });

  it('trecho sobreposto a outro já trocado é erro, não pulo silencioso (caso do FAQ no ensaio)', () => {
    const raiz = pasta();
    fs.writeFileSync(path.join(raiz, 'a.html'), 'Corte R$ 40, Corte + Lavagem R$ 50');
    const r = montar([
      { arquivo: 'a.html', de: 'Corte R$ 40', para: 'Corte R$ 50', n: 1 },
      { arquivo: 'a.html', de: 'R$ 40, Corte + Lavagem R$ 50', para: 'R$ 40, Corte + Lavagem R$ 60', n: 1 },
    ], raiz);
    expect(r.erros.join()).toMatch(/sobreposto/);
    expect(r.novos.size).toBe(0);
  });

  it('respeita CRLF e confere JSON-LD depois da troca', () => {
    const raiz = pasta();
    fs.writeFileSync(path.join(raiz, 'a.html'), 'x\r\n<script type="application/ld+json">{"price":"40.00"}</script>');
    const ok = montar([{ arquivo: 'a.html', de: 'x\n<script', para: 'y\n<script', n: 1 }], raiz);
    expect(ok.erros).toEqual([]);
    expect([...ok.novos.values()][0]).toContain('y\r\n<script');
    const quebra = montar([{ arquivo: 'a.html', de: '"price":"40.00"', para: '"price":40.00"', n: 1 }], raiz);
    expect(quebra.erros.join()).toMatch(/JSON-LD inválido/);
  });
});
