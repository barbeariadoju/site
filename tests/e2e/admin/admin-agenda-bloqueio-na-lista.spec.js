// v29.225.0 — bloqueio de horário na lista do dia da Agenda, na ordem dos horários (pedido do Juliano,
// 23/09/2026: "meu bloqueio aparecer na agenda na sequência dos horários").

import { test, expect } from '@playwright/test';
import { mockAdmin } from './_supabase-mock.js';

const hoje = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

test('Agenda: bloqueio parcial aparece entre os agendamentos, na ordem do horário', async ({ page }) => {
  await mockAdmin(page, {
    tables: { schedule_blocks: [{ id: 'mock-blk-hoje', block_date: hoje(), all_day: false, start_time: '17:15:00', end_time: '17:30:00', reason: 'reunião fictícia', created_at: new Date().toISOString() }] },
  });
  await page.goto('/admin-agenda.html');
  await expect(page.locator('#admin-app')).toBeVisible();
  const lista = page.locator('#agenda-day-list');
  const bloqueio = lista.locator('.agenda-block-inline');
  await expect(bloqueio).toHaveCount(1);
  await expect(bloqueio).toContainText('17:15–17:30');
  await expect(bloqueio).toContainText('reunião fictícia');
  // "Pix Declarado" é 17:00 e "Pix Confirmado" é 17:30 (fixtures): o bloqueio fica entre os dois.
  const textos = await lista.locator(':scope > *').allTextContents();
  const iDecl = textos.findIndex((t) => t.includes('Pix Declarado'));
  const iBloq = textos.findIndex((t) => t.includes('reunião fictícia'));
  const iConf = textos.findIndex((t) => t.includes('Pix Confirmado'));
  expect(iDecl).toBeGreaterThanOrEqual(0);
  expect(iDecl).toBeLessThan(iBloq);
  expect(iBloq).toBeLessThan(iConf);
  await bloqueio.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/admin-screens/agenda-bloqueio-na-lista.png' });
});
