// v29.235.0 — previsão de término no card da Agenda (pedido do Juliano, 25/09/2026: "filipe 19:30
// previsto término 20:15… pra eu pensar rápido"). O "até HH:MM" vem do end_time do próprio agendamento.

import { test, expect } from '@playwright/test';
import { mockAdmin } from './_supabase-mock.js';

test('Agenda: cada card mostra o horário previsto de término embaixo do início', async ({ page }) => {
  await mockAdmin(page);
  await page.goto('/admin-agenda.html');
  await expect(page.locator('#admin-app')).toBeVisible();
  const cards = page.locator('#agenda-day-list .admin-booking-card');
  await expect(cards.first()).toBeVisible();
  const n = await cards.count();
  expect(n).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) {
    const hora = cards.nth(i).locator('.admin-booking-time-mini');
    const inicio = (await hora.evaluate((el) => el.firstChild?.textContent || '')).trim();
    const fim = hora.locator('.admin-booking-fim');
    await expect(fim).toHaveText(/^até \d{2}:\d{2}$/);
    const fimHm = (await fim.textContent()).replace('até ', '');
    expect(fimHm > inicio).toBe(true);
  }
  await page.screenshot({ path: 'test-results/admin-screens/agenda-previsao-termino.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await cards.first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/admin-screens/agenda-previsao-termino-celular.png' });
});
