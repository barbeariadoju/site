// v29.219.0 — Balcão com a forma de pagamento em botões e o total no rodapé fixo, igual ao
// "Concluir" da Agenda (pedido do Juliano, 23/09/2026: "ao invés de eu selecionar na lista,
// se fosse igual é na agenda ficaria mais padronizado e mais fácil de enxergar").

import { test, expect } from '@playwright/test';
import { mockAdmin } from './_supabase-mock.js';

test('Balcão: pagamento em botões, total e forma escolhida no rodapé', async ({ page }) => {
  await mockAdmin(page);
  await page.goto('/admin-balcao.html');
  await expect(page.locator('#admin-app')).toBeVisible();

  await expect(page.locator('select#balcao-payment')).toHaveCount(0);
  const footer = page.locator('.balcao-submit-row');
  await expect(footer.locator('#balcao-payment-label')).toHaveText('escolha a forma de pagamento');

  await page.locator('#balcao-services label.booking-service-option', { has: page.locator('input[value="Corte de cabelo"]') }).locator('strong').click();
  await expect(footer.locator('#balcao-total')).toHaveText(/R\$\s?40,00/);

  const pix = page.locator('#balcao-payment-grid [data-payment-option="pix"]');
  await pix.click();
  await expect(pix).toHaveClass(/is-selected/);
  await expect(page.locator('#balcao-payment')).toHaveValue('pix');
  await expect(footer.locator('#balcao-payment-label')).toHaveText('Pix');

  const debito = page.locator('#balcao-payment-grid [data-payment-option="debito"]');
  await debito.click();
  await expect(debito).toHaveClass(/is-selected/);
  await expect(pix).not.toHaveClass(/is-selected/);
  await expect(page.locator('#balcao-payment')).toHaveValue('debito');

  await page.locator('#balcao-payment-grid').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/balcao-pagamento.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#balcao-payment-grid').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/balcao-pagamento-celular.png' });
});

test('Balcão: sem forma de pagamento, o aviso aparece junto dos botões', async ({ page }) => {
  await mockAdmin(page);
  await page.goto('/admin-balcao.html');
  await expect(page.locator('#admin-app')).toBeVisible();
  await page.fill('#balcao-name', 'Cliente Fictício');
  await page.fill('#balcao-phone', '11999990000');
  await page.locator('#balcao-services label.booking-service-option', { has: page.locator('input[value="Corte de cabelo"]') }).locator('strong').click();
  await page.click('#balcao-save');
  await expect(page.locator('#balcao-payment-wrap #balcao-field-error')).toHaveText('Selecione a forma de pagamento.');
  await page.locator('#balcao-payment-grid [data-payment-option="dinheiro"]').click();
  await expect(page.locator('#balcao-field-error')).toHaveCount(0);
});
