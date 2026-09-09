import { describe, it, expect } from 'vitest';
import { mensagemPixConfirmado, momentoDaConfirmacao } from '../../supabase/functions/_shared/pix-confirmado.ts';

// v29.163.0 — caso Marcelo (09/09/2026): horário 17h00, Pix declarado 17h33 na cadeira,
// confirmado às 18h00 ao concluir. A mensagem dizia "é só chegar no horário combinado".
// O corte é o horário do agendamento: antes garante a vaga; do horário em diante, quita.

// Intl separa "R$" do número com espaço duro (U+00A0). Normaliza só na comparação.
const norm = (s) => String(s).replace(/ /g, ' ');

const base = {
  clienteNome: 'Marcelo Silva',
  valor: 60,
  bookingDate: '2026-09-09',
  startTime: '17:00:00',
  status: 'confirmed',
  agoraSP: '2026-09-09 09:15',
};

describe('momentoDaConfirmacao', () => {
  it('antes do horário marcado é "antes"', () => {
    expect(momentoDaConfirmacao(base)).toBe('antes');
    expect(momentoDaConfirmacao({ ...base, agoraSP: '2026-09-09 16:59' })).toBe('antes');
    expect(momentoDaConfirmacao({ ...base, agoraSP: '2026-09-08 23:00' })).toBe('antes');
  });
  it('do horário marcado em diante é "depois", mesmo sem ter concluído', () => {
    expect(momentoDaConfirmacao({ ...base, agoraSP: '2026-09-09 17:00' })).toBe('depois');
    expect(momentoDaConfirmacao({ ...base, agoraSP: '2026-09-09 17:33' })).toBe('depois');
    expect(momentoDaConfirmacao({ ...base, agoraSP: '2026-09-10 08:00' })).toBe('depois');
  });
  it('concluído é "depois" independente do relógio', () => {
    expect(momentoDaConfirmacao({ ...base, status: 'completed', agoraSP: '2026-09-09 09:00' })).toBe('depois');
  });
  it('cancelado ou ausência é "sem_atendimento"', () => {
    expect(momentoDaConfirmacao({ ...base, status: 'cancelled' })).toBe('sem_atendimento');
    expect(momentoDaConfirmacao({ ...base, status: 'no_show', agoraSP: '2026-09-09 19:00' })).toBe('sem_atendimento');
  });
  it('sem data/hora confiável assume o caso original (antes)', () => {
    expect(momentoDaConfirmacao({ ...base, startTime: '', agoraSP: '' })).toBe('antes');
  });
});

describe('mensagemPixConfirmado', () => {
  it('antes: garante o horário e pede pra chegar', () => {
    const m = norm(mensagemPixConfirmado(base));
    expect(m).toContain('Marcelo, o Juliano conferiu e o seu Pix de R$ 60,00 foi recebido.');
    expect(m).toContain('Seu horário está garantido');
    expect(m).toContain('te esperamos');
  });
  it('depois (caso Marcelo, 18h00): diz que o atendimento está quitado e NÃO manda chegar', () => {
    const m = norm(mensagemPixConfirmado({ ...base, status: 'completed', agoraSP: '2026-09-09 18:00' }));
    expect(m).toContain('O atendimento de hoje está quitado');
    expect(m).not.toContain('chegar no horário');
    expect(m).not.toContain('te esperamos');
    expect(m).toContain('Até a próxima');
  });
  it('sem atendimento: só registra o recebimento, sem prometer crédito nem devolução', () => {
    const m = norm(mensagemPixConfirmado({ ...base, status: 'no_show', agoraSP: '2026-09-09 19:00' }));
    expect(m).toContain('foi recebido e está registrado aqui na barbearia');
    expect(m).not.toContain('garantido');
    expect(m).not.toContain('quitado');
    expect(m).not.toMatch(/cr[eé]dito|devolu/i);
  });
  it('usa só o primeiro nome, capitalizado', () => {
    expect(mensagemPixConfirmado({ ...base, clienteNome: 'marcelo silva' })).toContain('Marcelo, o Juliano');
  });
  it('não usa emoji em nenhuma das três versões', () => {
    const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2705}]/u;
    for (const v of [base, { ...base, status: 'completed' }, { ...base, status: 'cancelled' }]) {
      expect(mensagemPixConfirmado(v)).not.toMatch(emoji);
    }
  });
});
