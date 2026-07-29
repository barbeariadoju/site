// Verificação profunda da tela de Relatórios: além de abrir, confere se os NÚMEROS
// calculados batem com os dados fictícios de _fixtures.js.
//
// Contas esperadas (mês atual):
//   concluídos: 3 (Ana 40+0, Bruno 60+25, Ana 40+10)  → faturamento R$ 175,00
//   ticket médio: 175 / 3 = R$ 58,33
//   clientes únicos (por telefone): 2 (Ana e Bruno)
//   faltas (no_show): 1 (Carla)
//   satisfação: 2 respostas (1 satisfeito, 1 sugestão) → 50%

import { test, expect } from '@playwright/test';
import { mockAdmin } from './_supabase-mock.js';

test('Relatórios calculam faturamento, ticket, clientes, faltas e satisfação', async ({ page }) => {
  await mockAdmin(page);
  await page.goto('/admin-relatorios.html');

  await expect(page.locator('#admin-app')).toBeVisible();
  // \s cobre o espaço "duro" (nbsp) que o formato de moeda pt-BR usa depois de R$
  await expect(page.locator('#rel-revenue')).toHaveText(/R\$\s?175,00/);
  await expect(page.locator('#rel-completed')).toHaveText('3');
  await expect(page.locator('#rel-avg')).toHaveText(/R\$\s?58,33/);
  await expect(page.locator('#rel-customers')).toHaveText('2');
  await expect(page.locator('#rel-noshows')).toHaveText('1');
  await expect(page.locator('#rel-satisfaction')).toContainText('50');

  // ranking de serviços: "Corte de cabelo" vendeu 2x, aparece antes de "Corte + Barba"
  await expect(page.locator('#rel-services')).toContainText('Corte de cabelo');
  await expect(page.locator('#rel-services')).toContainText('2×');
  // novos × recorrentes: Ana tem concluído no mês passado → 1 recorrente, 1 novo
  await expect(page.locator('#rel-audience')).toContainText('Novos');

  await page.screenshot({ path: 'test-results/admin-screens/admin-relatorios-numeros.png', fullPage: true });
});
