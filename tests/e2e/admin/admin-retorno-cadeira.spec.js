// v29.210.0 — Concluir com produto para casa à vista e retorno marcado na cadeira.
// A regra das datas está em tests/unit/retorno-cadeira.spec.js; aqui se prova o que o unitário
// não vê: o módulo carrega por import() dentro do script clássico do painel, a sugestão de
// produto marca a caixinha certa da lista completa, e um toque no retorno chama
// admin_create_booking com terça/quarta/quinta e a anotação que permite medir o aceite.
// Nada sai para a internet (ver _supabase-mock.js).

import { test, expect } from '@playwright/test';
import { mockAdmin } from './_supabase-mock.js';

test('Concluir: sugere produto do serviço e oferece o retorno de terça a quinta', async ({ page }) => {
  const criados = [];
  const erros = [];
  page.on('pageerror', (e) => erros.push(String(e)));
  await mockAdmin(page, {
    rpcs: {
      get_available_slots_excluding: () => [{ slot_time: '09:00:00' }, { slot_time: '17:15:00' }],
      admin_create_booking: (body) => { criados.push(body); return 'mock-retorno-1'; },
    },
  });
  await page.goto('/admin-agenda.html');
  await expect(page.locator('#admin-app')).toBeVisible();

  // "Pix Confirmado": hoje 17:30, Corte de cabelo, Pix já confirmado (pagamento pré-selecionado)
  const card = page.locator('.admin-booking-card', { hasText: 'Pix Confirmado' });
  await card.locator('[data-toggle-card]').click();
  await card.locator('button[data-status="completed"]').click();

  const sug = page.locator('[data-suggest-slot]');
  await expect(sug).toBeVisible();
  await expect(sug).toContainText('Produto para casa?');
  const botoes = sug.locator('[data-suggest-product]');
  await expect(botoes).toHaveCount(3);
  await expect(sug).not.toContainText('Coca'); // bebida nunca é sugestão
  await expect(sug).not.toContainText('Anticaspa'); // produto de condição fica só na lista completa

  const nome = await botoes.first().getAttribute('data-suggest-product');
  await botoes.first().click();
  await expect(botoes.first()).toHaveClass(/is-selected/);
  // marcado tem que se ver (poll: o botão tem transição de cor)
  const fundo = (i) => botoes.nth(i).evaluate((el) => getComputedStyle(el).backgroundColor);
  await expect.poll(async () => (await fundo(0)) !== (await fundo(1))).toBe(true);
  await expect(page.locator(`[data-products-slot] [data-product-name="${nome}"]`)).toBeChecked();

  await page.screenshot({ path: 'test-results/admin-screens/concluir-produto-sugerido.png' });
  await page.locator('[data-payment-confirm]').click();

  const titulo = page.locator('#rc-title');
  await expect(titulo).toBeVisible({ timeout: 10000 });
  const opcoes = page.locator('[data-rc-pick]');
  expect(await opcoes.count()).toBeGreaterThan(0);
  expect(await opcoes.count()).toBeLessThanOrEqual(3);
  for (const t of await opcoes.allTextContents()) expect(t).toMatch(/^(terça|quarta|quinta) \d{2}\/\d{2} às 17:15$/);

  await page.screenshot({ path: 'test-results/admin-screens/retorno-cadeira-opcoes.png' });
  await opcoes.first().click();
  await expect.poll(() => criados.length).toBe(1);
  const b = criados[0];
  expect(b.p_notes).toBe('Retorno marcado na cadeira');
  expect(b.p_service_name).toBe('Corte de cabelo');
  expect(b.p_start_time).toBe('17:15');
  expect([2, 3, 4]).toContain(new Date(`${b.p_booking_date}T12:00:00-03:00`).getUTCDay());
  await expect(page.locator('.admin-toast')).toContainText('Retorno marcado');

  await page.screenshot({ path: 'test-results/admin-screens/retorno-cadeira.png' });
  expect(erros).toEqual([]);
});
