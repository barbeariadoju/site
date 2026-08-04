// Testes de interação da Central de Conteúdo (além do smoke test):
// - o botão de publicar chama a EDGE FUNCTION CERTA pra cada plataforma (um erro de
//   roteamento aqui publicaria no lugar errado — bug silencioso e grave);
// - rejeitar move o card pra aba Rejeitados;
// - o formulário de novo rascunho valida imagem obrigatória e link relativo.
import { test, expect } from '@playwright/test';
import { mockAdmin } from './_supabase-mock.js';

test('publicar roteia pra content-publish-meta quando a plataforma é Facebook', async ({ page }) => {
  const { log } = await mockAdmin(page);
  await page.goto('/admin-conteudo.html');
  await expect(page.locator('#admin-app')).toBeVisible();
  const card = page.locator('.conteudo-card[data-id="mock-cp-4"]');
  await expect(card).toBeVisible();
  await card.locator('[data-action="publish"]').click();
  await expect.poll(() => log.filter(l => l.includes('/functions/v1/content-publish-meta')).length).toBeGreaterThan(0);
  expect(log.some(l => l.includes('/functions/v1/content-publish-whatsapp'))).toBe(false);
});

test('publicar roteia pra content-publish-whatsapp quando a plataforma é Status', async ({ page }) => {
  const { log } = await mockAdmin(page);
  await page.goto('/admin-conteudo.html');
  await expect(page.locator('#admin-app')).toBeVisible();
  const card = page.locator('.conteudo-card[data-id="mock-cp-1"]');
  await expect(card).toBeVisible();
  await card.locator('[data-action="publish"]').click();
  await expect.poll(() => log.filter(l => l.includes('/functions/v1/content-publish-whatsapp')).length).toBeGreaterThan(0);
  expect(log.some(l => l.includes('/functions/v1/content-publish-meta'))).toBe(false);
});

test('rejeitar move o rascunho pra aba Rejeitados', async ({ page }) => {
  await mockAdmin(page);
  await page.goto('/admin-conteudo.html');
  await expect(page.locator('#admin-app')).toBeVisible();
  const card = page.locator('.conteudo-card[data-id="mock-cp-1"]');
  await card.locator('[data-action="reject"]').click();
  await expect(page.locator('.conteudo-card[data-id="mock-cp-1"]')).toBeHidden();
  await page.click('[data-conteudo-tab="rejeitado"]');
  await expect(page.locator('.conteudo-card[data-id="mock-cp-1"]')).toBeVisible();
});

test('formulário de novo rascunho valida imagem obrigatória e link relativo', async ({ page }) => {
  await mockAdmin(page);
  await page.goto('/admin-conteudo.html');
  await expect(page.locator('#admin-app')).toBeVisible();
  await page.click('#conteudo-new-btn');
  await page.selectOption('#conteudo-new-platform', 'instagram_story');
  await page.fill('#conteudo-new-caption', 'Teste de validação');
  await page.click('#conteudo-new-form button[type="submit"]');
  await expect(page.locator('#conteudo-new-error')).toContainText('imagem');

  await page.fill('#conteudo-new-image', '/assets/relativo.jpg');
  await page.click('#conteudo-new-form button[type="submit"]');
  await expect(page.locator('#conteudo-new-error')).toContainText('https://');

  await page.fill('#conteudo-new-image', 'https://www.barbeariadoju.com.br/assets/ok.jpg');
  await page.click('#conteudo-new-form button[type="submit"]');
  await expect(page.locator('#conteudo-new-form')).toBeHidden();
  await expect(page.locator('.conteudo-card', { hasText: 'Teste de validação' })).toBeVisible();
});
