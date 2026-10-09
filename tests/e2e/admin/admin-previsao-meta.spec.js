// v29.287.0 — pedido do Juliano (09/10/2026): a previsão do dia não aparecia no celular (a faixa compacta
// esconde o texto pequeno do card). Bloco "Previsão e meta" na tela Hoje: previsão = já entrou + ainda
// marcado; meta do dia = meta do mês ÷ dias que ele atende (terça a sábado, sem bloqueados); o mês.
// Nada sai para a internet (ver _supabase-mock.js).
import { test, expect } from '@playwright/test';
import { mockAdmin } from './_supabase-mock.js';

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const reais = (t) => Number(String(t).replace(/[^\d,]/g, '').replace(',', '.'));

test('Tela Hoje no celular: previsão do dia, meta do dia e do mês', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const hoje = new Date(), h = iso(hoje), mes = h.slice(0, 7);
  const ag = (id, hora, status, preco) => ({ id, booking_date: h, start_time: hora + ':00', end_time: hora + ':45', status, customer_name: 'Cliente ' + id, customer_phone: '1199999000' + id.slice(-1), service_name: 'Corte de cabelo', service_price: preco, duration_minutes: 45, products_price: 0, loyalty_discount: 0, discount_amount: 0, courtesy: false });
  await mockAdmin(page, {
    tables: {
      bookings: [ag('m1', '09:00', 'completed', 50), ag('m2', '10:00', 'completed', 80), ag('m3', '15:00', 'confirmed', 60)],
      revenue_goals: [{ month: '2026-01-01', revenue_goal: 14100 }],
      schedule_blocks: [],
    },
  });
  await page.goto('/admin.html');
  const box = page.locator('#today-meta');
  await expect(box).toBeVisible();
  await expect(box.locator('.today-meta-head strong')).toHaveText(/R\$\s*190,00/);
  await expect(box).toContainText('já entrou R$ 130,00');
  await expect(box).toContainText('agendados R$ 60,00');

  // meta do dia = 14.100 ÷ dias de terça a sábado do mês (sem bloqueios no mock)
  const [y, m] = mes.split('-').map(Number);
  let dias = 0; for (let d = 1; d <= new Date(y, m, 0).getDate(); d++) if (new Date(y, m - 1, d).getDay() >= 2) dias++;
  const metaDia = 14100 / dias;
  const atende = hoje.getDay() >= 2;
  if (atende) {
    const txt = await box.locator('.today-meta-msg').first().innerText();
    const mostrado = reais(txt.match(/\(R\$\s*([\d.,]+)\)/)[1]);
    expect(Math.abs(mostrado - metaDia)).toBeLessThan(0.01);
  } else {
    await expect(box).toContainText('Dia sem atendimento');
  }
  await expect(box.locator('.today-meta-mes')).toContainText('de R$ 14.100,00');
  await expect(box.locator('.today-meta-mes')).toContainText('agendados até o fim do mês R$ 60,00 (1 horário)');

  // no celular o bloco vem logo depois da faixa de números, antes da linha do dia
  const yMeta = (await box.boundingBox()).y, yLinha = (await page.locator('#dashboard-today-list').boundingBox()).y;
  expect(yMeta).toBeLessThan(yLinha);
  expect(yMeta).toBeLessThan(844);
  if (process.env.FOTO) await page.screenshot({ path: process.env.FOTO });
});
