import { describe, it, expect } from 'vitest';
import {
  ehDiaFraco, somarDias, diasFracosPrimeiro, diaDestaque, selecionarDiasOferta,
  candidatosRetorno, horarioMaisProximo,
} from '../../supabase/functions/_shared/dias-fracos.ts';

// v29.193.0 — terça, quarta e quinta são os dias de menor movimento; a JuIA oferece esses dias
// primeiro quando o cliente não tem dia fixo e sugere o retorno neles na saída do atendimento.
// Datas de referência: 15/09/2026 é terça; 18/09 sexta; 19/09 sábado; 22/09 terça.

const d = (date) => ({ date });

describe('ehDiaFraco / somarDias', () => {
  it('terça, quarta e quinta são fracos; sexta, sábado, domingo e segunda não', () => {
    expect(ehDiaFraco('2026-09-15')).toBe(true);
    expect(ehDiaFraco('2026-09-16')).toBe(true);
    expect(ehDiaFraco('2026-09-17')).toBe(true);
    expect(ehDiaFraco('2026-09-18')).toBe(false);
    expect(ehDiaFraco('2026-09-19')).toBe(false);
    expect(ehDiaFraco('2026-09-20')).toBe(false);
    expect(ehDiaFraco('2026-09-21')).toBe(false);
  });
  it('soma dias sem depender do fuso da máquina', () => {
    expect(somarDias('2026-09-30', 1)).toBe('2026-10-01');
    expect(somarDias('2026-09-01', -3)).toBe('2026-08-29');
  });
});

describe('diasFracosPrimeiro / diaDestaque', () => {
  it('reordena fracos na frente mantendo a ordem interna', () => {
    const lista = [d('2026-09-18'), d('2026-09-19'), d('2026-09-22'), d('2026-09-23')];
    expect(diasFracosPrimeiro(lista).map((x) => x.date)).toEqual(['2026-09-22', '2026-09-23', '2026-09-18', '2026-09-19']);
  });
  it('destaque é o primeiro fraco; sem fraco, o primeiro', () => {
    expect(diaDestaque([d('2026-09-18'), d('2026-09-22')]).date).toBe('2026-09-22');
    expect(diaDestaque([d('2026-09-18'), d('2026-09-19')]).date).toBe('2026-09-18');
    expect(diaDestaque([])).toBeNull();
  });
});

describe('selecionarDiasOferta', () => {
  it('na terça, com a semana toda livre, oferece terça, quarta e quinta (igual a hoje)', () => {
    const semana = ['2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19'].map(d);
    const { lista, destaque } = selecionarDiasOferta(semana);
    expect(lista.map((x) => x.date)).toEqual(['2026-09-15', '2026-09-16', '2026-09-17']);
    expect(destaque.date).toBe('2026-09-15');
  });
  it('na sexta, não esconde hoje: lista hoje + terça + quarta, com a terça em destaque', () => {
    const janela = ['2026-09-18', '2026-09-19', '2026-09-22', '2026-09-23', '2026-09-24'].map(d);
    const { lista, destaque } = selecionarDiasOferta(janela);
    expect(lista.map((x) => x.date)).toEqual(['2026-09-18', '2026-09-22', '2026-09-23']);
    expect(destaque.date).toBe('2026-09-22');
  });
  it('sem dia fraco na janela, fica cronológico', () => {
    const { lista, destaque } = selecionarDiasOferta([d('2026-09-19'), d('2026-09-18')]);
    expect(lista.map((x) => x.date)).toEqual(['2026-09-18', '2026-09-19']);
    expect(destaque.date).toBe('2026-09-18');
  });
  it('respeita o máximo e devolve vazio sem dias', () => {
    expect(selecionarDiasOferta([], 3)).toEqual({ lista: [], destaque: null });
    const dois = selecionarDiasOferta(['2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18'].map(d), 2);
    expect(dois.lista.map((x) => x.date)).toEqual(['2026-09-15', '2026-09-16']);
  });
});

describe('candidatosRetorno', () => {
  it('cadência de 16 dias depois de uma terça: quinta 01/10 primeiro, depois quarta 30/09 e terça 29/09', () => {
    const c = candidatosRetorno('2026-09-15', 16, '2026-09-16');
    expect(c.slice(0, 3)).toEqual(['2026-10-01', '2026-09-30', '2026-09-29']);
    expect(c.every(ehDiaFraco)).toBe(true);
  });
  it('alvo na sexta: quinta (véspera) primeiro, depois a quarta — sempre o mais perto do alvo', () => {
    // 15/09 + 17 = 02/10 (sexta)
    const c = candidatosRetorno('2026-09-15', 17, '2026-09-16');
    expect(c[0]).toBe('2026-10-01');
    expect(c[1]).toBe('2026-09-30');
  });
  it('nunca sugere hoje nem o passado', () => {
    const c = candidatosRetorno('2026-09-10', 5, '2026-09-16'); // alvo 15/09, já passou
    expect(c[0] >= '2026-09-17').toBe(true);
    expect(c).not.toContain('2026-09-16');
  });
  it('retorno curto demais vira 3 dias no mínimo', () => {
    const c = candidatosRetorno('2026-09-15', 0, '2026-09-15');
    expect(c[0]).toBe('2026-09-17');
  });
});

describe('horarioMaisProximo', () => {
  it('escolhe o horário livre mais perto do que o cliente costuma vir', () => {
    expect(horarioMaisProximo(['08:00', '10:30', '16:15', '17:00'], '16:30')).toBe('16:15');
    expect(horarioMaisProximo(['08:00', '12:00'], '10:00')).toBe('08:00'); // empate: o mais cedo
  });
  it('sem horário de referência usa 10h; sem horários devolve vazio', () => {
    expect(horarioMaisProximo(['08:00', '11:00', '15:00'], '')).toBe('11:00');
    expect(horarioMaisProximo([], '10:00')).toBe('');
  });
});
