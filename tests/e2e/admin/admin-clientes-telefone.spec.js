// v29.152.0 — caso Helder (08/09/2026). O cadastro do cliente tinha o telefone com 11
// dígitos e os agendamentos feitos pela JuIA gravaram o mesmo número com 13 (55 na frente).
// O painel agrupava pelos dígitos exatos e mostrava DOIS "Helder" na busca do Novo
// agendamento e no CRM. Nas fixtures a Carla reproduz o caso: ficha com 5511955554444 e
// um agendamento com 11955554444.
import { test, expect } from '@playwright/test';
import { mockAdmin } from './_supabase-mock.js';

test('Novo agendamento: mesmo telefone em dois formatos é UM cliente na busca', async ({ page }) => {
  await mockAdmin(page);
  await page.goto('/admin-agendamento.html');
  await expect(page.locator('#booking-name')).toBeVisible();
  await page.locator('#booking-name').fill('Carla');
  const results = page.locator('#booking-customer-results button');
  await expect(results).toHaveCount(1);
  // e o número sai formatado, não cru com o 55 na frente
  await expect(results.first()).toContainText('(11) 95555-4444');
});

test('CRM: mesmo telefone em dois formatos é UMA ficha', async ({ page }) => {
  await mockAdmin(page);
  await page.goto('/admin-clientes.html');
  await expect(page.locator('#crm-list')).toContainText('Carla Exemplo');
  await expect(page.locator('#crm-list article.crm-card').filter({ hasText: 'Carla Exemplo' })).toHaveCount(1);
  // Ana, Bruno, Carla + os dois "Pix" só de agendamento = 5 clientes, sem Carla repetida
  await expect(page.locator('#crm-count')).toHaveText('5');
});
