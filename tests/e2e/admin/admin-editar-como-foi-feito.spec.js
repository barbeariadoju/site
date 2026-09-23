// v29.220.0 — "Como foi feito" também no ✎ Editar (pedido do Juliano, 23/09/2026: concluiu o
// atendimento e esqueceu de anotar como o cliente corta). O campo abre com o que está no
// cadastro e só grava por admin_set_customer_style quando o texto muda — mesma regra do Concluir.

import { test, expect } from '@playwright/test';
import { mockAdmin } from './_supabase-mock.js';

const hoje = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const concluido = {
  id: 'mock-bk-edgar', customer_name: 'Edgar Fictício', customer_phone: '11955550099', customer_email: null,
  service_name: 'Corte de cabelo', service_price: 40, products_price: 0, products: null, duration_minutes: 45,
  booking_date: hoje(), start_time: '11:15:00', end_time: '12:00:00', status: 'completed', channel: 'juia_whatsapp',
  notes: null, payment_method: 'credito', products_payment_method: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
};

async function abrirEditar(page, overrides) {
  await mockAdmin(page, overrides);
  await page.goto('/admin-agenda.html');
  await expect(page.locator('#admin-app')).toBeVisible();
  const card = page.locator('.admin-booking-card', { hasText: 'Edgar Fictício' });
  await card.locator('[data-toggle-card]').click();
  await card.locator('[data-edit]').click();
  const modal = page.locator('#booking-edit-modal');
  await expect(modal).toBeVisible();
  return modal;
}

test('Editar: anota "Como foi feito" depois de concluir e grava no cadastro', async ({ page }) => {
  const gravados = [];
  const modal = await abrirEditar(page, {
    rpcs: { admin_set_customer_style: (b) => { gravados.push(b); return { ok: true }; } },
    tables: { bookings: [concluido] },
  });
  const campo = modal.locator('[data-style-notes]');
  await expect(campo).toHaveValue('');
  await campo.fill('máquina 2 dos lados, tesoura em cima');
  await page.screenshot({ path: 'test-results/admin-screens/editar-como-foi-feito.png' });
  await modal.locator('[data-edit-save]').click();
  await expect.poll(() => gravados.length).toBe(1);
  expect(gravados[0].p_phone).toBe('11955550099');
  expect(gravados[0].p_style).toBe('máquina 2 dos lados, tesoura em cima');
});

test('Editar: abre com o estilo do cadastro e não regrava se não mudou', async ({ page }) => {
  const gravados = [];
  const modal = await abrirEditar(page, {
    rpcs: { admin_set_customer_style: (b) => { gravados.push(b); return { ok: true }; } },
    tables: {
      bookings: [concluido],
      customer_profiles: [{ id: 'eeeeeeee-0000-4000-8000-000000000009', name: 'Edgar Fictício', phone: '11955550099', email: null, archived: false, style_preferences: { corte: 'degradê alto' }, created_at: '2026-01-10T12:00:00Z', updated_at: '2026-01-10T12:00:00Z' }],
    },
  });
  await expect(modal.locator('[data-style-notes]')).toHaveValue('degradê alto');
  await modal.locator('[data-edit-save]').click();
  await expect(modal).toBeHidden();
  await page.waitForTimeout(300);
  expect(gravados.length).toBe(0);
});
