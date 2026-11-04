// v29.345.0 — no Balcão, o campo Telefone também acha o cliente cadastrado (Juliano, 04/11/2026:
// digitou o número do Lucas no Telefone e nada apareceu, porque só o campo Nome buscava).

import { test, expect } from '@playwright/test';
import { mockAdmin } from './_supabase-mock.js';

test('Balcão: digitar o telefone acha o cliente e preenche o nome', async ({ page }) => {
  await mockAdmin(page);
  await page.goto('/admin-balcao.html');
  await expect(page.locator('#admin-app')).toBeVisible();

  // Formatado com DDD, do jeito que se digita; o cadastro guarda só os dígitos (e às vezes com 55).
  await page.fill('#balcao-phone', '(11) 95555-4444');
  const lista = page.locator('#balcao-customer-results');
  await expect(lista).toBeVisible();
  await lista.locator('[data-pick]', { hasText: 'Carla Exemplo' }).click();

  await expect(page.locator('#balcao-name')).toHaveValue('Carla Exemplo');
  await expect(page.locator('#balcao-customer-tag')).toContainText('Cliente cadastrado: Carla Exemplo');
});
