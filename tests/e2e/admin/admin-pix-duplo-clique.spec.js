// v29.263.0 — caso Aletéia (29/09/2026, 18h08): dois cliques em "Confirmar que o Pix caiu" mandaram
// duas mensagens "Pagamento confirmado" pro cliente. O botão trava no primeiro clique (antes da
// pergunta de confirmação), então o segundo clique não abre outra pergunta nem chama a function.
// Nada sai para a internet (ver _supabase-mock.js).

import { test, expect } from '@playwright/test';
import { mockAdmin } from './_supabase-mock.js';

test('Confirmar Pix: clique duplo chama o prepay-confirm uma vez só', async ({ page }) => {
  const chamadas = [];
  await mockAdmin(page, { functions: { 'prepay-confirm': (body) => { chamadas.push(body); return { ok: true, avisou: true }; } } });
  await page.goto('/admin-agenda.html');
  await expect(page.locator('#admin-app')).toBeVisible();

  const card = page.locator('.admin-booking-card', { hasText: 'Pix Declarado' });
  await card.locator('[data-toggle-card]').click();
  const botao = card.locator('[data-confirm-prepay]');
  await botao.click();
  await expect(botao).toBeDisabled();
  await botao.dispatchEvent('click'); // segundo clique com a pergunta já aberta
  await botao.dispatchEvent('click');
  await expect(page.locator('[data-dialog-ok]')).toHaveCount(1); // uma pergunta só
  await page.locator('[data-dialog-ok]').click();
  await expect.poll(() => chamadas.length).toBe(1);
  await page.waitForTimeout(500);
  expect(chamadas.length).toBe(1);
});
