import { describe, it, expect } from 'vitest';
import { periodosDeFechamento, diasAlternativos, textoAvisoFechamento, diaDeTrabalho } from '../../supabase/functions/_shared/aviso-fechamento.ts';

// v29.226.0 — aviso de fechamento (viagem de 15 a 17/10/2026): quem costuma vir nesses dias recebe
// um aviso com dias concretos antes e depois. Nomes fictícios.

describe('períodos de fechamento', () => {
  it('quinta, sexta e sábado seguidos viram um período só', () => {
    expect(periodosDeFechamento(['2026-10-15', '2026-10-16', '2026-10-17'])).toEqual([
      { ini: '2026-10-15', fim: '2026-10-17', dias: ['2026-10-15', '2026-10-16', '2026-10-17'] },
    ]);
  });
  it('domingo e segunda no meio não quebram o período; segunda sozinha nem conta', () => {
    expect(periodosDeFechamento(['2026-10-17', '2026-10-20'])).toEqual([{ ini: '2026-10-17', fim: '2026-10-20', dias: ['2026-10-17', '2026-10-20'] }]);
    expect(periodosDeFechamento(['2026-10-19'])).toEqual([]);
    expect(diaDeTrabalho('2026-10-19')).toBe(false);
  });
  it('dias separados por dia de trabalho aberto são dois períodos', () => {
    expect(periodosDeFechamento(['2026-10-06', '2026-10-08']).length).toBe(2);
  });
});

describe('dias alternativos', () => {
  it('oferece terça e quarta antes e a terça depois (pula domingo e segunda)', () => {
    const r = diasAlternativos({ ini: '2026-10-15', fim: '2026-10-17' }, '2026-10-06', new Set(['2026-10-15', '2026-10-16', '2026-10-17']));
    expect(r).toEqual({ antes: ['2026-10-13', '2026-10-14'], depois: '2026-10-20' });
  });
  it('não oferece dia que já passou nem dia fechado', () => {
    const r = diasAlternativos({ ini: '2026-10-15', fim: '2026-10-17' }, '2026-10-13', new Set(['2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17']));
    expect(r.antes).toEqual([]);
  });
});

describe('texto do aviso', () => {
  const periodo = { ini: '2026-10-15', fim: '2026-10-17' };
  const habitual = textoAvisoFechamento({ nome: 'LUIZ andré', periodo, motivo: 'habitual', diaHabitual: 5, antes: ['2026-10-13', '2026-10-14'], depois: '2026-10-20' });
  const retorno = textoAvisoFechamento({ nome: 'Sr Magno', periodo, motivo: 'retorno', antes: ['2026-10-14'], depois: '2026-10-20' });
  it('diz o período, o motivo do aviso e os dias concretos', () => {
    expect(habitual).toContain('de quinta (15/10) a sábado (17/10) a barbearia não vai atender');
    expect(habitual).toContain('Como você costuma vir às sextas');
    expect(habitual).toContain('na terça (13/10), na quarta (14/10) ou a partir de terça (20/10)');
    expect(retorno).toContain('Pela data do seu último atendimento');
  });
  it('nome arrumado e tratamento pulado', () => {
    expect(habitual.startsWith('Olá, Luiz.')).toBe(true);
    expect(retorno.startsWith('Olá, Magno.')).toBe(true);
  });
  it('sem emoji, sem pergunta numerada e sem dizer o motivo do fechamento', () => {
    for (const t of [habitual, retorno]) {
      expect(t).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(t).not.toMatch(/\*\d\*|^\s*\d\s*[—-]/m);
      expect(t).not.toMatch(/viagem|férias|folga/i);
    }
  });
});
