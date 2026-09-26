import { test, expect } from '@playwright/test';

// v29.240.0 — regra do sinal de 50% (Juliano, 26/09/2026): quando os dois últimos horários do cliente foram
// falta ou cancelamento em cima da hora, o servidor devolve `sinal` e a tela de sucesso avisa. A chamada ao
// create-public-booking é INTERCEPTADA e respondida aqui: nada é gravado no Supabase.

async function agendar(page, resposta) {
  await page.route('**/functions/v1/create-public-booking', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(resposta) }));
  await page.goto('/agendar/');
  await page.getByRole('button', { name: 'Somente essenciais' }).click().catch(() => {});
  await page.locator('.service-card', { hasText: 'Corte de cabelo' }).first().getByRole('button', { name: 'Adicionar' }).click();
  await page.locator('#open-service-cart').click();
  await page.locator('#send-services').click();
  await page.waitForURL(/\/agendar\/horario\/?$/);
  await page.locator('[data-next-step="2"]').click();
  const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await page.locator('#agenda-date').fill(future);
  const slot = page.locator('#agenda-slots .agenda-slot').first();
  await expect(slot).toBeVisible({ timeout: 15000 });
  await slot.click();
  await page.locator('[data-next-step="3"]').click();
  await page.locator('#agenda-name').fill('TESTE Playwright (ignorar)');
  await page.locator('#agenda-phone').fill('5599900011234');
  await page.locator('[data-next-step="4"]').click();
  await page.locator('#agenda-submit').click();
  await expect(page.locator('#agenda-status')).toContainText('Agendamento confirmado', { timeout: 15000 });
}

const base = { ok: true, id: 'simulado', record: {}, push: {}, email: {}, booking_code: 'TESTE1', management_token: 'tok', referral: '', manage_url: '/meu-agendamento.html?code=TESTE1&token=tok' };

test('com a regra ativa, a tela avisa o sinal de 50%', async ({ page }) => {
  await agendar(page, { ...base, sinal: 20 });
  await expect(page.locator('.booking-sinal-aviso')).toContainText('sinal de 50%');
  await expect(page.locator('.booking-sinal-aviso')).toContainText('20,00');
});

test('sem a regra, a tela não fala em sinal', async ({ page }) => {
  await agendar(page, { ...base, sinal: 0 });
  await expect(page.locator('.booking-sinal-aviso')).toHaveCount(0);
});
