// v29.267.0 — o mesmo serviço mais de uma vez no mesmo atendimento (pedido do Juliano, 30/09/2026:
// "precisei agendar pra Geovana 3 cortes, 1 corte pro marido e 2 cortes infantis; tive que gerar 2
// agendamentos"). O contador − n + do serviço marcado repete o nome no agendamento, e preço e
// duração somam. Nada sai para a internet (ver _supabase-mock.js).
import { test, expect } from '@playwright/test';
import { mockAdmin } from './_supabase-mock.js';

test('Novo agendamento: 1 corte + 2 cortes infantis num agendamento só', async ({ page }) => {
  const chamadas = [];
  await mockAdmin(page, { rpcs: { admin_create_booking: (body) => { chamadas.push(body); return 'mock-bk-novo'; } } });
  await page.goto('/admin-agendamento.html');
  await expect(page.locator('#admin-app')).toBeVisible();
  await page.waitForFunction(() => !!window.BDJ_SERVICE_RULES?.applyToPicker, null, { timeout: 10000 });

  const card = (name) => page.locator('#booking-services .service-card', { has: page.locator(`input[value="${name}"]`) });
  await card('Corte de cabelo').locator('label.service-btn').click();
  await card('Corte de cabelo infantil').locator('label.service-btn').click();
  const infantil = card('Corte de cabelo infantil');
  await infantil.locator('[data-qty-inc]').click();
  await expect(infantil.locator('[data-qty-view]')).toHaveText('2');
  await expect(page.locator('#booking-service-summary')).toContainText('3 serviços');

  // − no 2 volta a 1; − no 1 desmarca; + num desmarcado marca de novo
  await infantil.locator('[data-qty-dec]').click();
  await expect(infantil.locator('[data-qty-view]')).toHaveText('1');
  await infantil.locator('[data-qty-inc]').click();

  await page.locator('#booking-name').fill('Geovana Teste');
  await page.locator('#booking-phone').fill('11955557777');
  await page.locator('#booking-time').fill('10:00');
  await page.locator('#booking-save').click();
  await expect.poll(() => chamadas.length).toBe(1);
  const b = chamadas[0];
  expect(b.p_service_name).toBe('Corte de cabelo + Corte de cabelo infantil + Corte de cabelo infantil');
  expect(b.p_service_price).toBeGreaterThan(0);
  expect(b.p_duration_minutes).toBeGreaterThan(60); // soma as três durações
});

test('separar(): combos com "+" no nome e repetição voltam certos', async ({ page }) => {
  await mockAdmin(page);
  await page.goto('/admin-agendamento.html');
  await expect(page.locator('#admin-app')).toBeVisible();
  const r = await page.evaluate(() => {
    const L = window.BDJ_LISTA;
    const nomes = ['Corte de cabelo', 'Corte + Lavagem', 'Corte de cabelo infantil'];
    const partes = L.separar('Corte + Lavagem + Corte de cabelo infantil + Corte de cabelo infantil', nomes);
    return { partes, qtd: [...L.contar(partes)] };
  });
  expect(r.partes).toEqual(['Corte + Lavagem', 'Corte de cabelo infantil', 'Corte de cabelo infantil']);
  expect(r.qtd).toEqual([['Corte + Lavagem', 1], ['Corte de cabelo infantil', 2]]);
});
