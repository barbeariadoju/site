// v29.271.0 — pedido do Juliano (01/10/2026):
// 1. Concluir: a forma de pagamento que o cliente costuma usar já vem marcada, com a dica, e o botão
//    diz o que vai gravar ("Concluir · Débito ✓"), pra ele não concluir com a forma errada sem ver.
// 2. Tela Hoje: "previsão do dia" = faturado + o que ainda está marcado.
// Nada sai para a internet (ver _supabase-mock.js).

import { test, expect } from '@playwright/test';
import { mockAdmin } from './_supabase-mock.js';
import { makeFixtures } from './_fixtures.js';

const pad = (n) => String(n).padStart(2, '0');
const hoje = (() => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; })();
const diasAtras = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

const RAFAEL = { customer_name: 'Rafael Hábito', customer_phone: '11955557777', phone_key: '55557777', customer_email: null };
const visita = (over) => ({
  id: 'mock-pref-' + Math.random().toString(36).slice(2, 10), ...RAFAEL,
  service_name: 'Corte de cabelo', service_price: 50, products_price: 0, duration_minutes: 45,
  start_time: '10:00:00', end_time: '10:45:00', channel: 'site', notes: null, products_payment_method: null,
  created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...over,
});

function comHistorico() {
  const base = makeFixtures().tables.bookings;
  return [
    ...base,
    visita({ status: 'completed', booking_date: diasAtras(15), payment_method: 'debito' }),
    visita({ status: 'completed', booking_date: diasAtras(30), payment_method: 'debito' }),
    visita({ status: 'completed', booking_date: diasAtras(45), payment_method: 'pix' }),
    visita({ status: 'completed', booking_date: diasAtras(60), payment_method: 'debito' }),
    visita({ status: 'confirmed', booking_date: hoje, start_time: '11:00:00', end_time: '11:45:00', payment_method: null }),
  ];
}

test('Concluir: forma de sempre já marcada, com dica, e o botão diz a forma', async ({ page }) => {
  await mockAdmin(page, { tables: { bookings: comHistorico() } });
  await page.goto('/admin-agenda.html');
  await expect(page.locator('#admin-app')).toBeVisible();
  const card = page.locator('.admin-booking-card', { hasText: 'Rafael Hábito' }).filter({ has: page.locator('button[data-status="completed"]') }).first();
  await card.locator('[data-toggle-card]').click();
  await card.locator('button[data-status="completed"]').click();

  const modal = page.locator('.admin-modal:not([hidden])', { hasText: 'Concluir atendimento' });
  await expect(modal).toBeVisible();
  await expect(modal.locator('[data-payment-hint]')).toContainText('Costuma pagar no Débito (3 de 4');
  await expect(modal.locator('[data-payment-slot] [data-payment-option="debito"]')).toHaveClass(/is-selected/);
  await expect(modal.locator('[data-payment-confirm]')).toHaveText('Concluir · Débito ✓');
  await modal.screenshot({ path: 'test-results/pagamento-preferido-1-debito.png' });

  // Hoje foi Pix: um toque troca, a dica some e o botão acompanha.
  await modal.locator('[data-payment-slot] [data-payment-option="pix"]').click();
  await expect(modal.locator('[data-payment-confirm]')).toHaveText('Concluir · Pix ✓');
  await expect(modal.locator('[data-payment-hint]')).toHaveCount(0);
  await modal.locator('.checkout-footer').screenshot({ path: 'test-results/pagamento-preferido-2-pix.png' });
});

test('Concluir: cliente sem histórico não vem marcado e o botão fica "Concluir ✓"', async ({ page }) => {
  await mockAdmin(page, { tables: { bookings: [...makeFixtures().tables.bookings, visita({ status: 'confirmed', booking_date: hoje, start_time: '11:00:00', end_time: '11:45:00', payment_method: null, customer_name: 'Novo Sem Histórico', customer_phone: '11955558888', phone_key: '55558888' })] } });
  await page.goto('/admin-agenda.html');
  const card = page.locator('.admin-booking-card', { hasText: 'Novo Sem Histórico' }).first();
  await card.locator('[data-toggle-card]').click();
  await card.locator('button[data-status="completed"]').click();
  const modal = page.locator('.admin-modal:not([hidden])', { hasText: 'Concluir atendimento' });
  await expect(modal).toBeVisible();
  await page.waitForTimeout(500);
  await expect(modal.locator('[data-payment-hint]')).toHaveCount(0);
  await expect(modal.locator('[data-payment-slot] .is-selected')).toHaveCount(0);
  await expect(modal.locator('[data-payment-confirm]')).toHaveText('Concluir ✓');
});

test('Tela Hoje: o card do faturado mostra a previsão do dia', async ({ page }) => {
  await mockAdmin(page, { tables: { bookings: comHistorico() } });
  await page.goto('/admin.html');
  await expect(page.locator('#admin-app')).toBeVisible();
  const sub = page.locator('#metric-revenue-sub');
  await expect(sub).toContainText('previsão do dia R$');
  const faturado = Number((await page.locator('#metric-revenue').innerText()).replace(/[^\d,]/g, '').replace(',', '.'));
  const previsao = Number((await sub.innerText()).match(/previsão do dia R\$\s*([\d.,]+)/)[1].replace(/\./g, '').replace(',', '.'));
  // marcados hoje que ainda não foram concluídos: os dois Pix das fixtures (R$ 40 cada) + o Rafael (R$ 50)
  expect(previsao).toBeCloseTo(faturado + 130, 2);
  await page.locator('#metric-revenue').locator('xpath=ancestor::article[1]').screenshot({ path: 'test-results/previsao-do-dia.png' });
});
