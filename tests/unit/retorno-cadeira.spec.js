import { describe, it, expect } from 'vitest';
import * as js from '../../assets/js/retorno-cadeira.js';
import * as dias from '../../supabase/functions/_shared/dias-fracos.ts';
import * as convite from '../../supabase/functions/_shared/convite-retorno.ts';

// v29.210.0 — retorno marcado na cadeira. O painel usa a cópia JS; a JuIA usa a TS.
// Datas de referência: 19/09/2026 é sábado; 22/09 terça; 23/09 quarta; 24/09 quinta.

describe('paridade com a regra da JuIA (_shared/dias-fracos.ts e convite-retorno.ts)', () => {
  const servicos = ['Corte de cabelo', 'Barba Express', 'Barboterapia', 'Sobrancelha', 'Corte + Barba Express', 'Luzes', 'Corte infantil'];
  it('família e retorno típico iguais', () => {
    for (const s of servicos) {
      expect(js.familiaDoServico(s)).toBe(convite.familiaDoServico(s));
      for (const c of [null, 0, 3, 4, 9, 21]) expect(js.retornoTipicoDias(c, s)).toBe(convite.retornoTipicoDias(c, s));
    }
  });
  it('candidatos e horário mais próximo iguais', () => {
    for (const ultima of ['2026-09-19', '2026-09-16', '2026-09-01']) {
      for (const r of [7, 12, 17, 30]) expect(js.candidatosRetorno(ultima, r, '2026-09-19')).toEqual(dias.candidatosRetorno(ultima, r, '2026-09-19'));
    }
    const slots = ['08:00', '09:30', '13:15', '16:45'];
    for (const h of ['08:10', '12:00', '15:00', '', 'x']) expect(js.horarioMaisProximo(slots, h)).toBe(dias.horarioMaisProximo(slots, h));
  });
  it('somarDias atravessa mês e ano', () => {
    expect(js.somarDias('2026-09-30', 1)).toBe('2026-10-01');
    expect(js.somarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(js.somarDias('2026-09-01', -3)).toBe('2026-08-29');
  });
});

describe('cadenciaDias (mesma conta do customer_visit_cadence_days)', () => {
  it('menos de 3 visitas = sem cadência', () => {
    expect(js.cadenciaDias([])).toBeNull();
    expect(js.cadenciaDias(['2026-09-01', '2026-09-15'])).toBeNull();
  });
  it('mediana dos intervalos, datas repetidas contam uma vez, só as 6 últimas', () => {
    expect(js.cadenciaDias(['2026-09-01', '2026-09-15', '2026-09-15', '2026-09-29'])).toBe(14);
    expect(js.cadenciaDias(['2026-08-01', '2026-08-11', '2026-08-31'])).toBe(15); // 10 e 20
    expect(js.cadenciaDias(['2026-01-01', '2026-08-01', '2026-08-08', '2026-08-15', '2026-08-22', '2026-08-29', '2026-09-05'])).toBe(7);
  });
});

describe('opcoesRetorno', () => {
  it('um dia por opção, pula dia sem horário, no máximo 3, em ordem de data', () => {
    const cand = ['2026-10-07', '2026-10-08', '2026-10-01', '2026-10-09', '2026-09-30'];
    const slots = { '2026-10-07': ['09:00', '16:30'], '2026-10-08': [], '2026-10-01': ['16:00'], '2026-10-09': ['08:00', '17:00'], '2026-09-30': ['16:15'] };
    expect(js.opcoesRetorno(cand, slots, '16:30:00')).toEqual([
      { date: '2026-10-01', time: '16:00' },
      { date: '2026-10-07', time: '16:30' },
      { date: '2026-10-09', time: '17:00' },
    ]);
  });
  it('sem horário em nenhum dia = lista vazia', () => {
    expect(js.opcoesRetorno(['2026-09-22'], {}, '10:00')).toEqual([]);
  });
  it('rótulo em português', () => {
    expect(js.rotuloOpcao({ date: '2026-09-23', time: '16:30' })).toBe('quarta 23/09 às 16:30');
  });
});
