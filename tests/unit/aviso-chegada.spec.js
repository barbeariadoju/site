import { describe, it, expect } from 'vitest';
import { montarAvisoChegada, minutosAte, dentroDaJanela, horaPermitida, MAPS_URL } from '../../supabase/functions/_shared/aviso-chegada.ts';

// v29.206.0 — aviso de chegada com a rota do Maps ~30 min antes (dica do cliente Rafael).

describe('montarAvisoChegada', () => {
  const texto = montarAvisoChegada({ nome: 'Rafael Souza', horario: '14:30:00' });

  it('usa o primeiro nome e o horário sem segundos', () => {
    expect(texto).toContain('Olá, Rafael.');
    expect(texto).toContain('hoje às 14:30.');
  });

  it('leva o link da ficha da barbearia no Maps e o endereço', () => {
    expect(texto).toContain(MAPS_URL);
    expect(MAPS_URL).toMatch(/^https:\/\/maps\.app\.goo\.gl\//);
    expect(texto).toContain('Rua Dr. Antônio da Cruz, 482');
  });

  it('não leva emoji nem pergunta (não entra na fila de perguntas da JuIA)', () => {
    expect(texto).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(texto).not.toContain('?');
  });

  it('sem nome, não deixa vírgula solta', () => {
    expect(montarAvisoChegada({ nome: '', horario: '09:00' })).toMatch(/^Olá\. Seu horário/);
  });
});

describe('janela de envio', () => {
  it('conta os minutos no relógio local', () => {
    expect(minutosAte('2026-09-18T14:00', '2026-09-18T14:30')).toBe(30);
    expect(minutosAte('2026-09-18T13:58', '2026-09-18T14:30:00')).toBe(32);
  });

  it('envia entre 25 e 35 minutos antes, e só ali', () => {
    expect(dentroDaJanela(30)).toBe(true);
    expect(dentroDaJanela(25)).toBe(true);
    expect(dentroDaJanela(35)).toBe(true);
    expect(dentroDaJanela(24)).toBe(false);
    expect(dentroDaJanela(36)).toBe(false);
    expect(dentroDaJanela(-5)).toBe(false);
  });

  it('cron de 5 em 5 min sempre acerta a janela, qualquer que seja o minuto do horário', () => {
    for (let m = 0; m < 60; m++) {
      const inicio = `2026-09-18T15:${String(m).padStart(2, '0')}`;
      const rodadas = [];
      for (let t = 0; t < 120; t += 5) {
        const agora = `2026-09-18T${String(14 + Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
        if (dentroDaJanela(minutosAte(agora, inicio))) rodadas.push(agora);
      }
      expect(rodadas.length).toBeGreaterThan(0);
    }
  });
});

describe('horário permitido (v29.207.0: fura o silêncio das 8h)', () => {
  it('horário das 8h00 recebe o aviso às 7h30', () => {
    expect(horaPermitida(7)).toBe(true);
    expect(dentroDaJanela(minutosAte('2026-09-19T07:30', '2026-09-19T08:00'))).toBe(true);
  });

  it('nunca de madrugada nem depois das 20h', () => {
    for (const h of [0, 3, 5, 6, 20, 21, 23]) expect(horaPermitida(h)).toBe(false);
    for (let h = 7; h < 20; h++) expect(horaPermitida(h)).toBe(true);
  });
});
