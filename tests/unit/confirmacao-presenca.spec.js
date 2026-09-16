import { describe, it, expect } from 'vitest';
import { numeroNaFrente, negacaoDeServico, lerRespostaConfirmacao, servicosNegados } from '../../supabase/functions/_shared/confirmacao-presenca.ts';

// v29.195.1 — caso Sr. Magno (16/09/2026, 15h09). Textos como o webhook entrega: normalizados.
const MAGNO = '1.  mas qto o cabelo so  vou cortar nao vou pintar  depilacao nas orelhas e depilacao nasal  ok podemos fazer';
const RESERVA_MAGNO = 'Depilação orelhas + Depilação nasal (cera quente) + Pigmentação Capilar (Tintura) + Corte de cabelo';

describe('numeroNaFrente', () => {
  it('lê o número na frente com pontuação ou texto depois', () => {
    expect(numeroNaFrente('1.  mas qto o cabelo')).toBe('1');
    expect(numeroNaFrente('2 por favor')).toBe('2');
    expect(numeroNaFrente('3')).toBe('3');
    expect(numeroNaFrente('1111!!')).toBe('1');
  });
  it('não confunde número no meio da frase nem horário', () => {
    expect(numeroNaFrente('as 13:30 confirmo')).toBeNull();
    expect(numeroNaFrente('13h')).toBeNull();
    expect(numeroNaFrente('sim')).toBeNull();
  });
});

describe('lerRespostaConfirmacao', () => {
  it('caso Sr. Magno: "1." na frente confirma, mesmo com "nao vou pintar" no meio', () => {
    expect(lerRespostaConfirmacao(MAGNO)).toBe('confirm');
  });
  it('números soltos', () => {
    expect(lerRespostaConfirmacao('1')).toBe('confirm');
    expect(lerRespostaConfirmacao('2')).toBe('reschedule');
    expect(lerRespostaConfirmacao('3.')).toBe('decline');
  });
  it('remarcar antes de cancelar (regra antiga mantida)', () => {
    expect(lerRespostaConfirmacao('nao consigo nesse horario, quero remarcar')).toBe('reschedule');
    expect(lerRespostaConfirmacao('consegue mudar para hj as 19:30?')).toBe('reschedule');
  });
  it('negação sobre VIR cancela', () => {
    expect(lerRespostaConfirmacao('nao vou poder ir, pode cancelar')).toBe('decline');
    expect(lerRespostaConfirmacao('infelizmente nao vou conseguir')).toBe('decline');
    expect(lerRespostaConfirmacao('nao')).toBe('decline');
  });
  it('negação sobre SERVIÇO não cancela', () => {
    expect(lerRespostaConfirmacao('so vou cortar o cabelo, nao vou pintar')).not.toBe('decline');
    expect(lerRespostaConfirmacao('sem a barba dessa vez, so o corte')).not.toBe('decline');
    expect(lerRespostaConfirmacao('nao vou fazer a depilacao nasal')).not.toBe('decline');
  });
  it('palavras de confirmação', () => {
    expect(lerRespostaConfirmacao('sim, confirmo')).toBe('confirm');
    expect(lerRespostaConfirmacao('ok')).toBe('confirm');
    expect(lerRespostaConfirmacao('bom dia')).toBeNull();
  });
});

describe('negacaoDeServico', () => {
  it('reconhece', () => {
    expect(negacaoDeServico('nao vou pintar')).toBe(true);
    expect(negacaoDeServico('sem barba')).toBe(true);
    expect(negacaoDeServico('so vou cortar')).toBe(true);
  });
  it('não confunde com negação de presença', () => {
    expect(negacaoDeServico('nao vou poder ir')).toBe(false);
    expect(negacaoDeServico('nao posso')).toBe(false);
  });
});

describe('servicosNegados', () => {
  it('caso Sr. Magno: tira só a Pigmentação, mantém depilações e corte', () => {
    expect(servicosNegados(RESERVA_MAGNO, MAGNO)).toEqual(['Pigmentação Capilar (Tintura)']);
  });
  it('cada negação vale pro primeiro serviço citado depois dela', () => {
    expect(servicosNegados('Corte de cabelo + Barba Express + Sobrancelha Masculina', 'sem barba e sem sobrancelha')).toEqual(['Barba Express', 'Sobrancelha Masculina']);
    expect(servicosNegados('Corte de cabelo + Depilação nasal (cera quente)', 'nao vou fazer a depilacao nasal')).toEqual(['Depilação nasal (cera quente)']);
  });
  it('"só o corte" tira tudo que não é corte', () => {
    expect(servicosNegados('Corte de cabelo + Barba na navalha com toalha quente + Pezinho (acabamento)', 'so o corte mesmo')).toEqual(['Barba na navalha com toalha quente', 'Pezinho (acabamento)']);
  });
  it('não tira nada quando a negação é sobre vir, quando tiraria tudo, ou com serviço único', () => {
    expect(servicosNegados('Corte de cabelo + Barba Express', 'nao vou poder ir')).toEqual([]);
    expect(servicosNegados('Corte de cabelo + Barba Express', 'sem corte e sem barba')).toEqual([]);
    expect(servicosNegados('Corte de cabelo', 'nao vou cortar')).toEqual([]);
  });
});
