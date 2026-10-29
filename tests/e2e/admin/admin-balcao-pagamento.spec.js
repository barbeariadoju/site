// v29.219.0 — Balcão com a forma de pagamento em botões e o total no rodapé fixo, igual ao
// "Concluir" da Agenda (pedido do Juliano, 23/09/2026: "ao invés de eu selecionar na lista,
// se fosse igual é na agenda ficaria mais padronizado e mais fácil de enxergar").
// v29.316.0 — categorias em blocos fechados e o pagamento numa janela aberta pelo Concluir
// (pedido do Juliano, 29/10/2026: "clico em concluir, ele já pergunta a forma de pagamento").

import { test, expect } from '@playwright/test';
import { mockAdmin } from './_supabase-mock.js';

const abrirBloco = (page, root, nome) => page.locator(`${root} .lista-bloco[data-bloco="${nome}"] > summary`).click();

test('Balcão: blocos fechados, Concluir abre a janela do pagamento', async ({ page }) => {
  await mockAdmin(page);
  await page.goto('/admin-balcao.html');
  await expect(page.locator('#admin-app')).toBeVisible();

  // Tudo começa fechado: nenhum "Adicionar" à vista, um bloco por categoria.
  await expect(page.locator('#balcao-services .lista-bloco[open]')).toHaveCount(0);
  await expect(page.locator('#balcao-products .lista-bloco[data-bloco="Bebidas frias"]')).toHaveCount(1);
  await expect(page.locator('#balcao-services label.service-btn').first()).toBeHidden();
  await expect(page.locator('#balcao-payment-grid')).toBeHidden();

  const footer = page.locator('.balcao-submit-row');
  await expect(footer.locator('#balcao-payment-label')).toHaveText('nenhum item adicionado');

  await abrirBloco(page, '#balcao-services', 'Cortes e combos');
  await page.locator('#balcao-services label.service-btn', { has: page.locator('input[value="Corte de cabelo"]') }).click();
  await expect(footer.locator('#balcao-total')).toHaveText(/R\$\s?50,00/); // v29.268.0: tabela de 01/10
  await expect(footer.locator('#balcao-payment-label')).toHaveText('1 item');
  await expect(page.locator('.lista-bloco[data-bloco="Cortes e combos"] [data-bloco-resumo]')).toHaveText('✓ Corte de cabelo');

  await page.fill('#balcao-name', 'Cliente Fictício');
  await page.fill('#balcao-phone', '11999990000');
  await page.screenshot({ path: 'test-results/balcao-blocos.png' });
  await page.click('#balcao-save');

  const janela = page.locator('#balcao-pagar');
  await expect(janela).toBeVisible();
  await expect(janela.locator('#balcao-pagar-itens')).toContainText('Corte de cabelo');
  await expect(janela.locator('#balcao-pagar-total')).toHaveText(/R\$\s?50,00/);

  const pix = page.locator('#balcao-payment-grid [data-payment-option="pix"]');
  await pix.click();
  await expect(pix).toHaveClass(/is-selected/);
  await expect(page.locator('#balcao-payment')).toHaveValue('pix');
  const debito = page.locator('#balcao-payment-grid [data-payment-option="debito"]');
  await debito.click();
  await expect(debito).toHaveClass(/is-selected/);
  await expect(pix).not.toHaveClass(/is-selected/);
  await page.screenshot({ path: 'test-results/balcao-pagamento.png' });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/balcao-pagamento-celular.png' });

  await janela.locator('[data-pagar-fechar].btn').click();
  await expect(janela).toBeHidden();
});

test('Balcão: sem forma de pagamento, o aviso aparece dentro da janela', async ({ page }) => {
  await mockAdmin(page);
  await page.goto('/admin-balcao.html');
  await expect(page.locator('#admin-app')).toBeVisible();
  await page.fill('#balcao-name', 'Cliente Fictício');
  await page.fill('#balcao-phone', '11999990000');
  await abrirBloco(page, '#balcao-services', 'Cortes e combos');
  await page.locator('#balcao-services label.service-btn', { has: page.locator('input[value="Corte de cabelo"]') }).click();
  await page.click('#balcao-save');
  await page.click('#balcao-confirm');
  await expect(page.locator('#balcao-payment-wrap #balcao-field-error')).toHaveText('Selecione a forma de pagamento.');
  await page.locator('#balcao-payment-grid [data-payment-option="dinheiro"]').click();
  await expect(page.locator('#balcao-field-error')).toHaveCount(0);
});

test('Balcão: sem item, o Concluir não abre a janela', async ({ page }) => {
  await mockAdmin(page);
  await page.goto('/admin-balcao.html');
  await expect(page.locator('#admin-app')).toBeVisible();
  await page.fill('#balcao-name', 'Cliente Fictício');
  await page.fill('#balcao-phone', '11999990000');
  await page.click('#balcao-save');
  await expect(page.locator('#balcao-pagar')).toBeHidden();
  await expect(page.locator('#balcao-message')).toHaveText('Selecione ao menos um serviço ou produto.');
});
