import { describe, it, expect } from 'vitest';
import {
  money, parseDuration, fmtDuration, addMinutes, addDaysISO,
  dayOfWeek, isOpenDay, closingMinutes, prettyDate, nextOpenDay,
} from '../../assets/js/booking-format.js';

describe('money', () => {
  // toLocaleString usa espaco fixo (charCode 160) entre "R$" e o valor -
  // normalizamos pra espaco comum so na comparacao do teste, o valor real nao muda.
  const nbsp = String.fromCharCode(160);
  const norm = (s) => s.split(nbsp).join(' ');
  it('formata em reais', () => {
    expect(norm(money(40))).toBe('R$ 40,00');
    expect(norm(money(1234.5))).toBe('R$ 1.234,50');
    expect(norm(money(0))).toBe('R$ 0,00');
  });
});

describe('parseDuration', () => {
  it('le horas e minutos combinados', () => {
    expect(parseDuration('1h30')).toBe(90);
    expect(parseDuration('1h')).toBe(60);
    expect(parseDuration('45 min')).toBe(45);
    expect(parseDuration('45min')).toBe(45);
  });
  it('cai em 30min quando nao reconhece nada', () => {
    expect(parseDuration('')).toBe(30);
    expect(parseDuration('qualquer coisa')).toBe(30);
    expect(parseDuration(undefined)).toBe(30);
  });
});

describe('fmtDuration e o inverso de parseDuration para valores redondos', () => {
  it.each([
    [90, '1h30'], [60, '1h'], [45, '45 min'], [30, '30 min'], [120, '2h'],
  ])('%i minutos -> %s', (mins, text) => {
    expect(fmtDuration(mins)).toBe(text);
  });
});

describe('addMinutes', () => {
  it('soma minutos sem passar de hora', () => {
    expect(addMinutes('10:00', 30)).toBe('10:30');
  });
  it('vira a hora corretamente', () => {
    expect(addMinutes('10:45', 30)).toBe('11:15');
  });
});

describe('addDaysISO', () => {
  it('soma dias em UTC, sem virar dia por fuso horario', () => {
    expect(addDaysISO('2026-07-31', 1)).toBe('2026-08-01');
    expect(addDaysISO('2026-01-31', 1)).toBe('2026-02-01');
  });
});

describe('dayOfWeek / isOpenDay / closingMinutes', () => {
  // 2026-07-28 e terca-feira (confirmado pelo contexto da sessao)
  it('reconhece os dias da semana', () => {
    expect(dayOfWeek('2026-07-28')).toBe(2); // terca
    expect(dayOfWeek('2026-08-01')).toBe(6); // sabado
    expect(dayOfWeek('2026-08-02')).toBe(0); // domingo
    expect(dayOfWeek('2026-08-03')).toBe(1); // segunda
  });

  it('barbearia abre terca a sabado, fecha domingo e segunda', () => {
    expect(isOpenDay('2026-07-28')).toBe(true);  // terca
    expect(isOpenDay('2026-07-31')).toBe(true);  // sexta
    expect(isOpenDay('2026-08-01')).toBe(true);  // sabado
    expect(isOpenDay('2026-08-02')).toBe(false); // domingo
    expect(isOpenDay('2026-08-03')).toBe(false); // segunda
  });

  it('sabado fecha as 15h, resto da semana as 19h', () => {
    expect(closingMinutes('2026-08-01')).toBe(15 * 60); // sabado
    expect(closingMinutes('2026-07-28')).toBe(19 * 60); // terca
  });
});

describe('nextOpenDay', () => {
  it('pula domingo e segunda, para no proximo dia aberto', () => {
    expect(nextOpenDay('2026-08-01', 1)).toBe('2026-08-04'); // sab -> pula dom/seg -> terca
  });
  it('a partir de um dia aberto, avanca so 1 dia se o seguinte tambem e aberto', () => {
    expect(nextOpenDay('2026-07-28', 1)).toBe('2026-07-29');
  });
});

describe('prettyDate', () => {
  it('formata em portugues por extenso', () => {
    expect(prettyDate('2026-07-31')).toMatch(/sexta-feira, 31 de julho/);
  });
});
