import { test, expect } from '@playwright/test';

test.describe('carrinho de serviços', () => {
  test('adicionar serviço atualiza total e leva pra /agendar/horario/ com o serviço certo', async ({ page }) => {
    await page.goto('/agendar/');
    await page.getByRole('button', { name: 'Somente essenciais' }).click().catch(() => {});

    const card = page.locator('.service-card', { hasText: 'Corte de cabelo' }).first();
    await card.getByRole('button', { name: 'Adicionar' }).click();

    // o painel do carrinho começa fechado (aria-hidden) - o botão flutuante
    // "Ver meu carrinho" precisa ser clicado antes de qualquer botão de dentro dele.
    await page.locator('#open-service-cart').click();

    await expect(page.locator('#service-total')).toHaveText('R$ 40,00');
    await expect(page.locator('#service-items')).toContainText('Corte de cabelo');

    await page.locator('#send-services').click();
    await page.waitForURL(/\/agendar\/horario\/?$/);

    await expect(page.getByText('Corte de cabelo').first()).toBeVisible();
    await expect(page.getByText('R$ 40,00').first()).toBeVisible();
  });

  test('remover serviço zera o carrinho', async ({ page }) => {
    await page.goto('/agendar/');
    await page.getByRole('button', { name: 'Somente essenciais' }).click().catch(() => {});

    const card = page.locator('.service-card', { hasText: 'Corte de cabelo' }).first();
    await card.getByRole('button', { name: 'Adicionar' }).click();
    await page.locator('#open-service-cart').click();
    await expect(page.locator('#service-total')).toHaveText('R$ 40,00');

    await page.getByRole('button', { name: 'Limpar todos os serviços' }).click();
    await expect(page.locator('#service-total')).toHaveText('R$ 0,00');
  });
});
