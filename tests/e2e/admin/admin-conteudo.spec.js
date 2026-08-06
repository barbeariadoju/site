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

// JuIA Social (v28.50.0): comentários/DMs de FB+IG na mesma tela, aprovação separada.
test('JuIA Social mostra pendente, envia e move pra aba de enviados', async ({ page }) => {
  const { log } = await mockAdmin(page);
  await page.goto('/admin-conteudo.html');
  await expect(page.locator('#admin-app')).toBeVisible();
  const card = page.locator('#social-list .conteudo-card[data-id="mock-si-1"]');
  await expect(card).toBeVisible();
  await expect(card).toContainText('Marina Testando');
  await card.locator('[data-action="social-send"]').click();
  await expect.poll(() => log.filter(l => l.includes('/functions/v1/meta-social-reply')).length).toBeGreaterThan(0);
});

// v28.64.0: responder DM depende de pages_messaging, que o app da Meta não tem — a API
// devolve "(#3) Application does not have the capability". Antes o botão aparecia normal e
// o erro só estourava depois de escrever a resposta.
test('JuIA Social avisa que DM não pode ser respondida e esconde o botão de enviar', async ({ page }) => {
  await mockAdmin(page);
  await page.goto('/admin-conteudo.html');
  await expect(page.locator('#admin-app')).toBeVisible();
  const dm = page.locator('#social-list .conteudo-card[data-id="mock-si-4"]');
  await expect(dm).toBeVisible();
  await expect(dm).toContainText('ainda não está liberado');
  await expect(dm.locator('[data-action="social-send"]')).toHaveCount(0);
  // comentário no mesmo painel continua respondível
  const comentario = page.locator('#social-list .conteudo-card[data-id="mock-si-1"]');
  await expect(comentario.locator('[data-action="social-send"]')).toHaveCount(1);
});

test('JuIA Social rejeitar move o item pra aba de rejeitados/ignorados', async ({ page }) => {
  await mockAdmin(page);
  await page.goto('/admin-conteudo.html');
  await expect(page.locator('#admin-app')).toBeVisible();
  const card = page.locator('#social-list .conteudo-card[data-id="mock-si-1"]');
  await card.locator('[data-action="social-reject"]').click();
  await expect(page.locator('#social-list .conteudo-card[data-id="mock-si-1"]')).toBeHidden();
  await page.click('[data-social-tab="rejeitado"]');
  await expect(page.locator('#social-list .conteudo-card[data-id="mock-si-1"]')).toBeVisible();
});

// v28.57.0 — suporte a vídeo (Reels/Status de vídeo).
test('rascunho de vídeo mostra player e esconde o botão de gerar imagem', async ({ page }) => {
  await mockAdmin(page);
  await page.goto('/admin-conteudo.html');
  const card = page.locator('.conteudo-card[data-id="mock-cp-6"]');
  await expect(card).toBeVisible();
  // prévia em player de vídeo, não <img>
  await expect(card.locator('video')).toHaveAttribute('src', /reel-dia-dos-pais-2026\.mp4$/);
  await expect(card.locator('img')).toHaveCount(0);
  // avisa que vai como Reel
  await expect(card).toContainText('Reel');
  // gerar imagem não faz sentido num post de vídeo
  await expect(card.locator('[data-action="generate-image"]')).toHaveCount(0);
  // e continua publicável
  await expect(card.locator('[data-action="publish"]')).toBeVisible();
});

test('formulário recusa link de vídeo que não é mp4/mov', async ({ page }) => {
  await mockAdmin(page);
  await page.goto('/admin-conteudo.html');
  await page.click('#conteudo-new-btn');
  await page.selectOption('#conteudo-new-platform', 'instagram');
  await page.fill('#conteudo-new-caption', 'teste de vídeo');
  await page.fill('#conteudo-new-video', 'https://www.barbeariadoju.com.br/assets/video.avi');
  await page.click('#conteudo-new-form button[type="submit"]');
  await expect(page.locator('#conteudo-new-error')).toContainText('.mp4');
});
