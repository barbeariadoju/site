import { describe, it, expect } from 'vitest';
import { applyServiceRule, normalizeServiceSet, familiesOf, splitServiceNames } from '../../assets/js/service-rules.js';

// v29.62.0 — regra das famílias (caso Augusto Monteiro, 22/08/2026: "Corte + Barba na navalha com toalha quente
// + Barba Express" agendado pelo site). 1 corte + 1 barba por atendimento; exceção pai e filho.

describe('familiesOf', () => {
  it('classifica cortes, barbas, combos e o pezinho', () => {
    expect([...familiesOf('Corte de cabelo')]).toEqual(['corte']);
    expect([...familiesOf('Corte de cabelo infantil')]).toEqual(['infantil']);
    expect([...familiesOf('Barba Express')]).toEqual(['barba']);
    expect([...familiesOf('Corte + Barba na navalha com toalha quente')].sort()).toEqual(['barba', 'corte']);
    expect([...familiesOf('Pezinho (acabamento)')].sort()).toEqual(['corte', 'infantil']);
    expect(familiesOf('Sobrancelha Masculina').size).toBe(0);
  });
});

describe('applyServiceRule', () => {
  it('adiciona serviço sem família normalmente', () => {
    const r = applyServiceRule(['Corte de cabelo'], 'Sobrancelha Masculina');
    expect(r.added).toBe(true);
    expect(r.services).toEqual(['Corte de cabelo', 'Sobrancelha Masculina']);
    expect(r.message).toBeNull();
  });
  it('pai e filho: corte adulto + corte infantil convivem', () => {
    const r = applyServiceRule(['Corte de cabelo'], 'Corte de cabelo infantil');
    expect(r.added).toBe(true);
    expect(r.services).toEqual(['Corte de cabelo', 'Corte de cabelo infantil']);
  });
  it('combo que já inclui a barba recusa Barba Express (caso Augusto)', () => {
    const r = applyServiceRule(['Corte + Barba na navalha com toalha quente'], 'Barba Express');
    expect(r.added).toBe(false);
    expect(r.services).toEqual(['Corte + Barba na navalha com toalha quente']);
    expect(r.message).toMatch(/já inclui a barba/);
  });
  it('barba em cima de barba: a mais nova substitui', () => {
    expect(applyServiceRule(['Barba Express'], 'Barba na navalha com toalha quente').services).toEqual(['Barba na navalha com toalha quente']);
    expect(applyServiceRule(['Barba na navalha com toalha quente'], 'Barba Express').services).toEqual(['Barba Express']);
  });
  it('combo substitui corte e barba soltos de uma vez', () => {
    const r = applyServiceRule(['Corte de cabelo', 'Barba Express', 'Sobrancelha Masculina'], 'Corte + Barba na navalha com toalha quente');
    expect(r.services).toEqual(['Sobrancelha Masculina', 'Corte + Barba na navalha com toalha quente']);
    expect(r.message).toMatch(/troquei «Corte de cabelo»/);
    expect(r.message).toMatch(/troquei «Barba Express»/);
  });
  it('corte + lavagem substitui corte simples', () => {
    expect(applyServiceRule(['Corte de cabelo'], 'Corte + Lavagem').services).toEqual(['Corte + Lavagem']);
  });
  it('pezinho nunca soma a um corte (nem ao infantil)', () => {
    expect(applyServiceRule(['Corte de cabelo'], 'Pezinho (acabamento)').added).toBe(false);
    expect(applyServiceRule(['Corte de cabelo infantil'], 'Pezinho (acabamento)').added).toBe(false);
    const r = applyServiceRule(['Pezinho (acabamento)'], 'Corte de cabelo');
    expect(r.services).toEqual(['Corte de cabelo']);
    expect(r.message).toMatch(/já vem incluso/);
  });
  it('pezinho sozinho ou com barba continua valendo', () => {
    expect(applyServiceRule([], 'Pezinho (acabamento)').added).toBe(true);
    expect(applyServiceRule(['Barba Express'], 'Pezinho (acabamento)').services).toEqual(['Barba Express', 'Pezinho (acabamento)']);
  });
  it('duplicata exata é recusada', () => {
    const r = applyServiceRule(['Corte de cabelo'], 'Corte de cabelo');
    expect(r.added).toBe(false);
    expect(r.services).toEqual(['Corte de cabelo']);
  });
});

describe('normalizeServiceSet', () => {
  it('fica com o combo quando corte, combo e barba vêm juntos', () => {
    const r = normalizeServiceSet(['Corte de cabelo', 'Corte + Barba na navalha com toalha quente', 'Barba Express']);
    expect(r.items).toEqual(['Corte + Barba na navalha com toalha quente']);
    expect(r.removed.map(x => x.name).sort()).toEqual(['Barba Express', 'Corte de cabelo']);
    expect(r.removed.every(x => x.keptBy === 'Corte + Barba na navalha com toalha quente')).toBe(true);
  });
  it('entre duas barbas fica a mais completa (maior preço)', () => {
    const r = normalizeServiceSet([{ name: 'Barba Express', price: 25 }, { name: 'Barba na navalha com toalha quente', price: 40 }]);
    expect(r.items.map(x => x.name)).toEqual(['Barba na navalha com toalha quente']);
  });
  it('mantém pai e filho e a ordem original', () => {
    const r = normalizeServiceSet(['Corte de cabelo infantil', 'Sobrancelha Masculina', 'Corte de cabelo']);
    expect(r.items).toEqual(['Corte de cabelo infantil', 'Sobrancelha Masculina', 'Corte de cabelo']);
    expect(r.removed).toEqual([]);
  });
  it('tira duplicata e pezinho redundante', () => {
    const r = normalizeServiceSet(['Corte de cabelo', 'Corte de cabelo', 'Pezinho (acabamento)']);
    expect(r.items).toEqual(['Corte de cabelo']);
  });
});

describe('splitServiceNames', () => {
  const known = ['Corte de cabelo', 'Corte + Barba na navalha com toalha quente', 'Barba Express', 'Corte + Lavagem', 'Sobrancelha Masculina'];
  it('não confunde o + do combo com o separador', () => {
    expect(splitServiceNames('Corte + Barba na navalha com toalha quente + Barba Express', known)).toEqual(['Corte + Barba na navalha com toalha quente', 'Barba Express']);
    expect(splitServiceNames('Corte de cabelo + Corte + Lavagem', known)).toEqual(['Corte de cabelo', 'Corte + Lavagem']);
    expect(splitServiceNames('Corte de cabelo + Sobrancelha Masculina', known)).toEqual(['Corte de cabelo', 'Sobrancelha Masculina']);
  });
});
