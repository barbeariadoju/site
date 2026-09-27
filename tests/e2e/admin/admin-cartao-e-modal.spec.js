// v29.251.0 — auditoria impeccable (27/09/2026).
// 1. Cartão de atendimento: só as ações do momento à vista; o resto em "Mais ações".
// 2. Todo modal do painel: foco entra, Esc fecha (como clicar no fundo), foco volta a quem abriu.
// Nada sai para a internet (ver _supabase-mock.js).

import { test, expect } from '@playwright/test';
import { mockAdmin } from './_supabase-mock.js';

async function abrirCartao(page, nome) {
  await mockAdmin(page, { rpcs: { get_available_slots_excluding: () => [{ slot_time: '09:00:00' }] } });
  await page.goto('/admin-agenda.html');
  await expect(page.locator('#admin-app')).toBeVisible();
  const card = page.locator('.admin-booking-card', { hasText: nome });
  await card.locator('[data-toggle-card]').click();
  return card;
}

test('cartão confirmado: Concluir, Remarcar e WhatsApp à vista; o resto em "Mais ações"', async ({ page }) => {
  const card = await abrirCartao(page, 'Pix Confirmado');
  const acoes = card.locator('.admin-booking-actions');
  await expect(acoes.locator('> button[data-status="completed"]')).toBeVisible();
  await expect(acoes.locator('> button[data-reschedule]')).toBeVisible();
  await expect(acoes.locator('> a', { hasText: 'WhatsApp' })).toBeVisible();
  // Cancelar e Ausência não ficam mais ao lado de Concluir
  await expect(acoes.locator('button[data-status="cancelled"]')).toBeHidden();
  await expect(acoes.locator('button[data-status="no_show"]')).toBeHidden();
  await acoes.locator('.admin-acoes-mais > summary').click();
  await expect(acoes.locator('button[data-status="cancelled"]')).toBeVisible();
  await expect(acoes.locator('button[data-edit]')).toBeVisible();
  // sem emoji nos rótulos das ações
  expect(await acoes.innerText()).not.toMatch(/\p{Extended_Pictographic}/u);
});

test('modal Remarcar: foco entra, Esc fecha e o foco volta ao botão', async ({ page }) => {
  const card = await abrirCartao(page, 'Pix Confirmado');
  const botao = card.locator('button[data-reschedule]');
  await botao.click();
  const modal = page.locator('#reschedule-inline-modal');
  await expect(modal).toBeVisible();
  await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('#reschedule-inline-modal'))).toBe(true);
  await expect(modal.locator('[role="dialog"]')).toHaveAttribute('aria-labelledby', /.+/);
  await page.keyboard.press('Escape');
  await expect(modal).toBeHidden();
  await expect(botao).toBeFocused();
});
