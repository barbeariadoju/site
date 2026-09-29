// v29.261.0 — busca na lista de serviços e produtos (pedido do Juliano, 29/09/2026: "tive que rodar até
// água; se eu digito agua no campo vai direto na água pra eu selecionar"). Sem acento e sem maiúscula,
// filtra, abre o "Mais opções" quando o item é produto, e Enter marca o primeiro e limpa o campo.
// Nada sai para a internet (ver _supabase-mock.js).

import { test, expect } from '@playwright/test';
import { mockAdmin } from './_supabase-mock.js';

test('Concluir: "agua" + Enter marca a Água Mineral e a lista volta inteira', async ({ page }) => {
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e)));
  await page.setViewportSize({ width: 390, height: 800 }); // celular: "Mais opções" começa fechado
  await mockAdmin(page, { rpcs: { get_available_slots_excluding: () => [] } });
  await page.goto('/admin-agenda.html');
  await expect(page.locator('#admin-app')).toBeVisible();

  const card = page.locator('.admin-booking-card', { hasText: 'Pix Confirmado' });
  await card.locator('[data-toggle-card]').click();
  await card.locator('button[data-status="completed"]').click();

  const busca = page.locator('#payment-method-modal [data-lista-busca]');
  await expect(busca).toBeVisible();
  await expect(page.locator('#payment-method-modal [data-fold-extras]')).not.toHaveAttribute('open', '');

  await busca.fill('agua');
  const agua = page.locator('#payment-method-modal .products-modal-option', { hasText: 'Água Mineral' });
  await expect(agua).toBeVisible(); // abriu o "Mais opções" sozinho
  await expect(agua).toBeInViewport(); // e rolou até ela
  await expect(page.locator('#payment-method-modal .products-modal-option', { hasText: 'Pomada' })).toBeHidden();
  await expect(page.locator('#payment-method-modal .service-card', { hasText: 'Corte de cabelo' }).first()).toBeHidden();
  await page.screenshot({ path: 'test-results/admin-screens/concluir-busca-agua.png' });

  await busca.press('Enter');
  await expect(page.locator('[data-products-slot] [data-product-name="Água Mineral"]')).toBeChecked();
  await expect(busca).toHaveValue('');
  await expect(page.locator('#payment-method-modal .service-card', { hasText: 'Corte de cabelo' }).first()).toBeVisible();

  await busca.fill('xyz');
  await expect(page.locator('#payment-method-modal [data-lista-busca-msg]')).toHaveText('Nada com "xyz".');
  expect(erros).toEqual([]);
});

test('Balcão: busca acha serviço sem acento ("barboterapia")', async ({ page }) => {
  await mockAdmin(page);
  await page.goto('/admin-balcao.html');
  await expect(page.locator('#admin-app')).toBeVisible();
  const busca = page.locator('[data-lista-busca]');
  await expect(busca).toBeVisible();
  await busca.fill('OZONIO');
  await expect(page.locator('#balcao-services .service-card', { hasText: 'ozônio' })).toBeVisible();
  await expect(page.locator('#balcao-services .service-card', { hasText: 'Raspar a cabeça' })).toBeHidden();
  await busca.press('Enter');
  await expect(page.locator('#balcao-services input[value="Barboterapia com vaporizador de ozônio"]')).toBeChecked();
});
