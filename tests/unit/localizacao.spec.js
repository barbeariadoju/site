import { describe, it, expect } from 'vitest';
import { pediuLocalizacao, jaTemLocalizacao, comLocalizacao } from '../../supabase/functions/_shared/localizacao.ts';

// v29.275.1 — caso Renan (06/10/2026, 12h02). Textos como o webhook entrega: normalizados.
const PERGUNTA = 'Hoje às 18:10 está livre. Qual serviço vai ser?\n*1* — Corte de cabelo';

describe('pediuLocalizacao', () => {
  it('reconhece os jeitos comuns de pedir', () => {
    for (const t of ['18:10 pode ser\npode me mandar a localizacao por favor', 'qual o endereco', 'onde fica a barbearia', 'como chego ai', 'me manda a loc', 'tem no maps']) {
      expect(pediuLocalizacao(t)).toBe(true);
    }
  });
  it('não confunde com outras perguntas', () => {
    for (const t of ['18:10 pode ser', 'onde e o pagamento', 'quanto custa o corte', 'vou pintar o cabelo']) {
      expect(pediuLocalizacao(t)).toBe(false);
    }
  });
});

describe('comLocalizacao', () => {
  it('caso Renan: manda a localização e avisa que o agendamento não está concluído', () => {
    const r = comLocalizacao('18:10 pode ser\npode me mandar a localizacao por favor', PERGUNTA, true);
    expect(r).toMatch(/^Segue a localização da barbearia no Google Maps:/);
    expect(r).toContain('https://maps.app.goo.gl/');
    expect(r).toContain('Rua Dr. Antônio da Cruz, 482');
    expect(r).toContain('Seu agendamento ainda não está concluído: falta escolher o serviço. Hoje às 18:10');
    expect(r.endsWith('*1* — Corte de cabelo')).toBe(true);
  });
  it('a saudação continua abrindo a mensagem', () => {
    const r = comLocalizacao('me manda a localizacao', `Boa tarde, Renan! ${PERGUNTA}`, true);
    expect(r).toMatch(/^Boa tarde, Renan!\n\nSegue a localização/);
    expect(r).toContain('falta escolher o serviço. Hoje às 18:10');
  });
  it('sem horário pendente, só junta a localização', () => {
    const r = comLocalizacao('qual o endereco', 'Funcionamos de terça a sábado.', false);
    expect(r).toContain('Rua Dr. Antônio da Cruz, 482');
    expect(r).not.toContain('não está concluído');
  });
  it('não repete quando a resposta já tem o endereço, nem mexe se não pediu', () => {
    const ja = 'O endereço é Rua Dr. Antônio da Cruz, 482.';
    expect(comLocalizacao('qual o endereco', ja, false)).toBe(ja);
    expect(comLocalizacao('18:10 pode ser', PERGUNTA, true)).toBe(PERGUNTA);
    expect(jaTemLocalizacao('https://maps.app.goo.gl/x')).toBe(true);
  });
  it('não leva emoji nem pergunta nova', () => {
    const r = comLocalizacao('me manda a loc', 'Ok.', false);
    expect(r).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(r).not.toContain('?');
  });
});
