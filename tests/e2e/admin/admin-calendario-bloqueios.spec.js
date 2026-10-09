// v29.286.0 — pedido do Juliano (09/10/2026): "faz mostrar neste calendário os bloqueios pra não me
// confundir". O calendário do Novo agendamento marca o dia inteiro bloqueado, o bloqueio de parte do dia
// e domingo/segunda, lista o motivo, e escolher a data continua gravando o ISO no #booking-date.
// Nada sai para a internet (ver _supabase-mock.js).
import { test, expect } from '@playwright/test';
import { mockAdmin } from './_supabase-mock.js';

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

test('Novo agendamento: calendário mostra os bloqueios e o motivo', async ({ page }) => {
  // dias de terça a sexta deste mês a partir de hoje (o mês aberto é o da data de hoje)
  const hoje = new Date();
  const dias = [];
  for (let d = new Date(hoje); d.getMonth() === hoje.getMonth(); d.setDate(d.getDate() + 1)) if (d.getDay() >= 2 && d.getDay() <= 5) dias.push(iso(d));
  test.skip(dias.length < 3, 'fim de mês sem três dias úteis pela frente');
  const [b1, b2, parcial] = [dias[0], dias[1], dias[dias.length - 1]];
  const consecutivos = Number(b2.slice(8)) - Number(b1.slice(8)) === 1;
  await mockAdmin(page, {
    tables: {
      schedule_blocks: [
        { id: 'k1', block_date: b1, all_day: true, start_time: null, end_time: null, reason: 'Viagem do Juliano' },
        { id: 'k2', block_date: b2, all_day: true, start_time: null, end_time: null, reason: 'Viagem do Juliano' },
        { id: 'k3', block_date: parcial, all_day: false, start_time: '14:00:00', end_time: '16:00:00', reason: 'Dentista' },
      ],
    },
    rpcs: { get_available_slots_excluding: () => [] },
  });
  await page.goto('/admin-agendamento.html');
  await expect(page.locator('#admin-app')).toBeVisible();
  await expect(page.locator('#booking-date-btn')).not.toHaveText('');

  await page.locator('#booking-date-btn').click();
  const cal = page.locator('#booking-date-cal');
  await expect(cal).toBeVisible();
  await expect(cal.locator(`.calendar-day[data-cal-date="${b1}"]`)).toHaveClass(/is-blocked/);
  await expect(cal.locator(`.calendar-day[data-cal-date="${b1}"]`)).toHaveAttribute('title', /Viagem do Juliano/);
  await expect(cal.locator(`.calendar-day[data-cal-date="${parcial}"]`)).toHaveClass(/is-partial/);
  await expect(cal.locator('.booking-date-blocks')).toContainText('Dentista');
  if (consecutivos) await expect(cal.locator('.booking-date-blocks')).toContainText(`${b1.slice(8)} a ${b2.slice(8)}/${b2.slice(5, 7)}`);
  // um domingo ou segunda do mês aparece como "não atende"
  await expect(cal.locator('.calendar-day.is-closed').first()).toBeVisible();

  // escolher o dia bloqueado grava a data, fecha o calendário e avisa o motivo
  await cal.locator(`.calendar-day[data-cal-date="${b1}"]`).click();
  await expect(cal).toBeHidden();
  expect(await page.locator('#booking-date').inputValue()).toBe(b1);
  await expect(page.locator('#booking-date-btn')).toContainText('bloqueado (Viagem do Juliano)');
  await page.locator('#booking-services .service-card label.service-btn').first().click();
  await expect(page.locator('#booking-slots-hint')).toContainText('bloqueado na agenda (Viagem do Juliano)');
});
