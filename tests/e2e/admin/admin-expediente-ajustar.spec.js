// v29.265.0 — Ajustar horário do expediente (pedido do Juliano, 30/09/2026: abriu no painel às
// 10h13 mas estava na barbearia desde 8h50). A tela Hoje mostra "Ajustar horário" quando o dia já
// tem abertura; o modal chama expediente_ajustar com o dia, a abertura e o fechamento (em branco =
// mantém o dia aberto). Nada sai para a internet (ver _supabase-mock.js).

import { test, expect } from '@playwright/test';
import { mockAdmin } from './_supabase-mock.js';

const pad = (n) => String(n).padStart(2, '0');
const hoje = new Date();
const diaHoje = `${hoje.getFullYear()}-${pad(hoje.getMonth() + 1)}-${pad(hoje.getDate())}`;
const tsHoje = (h, m) => new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), h, m).toISOString();

test('Ajustar horário: corrige a abertura de hoje sem fechar o dia', async ({ page }) => {
  const chamadas = [];
  const aberto = { dia: diaHoje, aberto_em: tsHoje(0, 13), aberto_por: 'painel', fechado_em: null, fechado_por: null, motivo: null, observacao: null, bloqueio_id: null };
  await mockAdmin(page, {
    tables: { expediente: [aberto] },
    rpcs: { expediente_ajustar: (body) => { chamadas.push(body); return { ...aberto, aberto_em: tsHoje(0, 5), aberto_por: 'ajuste' }; } },
  });
  await page.goto('/admin.html');
  await expect(page.locator('#admin-app')).toBeVisible();

  const box = page.locator('#today-expediente');
  await expect(box).toContainText('Aberta desde');
  await box.locator('[data-expediente-ajustar]').click();

  const modal = page.locator('#expediente-ajustar-modal');
  await expect(modal.locator('#expediente-ajuste-aberto')).toHaveValue('00:13');
  await expect(modal.locator('#expediente-ajuste-fechado')).toHaveValue('');
  await modal.locator('#expediente-ajuste-aberto').fill('00:05');
  await modal.locator('[data-ajuste-salvar]').click();

  await expect.poll(() => chamadas.length).toBe(1);
  expect(chamadas[0]).toEqual({ p_dia: diaHoje, p_aberto: '00:05', p_fechado: null });
  await expect(modal).toHaveCount(0);
});

test('Ajustar horário: fechamento antes da abertura é barrado na tela', async ({ page }) => {
  const chamadas = [];
  const aberto = { dia: diaHoje, aberto_em: tsHoje(0, 13), aberto_por: 'painel', fechado_em: null, fechado_por: null, motivo: null, observacao: null, bloqueio_id: null };
  await mockAdmin(page, { tables: { expediente: [aberto] }, rpcs: { expediente_ajustar: (body) => { chamadas.push(body); return aberto; } } });
  await page.goto('/admin.html');
  await page.locator('#today-expediente [data-expediente-ajustar]').click();
  const modal = page.locator('#expediente-ajustar-modal');
  await modal.locator('#expediente-ajuste-fechado').fill('00:10');
  page.once('dialog', (d) => d.accept());
  await modal.locator('[data-ajuste-salvar]').click();
  await page.waitForTimeout(300);
  expect(chamadas.length).toBe(0);
});
