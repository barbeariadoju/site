// v29.274.10 — caso do Juliano (05/10/2026): o Marcelo pagou no crédito pelo link do PagBank e
// o dinheiro não estava na conta. O Financeiro passa a separar o que já caiu do que vai cair,
// pelo prazo de cada forma (crédito online: 30 dias no padrão do PagBank; ajustável).
// Nada sai para a internet (ver _supabase-mock.js).

import { test, expect } from '@playwright/test';
import { mockAdmin } from './_supabase-mock.js';

const HOJE = new Date(2026, 9, 5, 12, 0, 0); // 05/10/2026
const ts = (dia, mes = 10) => new Date(2026, mes - 1, dia, 15, 0, 0).toISOString();

const bookings = [
  { id: 'bk-marcelo', customer_name: 'Marcelo Teste', customer_phone: '11999990001', booking_date: '2026-10-08', status: 'confirmed', service_name: 'Corte', service_price: 100, products_price: 0, start_time: '16:15:00', end_time: '17:40:00' },
  { id: 'bk-antigo', customer_name: 'Cliente Antigo', customer_phone: '11999990002', booking_date: '2026-09-01', status: 'completed', service_name: 'Corte', service_price: 60, products_price: 0, start_time: '10:00:00', end_time: '10:45:00' },
  { id: 'bk-pix', customer_name: 'Cliente Pix', customer_phone: '11999990003', booking_date: '2026-10-04', status: 'completed', service_name: 'Barba', service_price: 40, products_price: 0, start_time: '11:00:00', end_time: '11:30:00' },
];
const payments = [
  // crédito pago hoje: cai em 04/11 (30 dias) → a receber
  { id: 'p1', booking_id: 'bk-marcelo', status: 'paid', method: 'credito', amount_cents: 10000, paid_at: ts(5) },
  // crédito pago em 01/09: caiu em 01/10 → já deve ter caído
  { id: 'p2', booking_id: 'bk-antigo', status: 'paid', method: 'credito', amount_cents: 6000, paid_at: ts(1, 9) },
  // Pix: cai na hora
  { id: 'p3', booking_id: 'bk-pix', status: 'paid', method: 'pix', amount_cents: 4000, paid_at: ts(4) },
  // link criado e não pago: não entra
  { id: 'p4', booking_id: 'bk-pix', status: 'created', method: null, amount_cents: 4000, paid_at: null },
];

test('Financeiro separa o que o PagBank já liberou do que ainda vai cair', async ({ page }) => {
  await page.clock.setFixedTime(HOJE);
  await mockAdmin(page, { tables: { bookings, payments } });
  await page.goto('/admin-financeiro.html');
  await expect(page.locator('#admin-app')).toBeVisible();

  const box = page.locator('#fin-online');
  await expect(box.locator('[data-online-areceber]')).toHaveText(/R\$\s?100,00/);
  await expect(box).toContainText('04/11');
  const linhas = box.locator('tbody tr');
  await expect(linhas).toHaveCount(3);
  await expect(linhas.filter({ hasText: 'Marcelo Teste' })).toContainText('a receber');
  await expect(linhas.filter({ hasText: 'Cliente Antigo' })).toContainText('já deve ter caído');
  await expect(linhas.filter({ hasText: 'Cliente Pix' })).toContainText('já deve ter caído');

  // Plano de 14 dias no crédito: o do Marcelo passa a cair em 19/10.
  await box.locator('[data-prazo="credito"]').fill('14');
  await box.locator('[data-prazo="credito"]').dispatchEvent('change');
  await expect(box).toContainText('19/10');
  await box.screenshot({ path: 'test-results/financeiro-online.png' });
});
