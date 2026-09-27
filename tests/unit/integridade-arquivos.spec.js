import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { arquivosDoSite, referenciasVersionadas, RAIZ } from '../../scripts/versoes-lib.mjs';

// v29.249.0 — auditoria de 27/09/2026. Duas falhas que já aconteceram mais de uma vez:
//
// 1. Acento corrompido gravado no arquivo ("Balc" + "Ã£o", "Carregando o dia" + "â€¦").
//    Aconteceu na 29.53.2 e de novo na 29.241.0 (6 telas do painel + 25 textos do
//    admin-v15-4-core.js): um passo do PowerShell lê UTF-8 como ANSI e grava de volta. O
//    servidor manda charset=utf-8; o erro está nos bytes do arquivo, então só um teste sobre o
//    arquivo pega.
// 2. O mesmo CSS/JS referenciado com dois ?v= diferentes. O navegador guarda as duas cópias
//    e uma página roda código velho (admin-v15-4-dashboard.js ficou 14 versões atrás em 5
//    telas) ou baixa a folha duas vezes (preload da home × @import do style.css).
//    Para trocar versão use: node scripts/bump-v.mjs <versao> <arquivo...>

// Candidato: um caractere de "início" (U+00C2..U+00F4) seguido de caracteres que existem em
// Windows-1252. Só é defeito se, voltando a bytes Windows-1252, formar UTF-8 válido:
// "lá…" (á + reticências) não forma e passa; "Balc" + "Ã£o" forma "ã" e é acusado.
// Tudo por escape, para este arquivo não acusar a si mesmo.
const CANDIDATO = new RegExp(
  '[\\u00c2-\\u00f4][\\u0080-\\u00bf\\u0152\\u0153\\u0160\\u0161\\u0178\\u017d\\u017e' +
    '\\u0192\\u02c6\\u02dc\\u2013\\u2014\\u2018-\\u201e\\u2020-\\u2022\\u2026\\u2030' +
    '\\u2039\\u203a\\u20ac\\u2122]+',
  'g',
);
const CP1252 = new Map();
{
  const dec = new TextDecoder('windows-1252');
  for (let b = 0; b < 256; b++) CP1252.set(dec.decode(new Uint8Array([b])), b);
  for (const b of [0x81, 0x8d, 0x8f, 0x90, 0x9d]) CP1252.set(String.fromCharCode(b), b);
}
const UTF8 = new TextDecoder('utf-8', { fatal: true });

function corrompido(trecho) {
  for (const m of trecho.matchAll(CANDIDATO)) {
    const bytes = [...m[0]].map((c) => CP1252.get(c));
    if (bytes.some((b) => b === undefined)) continue;
    try {
      UTF8.decode(new Uint8Array(bytes));
      return m;
    } catch {
      // não forma UTF-8: é texto legítimo
    }
  }
  return null;
}

function trechosCorrompidos(arquivos) {
  const achados = [];
  for (const f of arquivos) {
    readFileSync(f, 'utf8')
      .split('\n')
      .forEach((linha, i) => {
        const m = corrompido(linha);
        if (m) achados.push(`${relative(RAIZ, f)}:${i + 1} …${linha.slice(Math.max(0, m.index - 20), m.index + 20)}…`);
      });
  }
  return achados;
}

describe('acentos gravados corretamente', () => {
  it('nenhuma página, script ou folha do site tem texto corrompido', () => {
    expect(trechosCorrompidos(arquivosDoSite())).toEqual([]);
  });

  it('nenhuma function do Supabase tem texto corrompido (é o que vai para o WhatsApp)', () => {
    const fns = arquivosDoSite(join(RAIZ, 'supabase', 'functions'), ['.ts']);
    expect(fns.length).toBeGreaterThan(10);
    expect(trechosCorrompidos(fns)).toEqual([]);
  });

  it('a regra reconhece o defeito real e aceita português legítimo', () => {
    expect(corrompido('BalcÃ£o')).not.toBeNull();
    expect(corrompido('Carregando o diaâ€¦')).not.toBeNull();
    expect(corrompido('ðŸš¶ Balc')).not.toBeNull(); // emoji de 4 bytes
    expect(corrompido('NÃO, SÃO, ATENÇÃO, Balcão, horário, você, Indo pra lá…')).toBeNull();
  });
});

describe('uma versão por arquivo', () => {
  it('cada CSS/JS é referenciado com um único ?v= em todo o site', () => {
    const divergentes = {};
    for (const [nome, versoes] of referenciasVersionadas()) {
      if (Object.keys(versoes).length > 1) {
        divergentes[nome] = Object.fromEntries(Object.entries(versoes).map(([v, fs]) => [v, fs.length]));
      }
    }
    expect(divergentes).toEqual({});
  });
});
