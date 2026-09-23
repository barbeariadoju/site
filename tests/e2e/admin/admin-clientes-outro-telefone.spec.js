// v29.230.0 — segundo telefone no mesmo cadastro (pedido do Juliano, 23/09/2026). O card mostra o outro
// telefone, a busca acha o cliente por ele, e "＋ Telefone" chama admin_add_customer_phone.

import { test, expect } from '@playwright/test';
import { mockAdmin } from './_supabase-mock.js';

test('CRM: outro telefone aparece no card, entra na busca e pode ser adicionado', async ({ page }) => {
  const chamadas = [];
  await mockAdmin(page, {
    tables: { customer_phone_aliases: [{ alias_key: '1199998888', customer_id: 'aaaaaaaa-0000-4000-8000-000000000001', phone: '11999998888', note: 'mesclado' }] },
    rpcs: { admin_add_customer_phone: (b) => { chamadas.push(b); return { ok: true }; } },
  });
  await page.goto('/admin-clientes.html');
  await expect(page.locator('#admin-app')).toBeVisible();

  await page.fill('#crm-search', '99999-8888');
  await page.click('#crm-search-button');
  const card = page.locator('.crm-card', { hasText: 'Ana Fictícia' });
  await expect(card).toHaveCount(1);
  await card.locator('[data-toggle-card]').click();
  await expect(card.locator('.crm-alias-line')).toContainText('Outro telefone');
  await expect(card.locator('.crm-alias-line')).toContainText('99999-8888');

  await card.locator('.crm-alias-line').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/admin-screens/crm-outro-telefone.png' });
  await card.locator('[data-add-phone]').click();
  const campo = page.locator('.admin-dialog-card input').first();
  await campo.fill('11 97777-6666');
  await page.keyboard.press('Enter');
  await expect.poll(() => chamadas.length).toBe(1);
  expect(chamadas[0].p_phone).toBe('11 97777-6666');
});
