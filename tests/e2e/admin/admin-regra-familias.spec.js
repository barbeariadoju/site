// v29.198.0 — Regra das famílias nas caixinhas do admin (pedido do Juliano, 17/09/2026:
// "posso colocar 2 cabelos, 2 barbas, ele não entende a redundância"). A lógica em si está
// coberta em tests/unit/service-rules.spec.js; este teste prova o que o unitário não vê: que a
// ponte <script type="module"> (admin-service-rules-v30.js) carrega de verdade na página, expõe
// window.BDJ_SERVICE_RULES e o picker de Novo agendamento e o do Balcão reagem ao clique.

import { test, expect } from '@playwright/test';
import { mockAdmin } from './_supabase-mock.js';

test('Novo agendamento: marcar Barba na navalha desmarca a Barba Express e explica', async ({ page }) => {
  await mockAdmin(page);
  await page.goto('/admin-agendamento.html');
  await expect(page.locator('#admin-app')).toBeVisible();
  await page.waitForFunction(() => !!window.BDJ_SERVICE_RULES?.applyToPicker, null, { timeout: 10000 });

  const cb = (name) => page.locator(`#booking-services input[name="booking-service"][value="${name}"]`);
  // o input é invisível (opacity 0) e o clique real é no cartão, como o Juliano faz
  const tap = (name) => page.locator('#booking-services label.booking-service-option', { has: page.locator(`input[value="${name}"]`) }).locator('strong').click();
  await tap('Corte de cabelo');
  await tap('Barba Express');
  await expect(cb('Barba Express')).toBeChecked();

  await tap('Barba na navalha com toalha quente');
  await expect(cb('Barba na navalha com toalha quente')).toBeChecked();
  await expect(cb('Barba Express')).not.toBeChecked();
  await expect(cb('Corte de cabelo')).toBeChecked();
  await expect(page.locator('#booking-services [data-service-rule-msg]')).toContainText('Só 1 serviço de barba');

  // pezinho em cima do corte: não entra, e a linha explica
  await tap('Pezinho (acabamento)');
  await expect(cb('Pezinho (acabamento)')).not.toBeChecked();
  await expect(page.locator('#booking-services [data-service-rule-msg]')).toContainText('já inclui o pezinho');

  // desmarcar nunca mexe nas outras
  await tap('Barba na navalha com toalha quente');
  await expect(cb('Corte de cabelo')).toBeChecked();
});

test('Balcão: combo "Corte + Barba Express" desmarca corte e barba soltos', async ({ page }) => {
  await mockAdmin(page);
  await page.goto('/admin-balcao.html');
  await expect(page.locator('#admin-app')).toBeVisible();
  await page.waitForFunction(() => !!window.BDJ_SERVICE_RULES?.applyToPicker, null, { timeout: 10000 });

  const cb = (name) => page.locator(`#balcao-services input[name="balcao-service"][value="${name}"]`);
  const tap = (name) => page.locator('#balcao-services label.booking-service-option', { has: page.locator(`input[value="${name}"]`) }).locator('strong').click();
  await tap('Corte de cabelo');
  await tap('Barba Express');
  await tap('Corte + Barba Express');
  await expect(cb('Corte + Barba Express')).toBeChecked();
  await expect(cb('Corte de cabelo')).not.toBeChecked();
  await expect(cb('Barba Express')).not.toBeChecked();
});
