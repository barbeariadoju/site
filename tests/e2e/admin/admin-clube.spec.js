// v29.233.0 — Tela do Clube do Ju no painel (admin-clube.html), com dados fictícios do mock.
import { test, expect } from '@playwright/test';
import { mockAdmin } from './_supabase-mock.js';

test('Clube: números do topo, pendências, aceite e lista de espera', async ({ page }) => {
  await mockAdmin(page);
  await page.goto('/admin-clube.html');
  await expect(page.locator('#admin-app')).toBeVisible();

  // Receita = ativa (85) + atrasada (249); recebido no mês = a cobrança paga de 85.
  await expect(page.locator('#clube-metric-receita')).toContainText('334,00');
  await expect(page.locator('#clube-metric-ativos')).toHaveText('1');
  await expect(page.locator('#clube-metric-vagas')).toHaveText('1/20 · 1/5');
  await expect(page.locator('#clube-metric-recebido')).toContainText('85,00');

  const pend = page.locator('#clube-pendencias');
  await expect(pend).toContainText('Devolver R$ 150,00 pelo PagBank');
  await expect(pend).toContainText('Mensalidade em aberto');
  await expect(pend).toContainText('Renato Cativo');

  // Cartão: telefone com wa.me, uso do ciclo, Cativa com dia/hora e cancelamento agendado.
  const paulo = page.locator('.clube-card', { hasText: 'Paulo Assinante' });
  await expect(paulo.locator('a.clube-wa')).toHaveAttribute('href', 'https://wa.me/5511911112222');
  await expect(paulo).toContainText('1 de 2 visitas no ciclo');
  const renato = page.locator('.clube-card', { hasText: 'Renato Cativo' });
  await expect(renato).toContainText('Toda quarta às 10h');
  await expect(renato).toContainText('Cancelamento agendado');

  // Prova do aceite fica nos detalhes.
  await paulo.locator('summary').click();
  await expect(paulo.locator('.clube-aceite')).toContainText('203.0.113.10');
  await expect(paulo.locator('.clube-aceite')).toContainText('v1');
  await expect(paulo).toContainText('fale comigo (Claude)');

  await expect(page.locator('#clube-espera')).toContainText('Lucas Esperando');
  await expect(page.locator('#clube-anuncio-counts')).toContainText('Na fila');
});

test('Clube: ligar a mensagem de lançamento pede confirmação e grava em club_settings', async ({ page }) => {
  const { log } = await mockAdmin(page);
  await page.goto('/admin-clube.html');
  const botao = page.locator('#clube-anuncio-toggle');
  await expect(botao).toHaveText('Ligar o envio');
  await botao.click();
  await expect(page.locator('.admin-dialog')).toContainText('2 por vez a cada 10 minutos');
  await page.locator('[data-dialog-ok]').click();
  await expect(botao).toHaveText('Pausar o envio');
  expect(log.some((l) => l.startsWith('PATCH /rest/v1/club_settings'))).toBe(true);
});
