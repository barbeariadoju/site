// Smoke test de TODAS as telas do admin, sem login e sem tocar no banco real
// (ver _supabase-mock.js). Para cada tela verifica que:
//   1. a tela de login NÃO aparece (sessão fictícia aceita);
//   2. o app renderiza (#admin-app visível);
//   3. dados fictícios esperados aparecem na tela (quando indicado em `veja`);
//   4. nenhum erro de JavaScript estourou no console;
// e salva um print inteiro da página em test-results/admin-screens/ como prova
// visual — dá pra abrir os PNGs e conferir o layout sem logar em nada.

import { test, expect } from '@playwright/test';
import { mockAdmin } from './_supabase-mock.js';

const PAGES = [
  { file: 'admin.html', nome: 'Visão geral (dashboard)', veja: 'Carla Exemplo' }, // aparece na lista de ausências
  { file: 'admin-agenda.html', nome: 'Agenda' },
  { file: 'admin-atendimento.html', nome: 'Modo Atendimento' },
  { file: 'admin-balcao.html', nome: 'Atendimento Balcão' },
  { file: 'admin-clientes.html', nome: 'CRM / Clientes', veja: 'Ana Fictícia' },
  { file: 'admin-fidelidade.html', nome: 'Fidelidade', veja: 'Ana Fictícia' },
  { file: 'admin-mensagens.html', nome: 'Mensagens', veja: 'Visitante Site' },
  { file: 'admin-notificacoes.html', nome: 'Notificações' },
  { file: 'admin-relatorios.html', nome: 'Relatórios', veja: 'Corte de cabelo' },
  { file: 'admin-espera.html', nome: 'Lista de espera', veja: 'Diego Fictício' },
  { file: 'admin-agendamento.html', nome: 'Novo agendamento' },
  { file: 'admin-assistente.html', nome: 'Assistente IA' },
  { file: 'admin-avaliacoes.html', nome: 'Avaliações Google', veja: 'Marcos Testando' },
];

// Ruído esperado que NÃO é bug das telas: recursos de PWA/push que não existem
// no servidor local de teste ou que o navegador headless bloqueia.
const RUIDO = [
  /favicon/i,
  /manifest/i,
  /service.?worker|sw\.js/i,
  /notification|push/i,
  /Failed to load resource.*(404|net::ERR)/i,
];

for (const p of PAGES) {
  test(`${p.nome} — ${p.file} abre sem login e renderiza sem erro`, async ({ page }) => {
    const erros = [];
    page.on('pageerror', (e) => erros.push(`pageerror: ${e}`));
    page.on('console', (m) => { if (m.type() === 'error') erros.push(`console: ${m.text()}`); });

    await mockAdmin(page);
    await page.goto('/' + p.file);

    await expect(page.locator('#admin-login')).toBeHidden({ timeout: 10000 });
    await expect(page.locator('#admin-app')).toBeVisible();
    if (p.veja) await expect(page.locator('#admin-app')).toContainText(p.veja, { timeout: 10000 });

    // dá um respiro para renderizações assíncronas terminarem antes do print
    await page.waitForTimeout(500);
    await page.screenshot({ path: `test-results/admin-screens/${p.file.replace('.html', '')}.png`, fullPage: true });

    const reais = erros.filter((t) => !RUIDO.some((rx) => rx.test(t)));
    expect(reais, `Erros de JavaScript em ${p.file}:\n${reais.join('\n')}`).toEqual([]);
  });
}
