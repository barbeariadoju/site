import { test, expect } from '@playwright/test';

// v29.237.0 — quem chega pelo anúncio do Google e agenda no site leva o clique (gclid/wbraid/gbraid)
// junto com o agendamento, pra virar conversão offline quando o atendimento for concluído.
// A chamada ao create-public-booking é INTERCEPTADA e respondida aqui: nada é gravado no Supabase.

async function ateARevisao(page) {
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
}

async function confirmarCapturando(page) {
  let corpo = null;
  await page.route('**/functions/v1/create-public-booking', async (route) => {
    corpo = JSON.parse(route.request().postData() || '{}');
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'simulado pelo teste' }) });
  });
  page.on('dialog', (d) => d.dismiss().catch(() => {}));
  await page.locator('#agenda-submit').click();
  await expect.poll(() => corpo).not.toBeNull();
  return corpo;
}

test('agendamento de quem veio do anúncio leva o clique (wbraid no campo certo)', async ({ page }) => {
  const t = Date.now() - 2 * 60 * 60 * 1000;
  await page.addInitScript((t) => {
    try { localStorage.setItem('bdj_gclid_v1', JSON.stringify({ v: 'WBRAIDficticio1234567890', t, k: 'wbraid' })); } catch (e) {}
  }, t);
  await ateARevisao(page);
  const corpo = await confirmarCapturando(page);
  expect(corpo.click_id).toEqual({ v: 'WBRAIDficticio1234567890', k: 'wbraid', t });
});

test('sem clique de anúncio (ou vencido), o agendamento vai sem click_id', async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.setItem('bdj_gclid_v1', JSON.stringify({ v: 'GCLIDvencido1234567890', t: Date.now() - 100 * 864e5, k: 'gclid' })); } catch (e) {}
  });
  await ateARevisao(page);
  const corpo = await confirmarCapturando(page);
  expect(corpo.click_id).toBeNull();
});
