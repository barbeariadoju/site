// v29.198.2 — Avaliações Google: "Aprovar e publicar" chama a Edge Function de publicação no
// mesmo clique (caso Mauricio Lamberti, 17/09/2026: o Juliano aprovou pela notificação e a
// resposta ficou parada em "aprovado", porque publicar era um segundo botão que ninguém viu).
import { test, expect } from '@playwright/test';
import { mockAdmin } from './_supabase-mock.js';

test('aprovar uma avaliação pendente já publica no Google', async ({ page }) => {
  const { log } = await mockAdmin(page);
  await page.goto('/admin-avaliacoes.html');
  await expect(page.locator('#admin-app')).toBeVisible();
  const card = page.locator('.avaliacoes-card', { has: page.locator('[data-approve]') }).first();
  const btn = card.locator('[data-approve]');
  await expect(btn).toHaveText('Aprovar e publicar');
  await card.locator('[data-toggle-card]').click();
  await btn.click();
  await expect.poll(() => log.filter(l => l.includes('/functions/v1/google-reviews-publish')).length).toBeGreaterThan(0);
});
