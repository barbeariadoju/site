import { describe, it, expect } from 'vitest';
import {
  tipoDoDia, PAUTAS_EDUCATIVAS, PAUTAS_HUMOR, escolherPauta, ganchosGastos, ganchosUsados, GANCHOS_DE_MARCA,
} from '../../supabase/functions/_shared/pautas.ts';

// v29.212.0 — Central de Conteúdo: menos repetição, mais educativo e humor (pedido de 19/09/2026).
// Cópia da trava de vacância do content-generate-daily (SCARCITY_VIOLATION): nenhum texto de
// reserva pode anunciar agenda vazia.
const VACANCIA = /hor[áa]ri?os?\s+(livres?|dispon[íi]ve|em aberto|vagos?|sobrando)|agenda[^.!?\n]{0,20}\b(livre|vazia|aberta|tranquila|folgada|sem movimento)|\bvagas?\b|sem\s+fila|\bjanela\b|\bencaixe\b|promo[cç][aã]o|desconto/i;
const EMOJI = /\p{Extended_Pictographic}/u;

describe('calendário da semana', () => {
  it('quarta educativo, quinta humor, sexta marca, sábado alterna', () => {
    expect(tipoDoDia(3, 1)).toBe('educativo');
    expect(tipoDoDia(4, 2)).toBe('humor');
    expect(tipoDoDia(5, 3)).toBe('marca');
    expect(tipoDoDia(6, 1)).toBe('humor');
    expect(tipoDoDia(6, 2)).toBe('educativo');
    for (const d of [0, 1, 2]) expect(tipoDoDia(d, 1)).toBeNull();
  });
  it('num mês, educativo + humor passam de metade dos dias de quarta a sábado', () => {
    const tipos = [];
    for (let s = 1; s <= 4; s++) for (const d of [3, 4, 5, 6]) tipos.push(tipoDoDia(d, s));
    expect(tipos.filter((t) => t !== 'marca').length).toBe(12);
  });
});

describe('bancos de pautas', () => {
  const todas = [...PAUTAS_EDUCATIVAS, ...PAUTAS_HUMOR];
  it('ids únicos e bancos com fôlego para mais de 2 meses sem repetir', () => {
    expect(new Set(todas.map((p) => p.id)).size).toBe(todas.length);
    expect(PAUTAS_EDUCATIVAS.length).toBeGreaterThanOrEqual(12);
    expect(PAUTAS_HUMOR.length).toBeGreaterThanOrEqual(12);
  });
  it('textos de reserva: sem vacância, sem emoji, sem gancho gasto, sem número', () => {
    const todosGanchos = GANCHOS_DE_MARCA.map((g) => g.id);
    for (const p of todas) {
      expect(p.fallback, p.id).not.toMatch(VACANCIA);
      expect(p.fallback, p.id).not.toMatch(EMOJI);
      expect(ganchosUsados(p.fallback, todosGanchos), p.id).toEqual([]);
      expect(p.fallback, p.id).not.toMatch(/\d|%|R\$/);
      expect(p.fallback.length, p.id).toBeLessThan(260);
    }
  });
  it('educativo de saúde manda ao dermatologista; nenhum repete o mito do vapor', () => {
    for (const id of ['pelo-encravado', 'irritacao-barbear', 'caspa-ou-seco']) {
      expect(PAUTAS_EDUCATIVAS.find((p) => p.id === id).fallback).toMatch(/dermatologista/i);
    }
    for (const p of PAUTAS_EDUCATIVAS) expect(p.fallback).not.toMatch(/vapor abre|abre os poros(?!")/i);
  });
  it('humor não mira aparência do cliente nem temas proibidos', () => {
    for (const p of PAUTAS_HUMOR) expect(`${p.tema} ${p.fallback}`).not.toMatch(/careca|calv|gordo|barriga|velho|feio|pol[ií]tic|religi|igreja|corinthians|palmeiras|s[aã]o paulo fc|santos fc|kkk|hahaha/i);
  });
});

describe('rodízio', () => {
  const banco = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  it('nunca usada primeiro, na ordem do banco', () => {
    expect(escolherPauta(banco, []).id).toBe('a');
    expect(escolherPauta(banco, ['a']).id).toBe('b');
    expect(escolherPauta(banco, ['b', 'a']).id).toBe('c');
  });
  it('todas usadas: a de uso mais antigo', () => {
    expect(escolherPauta(banco, ['c', 'a', 'b']).id).toBe('b');
    expect(escolherPauta(banco, ['a', 'a', 'c', 'b']).id).toBe('b');
  });
  it('banco vazio devolve null', () => expect(escolherPauta([], [])).toBeNull());
});

describe('ganchos gastos', () => {
  it('as 3 redes do mesmo dia contam como um dia só', () => {
    const r = [
      { dia: '2026-09-17', texto: 'café na chegada' },
      { dia: '2026-09-17', texto: 'o café pronto' },
      { dia: '2026-09-17', texto: 'Um cliente por vez na cadeira' },
    ];
    expect(ganchosGastos(r, 2)).toEqual([]);
    expect(ganchosGastos(r, 1).sort()).toEqual(['cafe', 'um-cliente-por-vez']);
  });
  it('reconhece as variações que mais repetiram', () => {
    const t = 'Na Barbearia do Ju, horário marcado é horário respeitado, sem atropelo, e o espelho no fim.';
    expect(ganchosUsados(t, GANCHOS_DE_MARCA.map((g) => g.id))).toEqual(['hora marcada / horário respeitado', 'sem pressa / sem atropelo', 'espelho']);
    expect(ganchosUsados('Cafeteria não é barbearia', ['cafe'])).toEqual([]);
  });
});
