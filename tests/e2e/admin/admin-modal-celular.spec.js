// v29.274.6 — modal aberto no celular não pode ter o botão de salvar atrás da barra de baixo.
// Caso do Juliano (01/10/2026): editando cliente no CRM pelo iPhone, o "Salvar cliente" ficava
// atrás da barra Hoje/Agenda/Agendar (z-index 99990 contra 1000 do modal) e ele teve de deitar o
// celular pra conseguir salvar. Nada sai para a internet (ver _supabase-mock.js).

import { test, expect } from '@playwright/test';
import { mockAdmin } from './_supabase-mock.js';

test.use({ viewport: { width: 390, height: 664 }, isMobile: true, hasTouch: true });

// O que está de fato no ponto central do botão (o toque cai ali).
const tocavel = (loc) => loc.evaluate((el) => {
  const b = el.getBoundingClientRect()
  const topo = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2)
  return b.bottom <= innerHeight && !!topo && (topo === el || el.contains(topo))
})

test('CRM no celular: "Salvar cliente" tocável e a barra de baixo some só enquanto o modal está aberto', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('juAdminInstallDismissed', '1'));
  await mockAdmin(page);
  await page.goto('/admin-clientes.html');
  await expect(page.locator('#admin-app')).toBeVisible();
  const nav = page.locator('.admin-mobile-nav');
  await expect(nav).toBeVisible();

  await page.locator('[data-edit-customer]').first().evaluate((b) => b.click());
  await expect(page.locator('#crm-customer-modal')).toBeVisible();
  const salvar = page.locator('#crm-customer-save');
  await salvar.scrollIntoViewIfNeeded();
  await expect(nav).toBeHidden();
  expect(await tocavel(salvar)).toBe(true);

  await page.keyboard.press('Escape');
  await expect(page.locator('#crm-customer-modal')).toBeHidden();
  await expect(nav).toBeVisible();
});
