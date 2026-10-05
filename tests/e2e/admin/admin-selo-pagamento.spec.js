// v29.274.9 — caso do Juliano (05/10/2026): o Marcelo pagou no crédito pelo Checkout PagBank e o
// selo do resumo do card dizia "Pix ✓". Crédito online cai no PagBank em outro prazo, então o selo
// tem que dizer a forma de verdade.
// Nada sai para a internet (ver _supabase-mock.js).

import { test, expect } from '@playwright/test';
import { mockAdmin } from './_supabase-mock.js';
import { makeFixtures } from './_fixtures.js';

const pad = (n) => String(n).padStart(2, '0');
const hoje = (() => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; })();
const agora = new Date().toISOString();

let seq = 0;
const visita = (nome, hora, over) => ({
  id: 'mock-selo-' + (++seq), customer_name: nome, customer_phone: `1195555${String(1000 + seq)}`, phone_key: `5555${String(1000 + seq)}`,
  customer_email: null, service_name: 'Corte de cabelo', service_price: 100, products_price: 0, duration_minutes: 45,
  status: 'confirmed', booking_date: hoje, start_time: `${hora}:00`, end_time: `${hora}:45`, channel: 'site',
  notes: null, products_payment_method: null, payment_method: null, created_at: agora, updated_at: agora,
  prepay_declared_at: agora, ...over,
});

test('selo do card diz a forma paga: crédito, débito, Pix e Pix manual', async ({ page }) => {
  const bookings = [
    ...makeFixtures().tables.bookings,
    visita('Selo Credito', '13:00', { prepay_key: 'checkout', prepay_confirmed_at: agora, payments: [{ method: 'credito', status: 'paid' }] }),
    visita('Selo Debito', '13:45', { prepay_key: 'checkout', prepay_confirmed_at: agora, payments: [{ method: 'debito', status: 'paid' }] }),
    visita('Selo PixOnline', '14:30', { prepay_key: 'checkout', prepay_confirmed_at: agora, payments: [{ method: 'pix', status: 'paid' }] }),
    visita('Selo PixManual', '15:15', { prepay_key: 'picpay', prepay_confirmed_at: agora }),
    visita('Selo Declarado', '16:00', { prepay_key: 'picpay' }),
  ];
  await mockAdmin(page, { tables: { bookings } });
  await page.goto('/admin-agenda.html');
  await expect(page.locator('#admin-app')).toBeVisible();

  const selo = (nome) => page.locator('.admin-booking-card', { hasText: nome }).first().locator('.admin-prepay-dot');
  await expect(selo('Selo Credito')).toHaveText('Crédito ✓');
  await expect(selo('Selo Debito')).toHaveText('Débito ✓');
  await expect(selo('Selo PixOnline')).toHaveText('Pix ✓');
  await expect(selo('Selo PixManual')).toHaveText('Pix ✓');
  await expect(selo('Selo Declarado')).toHaveText('Pix');
});
