import { describe, it, expect } from 'vitest';
import { montarMensagemSenha, montarMensagemProximo, alguemAntes, ehProximo, horaPermitida } from '../../supabase/functions/_shared/senha-digital.ts';

// v29.241.0 — Senha Digital (26/09/2026).

describe('montarMensagemSenha', () => {
  const base = { nome: 'Mateus Silva', senha: 3, servico: 'Corte de cabelo', horario: '14:50:00', link: 'https://www.barbeariadoju.com.br/senha/#c=BJ-1&t=abc' };

  it('diz a senha, o serviço, a previsão e o link', () => {
    const t = montarMensagemSenha({ ...base, posicao: 2 });
    expect(t).toContain('Olá, Mateus. Sua senha na Barbearia do Ju é a 3.');
    expect(t).toContain('Corte de cabelo, com previsão para as 14:50.');
    expect(t).toContain('Há 2 pessoas antes de você.');
    expect(t).toContain('Pode dar uma volta no centro.');
    expect(t).toContain(base.link);
  });

  it('singular com 1 pessoa antes; "você é o próximo" quando não há ninguém', () => {
    expect(montarMensagemSenha({ ...base, posicao: 1 })).toContain('Há 1 pessoa antes de você.');
    const t = montarMensagemSenha({ ...base, posicao: 0 });
    expect(t).toContain('Você é o próximo');
    expect(t).not.toContain('dar uma volta');
  });

  it('não leva emoji nem pergunta', () => {
    for (const pos of [0, 1, 2]) {
      const t = montarMensagemSenha({ ...base, posicao: pos });
      expect(t).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(t).not.toContain('?');
    }
  });
});

describe('montarMensagemProximo', () => {
  it('chama pelo primeiro nome e dá o horário e o endereço', () => {
    const t = montarMensagemProximo({ nome: 'Anderson Lima', horario: '15:30' });
    expect(t).toMatch(/^Anderson, você é o próximo/);
    expect(t).toContain('às 15:30');
    expect(t).toContain('Rua Dr. Antônio da Cruz, 482');
    expect(t).not.toContain('?');
  });
  it('sem nome, começa com "Você"', () => {
    expect(montarMensagemProximo({ nome: '', horario: '09:00' })).toMatch(/^Você é o próximo/);
  });
});

describe('quem é o próximo', () => {
  const sergio = { start_time: '14:00:00', end_time: '14:45:00', status: 'confirmed' };
  const guilherme = { start_time: '14:30:00', end_time: '15:15:00', status: 'confirmed' };

  it('com o Sérgio na cadeira, o Mateus (14:45) ainda não é o próximo', () => {
    expect(alguemAntes('14:10', '14:45', [sergio])).toBe(true);
    expect(ehProximo('14:10', '14:45', [sergio])).toBe(false);
  });

  it('quando o Sérgio termina (ou é concluído), o Mateus vira o próximo', () => {
    expect(ehProximo('14:46', '14:45', [sergio])).toBe(true);
    expect(ehProximo('14:10', '14:45', [{ ...sergio, status: 'completed' }])).toBe(true);
  });

  it('quem começa depois de mim não conta', () => {
    expect(ehProximo('14:10', '14:00', [guilherme])).toBe(true);
  });

  it('horário que passou do fim sem "Concluir" conta como acabado', () => {
    expect(ehProximo('14:50', '15:00', [sergio])).toBe(true);
  });

  it('cancelado e falta não seguram a fila', () => {
    expect(ehProximo('14:10', '14:45', [{ ...sergio, status: 'cancelled' }, { ...sergio, status: 'no_show' }])).toBe(true);
  });
});

describe('horário permitido', () => {
  it('8h às 20h', () => {
    for (const h of [0, 5, 7, 20, 23]) expect(horaPermitida(h)).toBe(false);
    for (let h = 8; h < 20; h++) expect(horaPermitida(h)).toBe(true);
  });
});
