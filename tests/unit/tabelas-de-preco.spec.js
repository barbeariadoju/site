import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { valor } from '../e2e/_precos.js';

// v29.311.0 — caso do corte infantil (27/10/2026): a tabela de /servicos.html ficou com os preços de setembro
// por quase um mês. O script do reajuste procurava "R$ 40" e a tabela escreve "<small>R$</small>40", então a
// página inteira ficou de fora; uma cliente mostrou o print e o Juliano cobrou R$ 40 no infantil. As duas
// tabelas do site passam a ser conferidas contra o catálogo (services-catalog-v7.js), o mesmo do /agendar/.

const NOME = {
  'corte masculino (visao geral)': 'Corte de cabelo', 'corte de cabelo (degrade)': 'Corte de cabelo', 'corte de cabelo (social)': 'Corte de cabelo',
  'barba na navalha com toalha quente em braganca paulista': 'Barba na navalha com toalha quente',
  'luzes masculinas': 'Luzes', 'nevou / platinado masculino': 'Nevou / Platinado', 'depilacao de orelhas': 'Depilação orelhas',
};
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const catalogo = [...fs.readFileSync(new URL('../../services-catalog-v7.js', import.meta.url), 'utf8').matchAll(/name:'([^']+)'/g)].map((m) => m[1]);
const doCatalogo = (nome) => NOME[norm(nome)] || catalogo.find((c) => norm(c) === norm(nome));

const linhas = (arquivo) => [...fs.readFileSync(new URL(`../../${arquivo}`, import.meta.url), 'utf8')
  .matchAll(/<div class="(?:price-)?item">([\s\S]*?)<\/div>/g)]
  .map((m) => ({
    nome: m[1].replace(/<small class="dur">[\s\S]*?<\/small>/, '').match(/<span class="nome">([\s\S]*?)<\/span>/)[1].replace(/<[^>]+>/g, '').trim(),
    preco: Number(m[1].match(/<small>R\$\s?<\/small>\s?(\d+)/)[1]),
  }));
const numero = (txt) => Number(String(txt).replace(/[^\d,]/g, '').replace(',', '.'));

describe.each(['servicos.html', 'precos/index.html'])('tabela de preços de %s', (arquivo) => {
  const itens = linhas(arquivo);
  it('tem a tabela', () => expect(itens.length).toBeGreaterThan(15));
  it.each(itens.map((i) => [i.nome, i]))('%s bate com o catálogo', (_, i) => {
    const nome = doCatalogo(i.nome);
    expect(nome, `"${i.nome}" não casa com nenhum serviço do catálogo`).toBeTruthy();
    expect(i.preco).toBe(numero(valor(nome)));
  });
});
