import { test, expect } from '@playwright/test';
import { valor } from './_precos.js';

// Percorre o fluxo completo de agendamento até a tela de revisão (Etapa 4),
// mas NUNCA clica em "Confirmar agendamento" — não grava nada no Supabase.
// Para o teste que grava de verdade (e depois apaga), ver booking-live.spec.js
// (roda só com `npm run test:e2e:live`, fora do padrão).

test('preenche o fluxo até a revisão sem confirmar', async ({ page }) => {
  await page.goto('/agendar/');
  await page.getByRole('button', { name: 'Somente essenciais' }).click().catch(() => {});

  await page.locator('.service-card', { hasText: 'Corte de cabelo' }).first()
    .getByRole('button', { name: 'Adicionar' }).click();
  await page.locator('#open-service-cart').click();
  await page.locator('#send-services').click();
  await page.waitForURL(/\/agendar\/horario\/?$/);

  // v29.252.0: com pedido montado, o fluxo já abre na etapa de horário (a antiga Etapa 1 saiu)

  await expect(page.locator('[data-step=\"2\"]')).toBeVisible();

  // escolhe uma data alguns dias à frente; o site pula sozinho pro próximo
  // dia com vaga se essa não tiver horário (ver agenda-v15.js loadSlots()).
  const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await page.locator('#agenda-date').fill(future);
  const firstSlot = page.locator('#agenda-slots .agenda-slot').first();
  await expect(firstSlot).toBeVisible({ timeout: 15000 });
  await firstSlot.click();

  await page.locator('[data-next-step="3"]').click();
  await page.locator('#agenda-name').fill('TESTE Playwright (ignorar)');
  await page.locator('#agenda-phone').fill('5599900011234');
  await page.locator('#agenda-email').fill('teste-e2e@example.com');

  await page.locator('[data-next-step="4"]').click();

  await expect(page.locator('#review-summary')).toContainText('Corte de cabelo');
  // v29.211.0: o resumo mostra o preço da DATA escolhida (reajuste de 01/10/2026)
  const dia = await page.locator('#agenda-date').inputValue();
  await expect(page.locator('#review-summary')).toContainText(valor('Corte de cabelo', dia));
  await expect(page.locator('#review-client-note')).toContainText('TESTE Playwright (ignorar)');
  await expect(page.locator('#review-client-note')).toContainText('5599900011234');
  await expect(page.locator('#agenda-submit')).toBeEnabled();
  // Fim do teste aqui de propósito — não confirmamos o agendamento.
});

// v29.301.0 — caso Douglas (21/10/2026): (11) 9581-1438, celular sem um dígito, passou e virou cadastro
// duplicado. Dez dígitos com 6-9 depois do DDD não avança para a revisão e explica o motivo.
test('celular sem um dígito não avança e explica', async ({ page }) => {
  await page.goto('/agendar/');
  await page.getByRole('button', { name: 'Somente essenciais' }).click().catch(() => {});
  await page.locator('.service-card', { hasText: 'Corte de cabelo' }).first()
    .getByRole('button', { name: 'Adicionar' }).click();
  await page.locator('#open-service-cart').click();
  await page.locator('#send-services').click();
  await page.waitForURL(/\/agendar\/horario\/?$/);
  const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await page.locator('#agenda-date').fill(future);
  const firstSlot = page.locator('#agenda-slots .agenda-slot').first();
  await expect(firstSlot).toBeVisible({ timeout: 15000 });
  await firstSlot.click();
  await page.locator('[data-next-step="3"]').click();
  await page.locator('#agenda-name').fill('TESTE Playwright (ignorar)');
  await page.locator('#agenda-phone').fill('(11) 9581-1438');
  await page.locator('[data-next-step="4"]').click();
  await expect(page.locator('#erro-agenda-phone')).toContainText('Faltou um dígito');
  await expect(page.locator('#review-summary')).not.toBeVisible();
  // fixo de verdade (2-5 depois do DDD) continua passando
  await page.locator('#agenda-phone').fill('(11) 4033-1234');
  await page.locator('[data-next-step="4"]').click();
  await expect(page.locator('#review-summary')).toContainText('Corte de cabelo');
});

// v29.302.0 — caso Marcio (convite de 22/10 saiu "Oi, Marciopaulavicius@hotmail."): e-mail no
// campo do nome não avança.
test('e-mail no campo do nome não avança e explica', async ({ page }) => {
  await page.goto('/agendar/');
  await page.getByRole('button', { name: 'Somente essenciais' }).click().catch(() => {});
  await page.locator('.service-card', { hasText: 'Corte de cabelo' }).first()
    .getByRole('button', { name: 'Adicionar' }).click();
  await page.locator('#open-service-cart').click();
  await page.locator('#send-services').click();
  await page.waitForURL(/\/agendar\/horario\/?$/);
  const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await page.locator('#agenda-date').fill(future);
  const firstSlot = page.locator('#agenda-slots .agenda-slot').first();
  await expect(firstSlot).toBeVisible({ timeout: 15000 });
  await firstSlot.click();
  await page.locator('[data-next-step="3"]').click();
  await page.locator('#agenda-name').fill('teste.playwright@hotmail');
  await page.locator('#agenda-phone').fill('(11) 4033-1234');
  await page.locator('[data-next-step="4"]').click();
  await expect(page.locator('#erro-agenda-name')).toContainText('O e-mail tem campo próprio');
  await expect(page.locator('#review-summary')).not.toBeVisible();
});
