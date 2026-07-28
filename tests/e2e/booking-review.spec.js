import { test, expect } from '@playwright/test';

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

  await page.locator('[data-next-step="2"]').click();

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
  await expect(page.locator('#review-summary')).toContainText('R$ 40,00');
  await expect(page.locator('#review-client-note')).toContainText('TESTE Playwright (ignorar)');
  await expect(page.locator('#review-client-note')).toContainText('5599900011234');
  await expect(page.locator('#agenda-submit')).toBeEnabled();
  // Fim do teste aqui de propósito — não confirmamos o agendamento.
});
