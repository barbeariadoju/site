import { test, expect } from '@playwright/test';

// Cobre a unificação de rota feita em 2026-07-28:
// /agendar/ (catálogo) -> /agendar/horario/ (data e horário), com
// /agendar.html mantido como redirect pra não quebrar links já compartilhados.

test.describe('rotas de agendamento', () => {
  test('/agendar/ carrega o catálogo sem erro de console', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto('/agendar/');
    await expect(page).toHaveTitle(/Serviços e Agendamento/);
    await expect(page.locator('.service-card').first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('/agendar/horario/ carrega direto, sem serviço selecionado', async ({ page }) => {
    await page.goto('/agendar/horario/');
    await expect(page).toHaveTitle(/Agendamento Online/);
    await expect(page.getByText('Nenhum serviço selecionado.')).toBeVisible();
  });

  test('/agendar.html (URL antiga) redireciona para /agendar/horario/', async ({ page }) => {
    // O servidor local de dev (`npx serve`) faz seu próprio redirect de
    // "/agendar.html" -> "/agendar" antes de a página carregar (cleanUrls),
    // um comportamento que o GitHub Pages real não tem. Testamos essa rota
    // direto no site publicado pra valer o comportamento real - é só
    // navegação/leitura, não grava nada.
    await page.goto('https://www.barbeariadoju.com.br/agendar.html');
    await page.waitForURL(/\/agendar\/horario\/?$/);
    await expect(page).toHaveTitle(/Agendamento Online/);
  });

  test('link "Ir direto à agenda" no catálogo aponta pra rota nova', async ({ page }) => {
    await page.goto('/agendar/');
    const link = page.getByRole('link', { name: 'Ir direto à agenda' });
    await expect(link).toHaveAttribute('href', '/agendar/horario/');
  });
});
