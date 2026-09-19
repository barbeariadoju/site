import { describe, it, expect } from 'vitest';
import { numeroSemWhatsapp } from '../../supabase/functions/_shared/numero-sem-whatsapp.ts';

// v29.208.0 — anti-trote: só marca "sem WhatsApp" quando a Evolution diz que o número não existe.

describe('numeroSemWhatsapp', () => {
  it('400 com exists:false = número sem WhatsApp', () => {
    const data = { status: 400, error: 'Bad Request', response: { message: [{ jid: '5511931786046@s.whatsapp.net', exists: false, number: '5511931786046' }] } };
    expect(numeroSemWhatsapp({ status: 400, data })).toBe(true);
  });

  it('telefone que nem forma número válido também conta', () => {
    expect(numeroSemWhatsapp({ waPhone: '' })).toBe(true);
  });

  it('servidor fora, timeout ou erro 5xx NÃO marcam o cliente', () => {
    expect(numeroSemWhatsapp({ status: 0, data: { error: 'timeout' } })).toBe(false);
    expect(numeroSemWhatsapp({ status: 500, data: {} })).toBe(false);
    expect(numeroSemWhatsapp({ status: 400, data: { error: 'instance not connected' } })).toBe(false);
    expect(numeroSemWhatsapp({ status: 201, data: { key: { id: 'x' } } })).toBe(false);
  });
});
