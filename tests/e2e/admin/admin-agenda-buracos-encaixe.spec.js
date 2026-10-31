// v29.330.0 — buracos de encaixe na lista do dia da Agenda (pedido do Juliano, 31/10/2026: "se tiver 30 min entre um
// atendimento e outro dá pra encaixar — queria algum mecanismo que mostrasse isso pra eu tentar encaixar").

import { test, expect } from '@playwright/test';
import { mockAdmin } from './_supabase-mock.js';

test('Agenda: buraco livre aparece na ordem do horário e "Encaixar" abre o Novo agendamento com a hora', async ({ page }) => {
  await mockAdmin(page, {
    rpcs: {
      admin_encaixes: () => [{ inicio: '16:15:00', fim: '17:00:00', minutos: 45 }],
      get_available_slots_excluding: () => [],
      get_available_slots: () => [],
    },
  });
  await page.goto('/admin-agenda.html');
  await expect(page.locator('#admin-app')).toBeVisible();
  const lista = page.locator('#agenda-day-list');
  const buraco = lista.locator('.agenda-gap-inline');
  await expect(buraco).toHaveCount(1);
  await expect(buraco).toContainText('16:15–17:00');
  await expect(buraco).toContainText('Livre · 45 min');
  await expect(buraco).toContainText('cabe um corte');
  // "Pix Declarado" é 17:00 (fixtures): o buraco das 16:15 vem antes dele.
  const textos = await lista.locator(':scope > *').allTextContents();
  const iBuraco = textos.findIndex((t) => t.includes('Livre · 45 min'));
  const iDecl = textos.findIndex((t) => t.includes('Pix Declarado'));
  expect(iBuraco).toBeGreaterThanOrEqual(0);
  expect(iBuraco).toBeLessThan(iDecl);
  await buraco.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/admin-screens/agenda-buraco-encaixe.png' });
  await buraco.getByRole('button', { name: 'Encaixar' }).click();
  await expect(page).toHaveURL(/admin-agendamento/);
  await expect(page.locator('#booking-time')).toHaveValue('16:15');
});
