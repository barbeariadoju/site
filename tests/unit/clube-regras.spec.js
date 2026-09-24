import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  faixaDesconto, mensalidade, TERMS_SHA256, TERMS_VERSION, textosAnuncio, textoBoasVindas, textoRenovacao,
  textoEmAberto, textoEncerrada, textoCancelamento, textoArrependimento, textoLinkPagamento, textoCodigo,
} from '../../supabase/functions/_shared/clube-regras.ts';
import { fimDoCiclo, fimDoCicloAncorado } from '../../supabase/functions/_shared/clube-pagbank.ts';

// v29.233.0 — Clube do Ju. Preços e régua aprovados pelo Juliano em 24/09/2026.

describe('régua de desconto e mensalidades aprovadas', () => {
  it('faixas: até 119 = 15%, 120-199 = 20%, 200+ = 25%', () => {
    expect(faixaDesconto(100)).toBe(15);
    expect(faixaDesconto(119.99)).toBe(15);
    expect(faixaDesconto(120)).toBe(20);
    expect(faixaDesconto(199)).toBe(20);
    expect(faixaDesconto(200)).toBe(25);
  });
  it('os cinco planos fixos batem com a tabela aprovada', () => {
    expect(mensalidade(100)).toBe(85);   // Clube Corte: 2 cortes
    expect(mensalidade(140)).toBe(112);  // Barba em Dia: 4 Barba Express
    expect(mensalidade(160)).toBe(128);  // Corte + Barba: 2 Corte + Barba Express
    expect(mensalidade(200)).toBe(150);  // Barboterapia Semanal: 4 Barboterapias
    expect(mensalidade(230)).toBe(172);  // Clube Completo
  });
  it('o banco usa a mesma régua (migration 171)', () => {
    const sql = readFileSync('database/migrations/171-v29.233.0-clube-do-ju.sql', 'utf8');
    expect(sql).toContain('when p_table >= 200 then 25 when p_table >= 120 then 20 else 15');
    for (const [id, preco] of [['clube-corte', 85], ['barba-em-dia', 112], ['corte-barba', 128], ['barboterapia-semanal', 150], ['clube-completo', 172], ['cadeira-cativa', 249]]) {
      expect(sql).toMatch(new RegExp(`'${id}'[\\s\\S]{0,400}?, ${preco}, `));
    }
  });
});

describe('contrato', () => {
  it('o hash do texto é o registrado (mudou o texto = versão nova)', () => {
    const txt = readFileSync('clube/contrato/v1.txt').toString('utf8').replace(/\r\n/g, '\n');
    expect(createHash('sha256').update(txt, 'utf8').digest('hex')).toBe(TERMS_SHA256);
    expect(TERMS_VERSION).toBe('v1');
  });
  it('as regras em destaque estão no texto', () => {
    const txt = readFileSync('clube/contrato/v1.txt', 'utf8');
    expect(txt).toContain('NO MÍNIMO 7 DIAS e NO MÁXIMO 30 DIAS');
    expect(txt).toContain('CANCELAR COM MENOS DE 24 HORAS OU FALTAR SEM AVISO CONTA COMO VISITA USADA');
    expect(txt).toMatch(/terça a quinta-feira/);
    expect(txt).toMatch(/art\. 49 do Código de Defesa do Consumidor/);
    expect(txt).toMatch(/sem multa e sem fidelidade/);
  });
});

describe('ciclos mensais contados da âncora (igual ao banco)', () => {
  it('ciclo comum', () => {
    expect(fimDoCiclo('2026-10-05')).toBe('2026-11-04');
    expect(fimDoCicloAncorado('2026-10-05', '2026-11-05')).toBe('2026-12-04');
  });
  it('âncora no dia 31 não escorrega', () => {
    expect(fimDoCiclo('2027-01-31')).toBe('2027-02-27');
    expect(fimDoCicloAncorado('2027-01-31', '2027-02-28')).toBe('2027-03-30');
    expect(fimDoCicloAncorado('2027-01-31', '2027-03-31')).toBe('2027-04-29');
  });
});

describe('textos para o cliente', () => {
  const todos = [
    ...textosAnuncio('JOAO silva'),
    textoBoasVindas({ nome: 'joão', plano: 'Clube Corte', valor: 85, inicio: '2026-10-05', fim: '2026-11-04', resumo: '2 visita(s) por ciclo: Corte de cabelo.', gerenciar: 'https://x' }),
    textoRenovacao({ nome: 'João', plano: 'Clube Corte', valor: 85, fimCiclo: '2026-11-04', link: 'https://x' }),
    textoEmAberto({ nome: 'João', link: 'https://x' }),
    textoEncerrada({ nome: 'João' }),
    textoCancelamento({ nome: 'João', fimCiclo: '2026-11-04' }),
    textoArrependimento({ nome: 'João', devolver: 85 }),
    textoLinkPagamento({ nome: 'João', plano: 'Clube Corte', valor: 85, link: 'https://x' }),
    textoCodigo('123456'),
  ];
  it('nenhum emoji além do 🙏 (regra de 01/09/2026)', () => {
    for (const t of todos) expect(t.replace(/🙏/gu, '')).not.toMatch(/\p{Extended_Pictographic}/u);
  });
  it('anúncio: três versões, com SAIR, com o link, sem expor vaga nem prometer percentual', () => {
    const a = textosAnuncio('João');
    expect(a).toHaveLength(3);
    for (const t of a) {
      expect(t).toContain('responda SAIR');
      expect(t).toContain('https://www.barbeariadoju.com.br/clube/');
      expect(t).not.toMatch(/vaga|hor[aá]rio livre|encaixe|\d+%/i);
      expect(t.startsWith('Olá, João.')).toBe(true);
    }
  });
  it('boas-vindas leva contrato e link da assinatura', () => {
    expect(todos[3]).toContain('/clube/contrato/');
    expect(todos[3]).toContain('mínimo 7 e no máximo 30 dias');
  });
});
