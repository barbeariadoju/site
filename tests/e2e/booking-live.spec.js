import { test, expect } from '@playwright/test';

// Teste "de verdade": cria, reagenda e cancela um agendamento real no
// Supabase de produção, depois apaga tudo. Roda SÓ com:
//   npm run test:e2e:live
// (precisa de SUPABASE_SERVICE_ROLE_KEY no ambiente - nunca commitar essa
// chave; use um .env local, veja tests/README.md).
//
// Telefone é sempre fictício (5599900011234, mesmo padrão já usado nas
// sessões manuais de teste) para nunca disparar WhatsApp/e-mail real.

const SUPABASE_URL = 'https://rpkqluaxhqsxnewunhfm.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FAKE_PHONE = '5599900011234';

test.skip(!SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY não definida - ver tests/README.md');

async function admin(path, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: init.method === 'POST' ? 'return=representation' : (init.headers?.Prefer || ''),
      ...init.headers,
    },
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

async function rpc(fn, args) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`rpc ${fn} -> ${res.status}: ${await res.text()}`);
  return res.json();
}

test('cria, reagenda e cancela um agendamento real, depois limpa', async ({ page }) => {
  let bookingId;
  try {
    await page.goto('/agendar/');
    await page.getByRole('button', { name: 'Somente essenciais' }).click().catch(() => {});
    await page.locator('.service-card', { hasText: 'Corte de cabelo' }).first()
      .getByRole('button', { name: 'Adicionar' }).click();
    await page.locator('#open-service-cart').click();
    await page.locator('#send-services').click();
    await page.waitForURL(/\/agendar\/horario\/?$/);

    await page.locator('[data-next-step="2"]').click();
    const future = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await page.locator('#agenda-date').fill(future);
    const firstSlot = page.locator('#agenda-slots .agenda-slot').first();
    await expect(firstSlot).toBeVisible({ timeout: 15000 });
    await firstSlot.click();

    await page.locator('[data-next-step="3"]').click();
    await page.locator('#agenda-name').fill('TESTE Playwright live (ignorar)');
    await page.locator('#agenda-phone').fill(FAKE_PHONE);
    await page.locator('#agenda-email').fill('teste-e2e-live@example.com');
    await page.locator('[data-next-step="4"]').click();

    await page.locator('#agenda-submit').click();
    await expect(page.getByText('Agendamento confirmado com sucesso!')).toBeVisible({ timeout: 15000 });

    const [booking] = await admin(`bookings?customer_phone=eq.${FAKE_PHONE}&order=created_at.desc&limit=1`);
    expect(booking).toBeTruthy();
    expect(booking.status).toBe('confirmed');
    bookingId = booking.id;

    const [rescheduled] = await rpc('phone_reschedule_booking', {
      p_phone: FAKE_PHONE,
      p_booking_id: bookingId,
      p_new_booking_date: booking.booking_date,
      p_new_start_time: '09:00',
    });
    expect(rescheduled.start_time.slice(0, 5)).toBe('09:00');

    const [cancelled] = await rpc('whatsapp_cancel_booking', { p_phone: FAKE_PHONE, p_booking_id: bookingId });
    expect(cancelled.status).toBe('cancelled');
  } finally {
    if (bookingId) {
      await admin(`booking_customer_actions?booking_id=eq.${bookingId}`, { method: 'DELETE' });
      await admin(`email_queue?booking_id=eq.${bookingId}`, { method: 'DELETE' });
      await admin(`notification_log?booking_id=eq.${bookingId}`, { method: 'DELETE' });
      await admin(`bookings?id=eq.${bookingId}`, { method: 'DELETE' });
    }
  }
});
