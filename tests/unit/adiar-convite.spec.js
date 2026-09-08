import { describe, it, expect } from 'vitest';
import { diasPedidos, pediuLembrete, dataDoLembrete } from '../../supabase/functions/_shared/adiar-convite.ts';
import { telefoneCanonicoWhatsapp } from '../../supabase/functions/_shared/telefone-whatsapp.ts';

// v29.149.0 — caso Pedro (08/09/2026): "Decidir depois, me chama daqui 14 dias" caiu na IA
// livre, que respondeu que não consegue. Os textos aqui chegam como o webhook os entrega
// ao módulo: normalizados (sem acento, minúsculos).

describe('diasPedidos', () => {
  it('lê o prazo do caso Pedro', () => {
    expect(diasPedidos('decidir depois, me chama daqui 14 dias')).toBe(14);
  });
  it('aceita semanas, meses e número por extenso', () => {
    expect(diasPedidos('me lembra daqui a 2 semanas')).toBe(14);
    expect(diasPedidos('me chama em uma semana')).toBe(7);
    expect(diasPedidos('so daqui um mes')).toBe(30);
    expect(diasPedidos('daqui uns quinze dias')).toBe(15);
    expect(diasPedidos('semana que vem')).toBe(7);
    expect(diasPedidos('mes que vem me chama')).toBe(30);
  });
  it('sem prazo devolve null', () => {
    expect(diasPedidos('decidir depois')).toBeNull();
    expect(diasPedidos('me chama depois')).toBeNull();
    expect(diasPedidos('1')).toBeNull();
    expect(diasPedidos('quero sim')).toBeNull();
  });
});

describe('pediuLembrete', () => {
  it('reconhece o pedido de ser chamado', () => {
    expect(pediuLembrete('decidir depois, me chama daqui 14 dias')).toBe(true);
    expect(pediuLembrete('me lembra semana que vem')).toBe(true);
    expect(pediuLembrete('pode me avisar daqui uns dias?')).toBe(true);
    expect(pediuLembrete('decido depois')).toBe(true);
    expect(pediuLembrete('depois eu vejo')).toBe(true);
  });
  it('não confunde com aceite ou recusa', () => {
    expect(pediuLembrete('quero sim')).toBe(false);
    expect(pediuLembrete('agora nao, obrigado')).toBe(false);
    expect(pediuLembrete('1')).toBe(false);
    expect(pediuLembrete('prefiro outro dia')).toBe(false);
  });
});

describe('dataDoLembrete', () => {
  it('soma os dias a partir de hoje', () => {
    expect(dataDoLembrete('2026-09-08', 14)).toBe('2026-09-22');
  });
  it('domingo vira segunda, e o prazo tem piso e teto', () => {
    expect(dataDoLembrete('2026-09-08', 5)).toBe('2026-09-14'); // 13/09 é domingo
    expect(dataDoLembrete('2026-09-08', 1)).toBe('2026-09-10');
    expect(dataDoLembrete('2026-09-08', 400)).toBe('2027-01-06');
  });
});

describe('telefoneCanonicoWhatsapp', () => {
  it('põe o nono dígito no celular que chega com 12 dígitos', () => {
    expect(telefoneCanonicoWhatsapp('554688887777')).toBe('5546988887777');
    expect(telefoneCanonicoWhatsapp('551188887777')).toBe('5511988887777');
  });
  it('não mexe em fixo, em número já completo nem em formato desconhecido', () => {
    expect(telefoneCanonicoWhatsapp('551133334444')).toBe('551133334444');
    expect(telefoneCanonicoWhatsapp('5546988887777')).toBe('5546988887777');
    expect(telefoneCanonicoWhatsapp('46988887777')).toBe('46988887777');
    expect(telefoneCanonicoWhatsapp('123456789012345')).toBe('123456789012345');
  });
});
