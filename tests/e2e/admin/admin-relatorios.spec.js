// Verificação profunda da tela de Relatórios: além de abrir, confere se os NÚMEROS
// calculados batem com os dados fictícios de _fixtures.js.
//
// Contas esperadas (mês atual):
//   concluídos: 3 (Ana 40+0, Bruno 60+25, Ana 40+10)  → faturamento R$ 175,00
//   ticket médio: 175 / 3 = R$ 58,33
//   média por cliente: 175 / 2 = R$ 87,50
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
  await expect(page.locator('#rel-avg-customer')).toHaveText(/R\$\s?87,50/);
  await expect(page.locator('#rel-customers')).toHaveText('2');
  await expect(page.locator('#rel-noshows')).toHaveText('1');
  await expect(page.locator('#rel-satisfaction')).toContainText('50');

  // ranking de serviços: "Corte de cabelo" vendeu 2x, aparece antes de "Corte + Barba"
  await expect(page.locator('#rel-services')).toContainText('Corte de cabelo');
  await expect(page.locator('#rel-services')).toContainText('2×');
  // novos × recorrentes: Ana tem concluído no mês passado → 1 recorrente, 1 novo
  await expect(page.locator('#rel-audience')).toContainText('Novos');

  // conversão da JuIA (v28.63.0): 20 conversaram, 8 agendaram = 40%, e a maior perda
  // ("já tinha escolhido dia e serviço", 5 de 12) aparece no topo da quebra por etapa
  const juia = page.locator('#rel-juia');
  await expect(juia).toContainText('20');
  await expect(juia).toContainText('8');
  await expect(juia).toContainText('40');
  await expect(juia).toContainText('Já tinha escolhido dia e serviço');

  await page.screenshot({ path: 'test-results/admin-screens/admin-relatorios-numeros.png', fullPage: true });
});

// v29.247.0 — Horas trabalhadas cruza a tabela expediente com os concluídos (contas em
// _fixtures.js, bloco `expediente`). Como o resto deste spec, supõe que hoje é dia 8 ou mais.
test('Relatórios mostram horas trabalhadas a partir do expediente', async ({ page }) => {
  await mockAdmin(page);
  await page.goto('/admin-relatorios.html');
  await expect(page.locator('#admin-app')).toBeVisible();

  const horas = page.locator('#rel-horas');
  // 9h00 (dia 3) + 1h30 (dia 5) = 10h30 em 2 dias → média 5h15
  await expect(page.locator('#rel-horas-abertas')).toHaveText('10h30');
  await expect(page.locator('#rel-horas-media')).toHaveText('5h15');
  // em atendimento: 30 + 60 + 30 min de TODOS os concluídos do período (inclui o dia sem registro)
  await expect(page.locator('#rel-horas-atendimento')).toHaveText('2h00');
  // ocupação só dos dias com registro: (30 + 60) / 630 = 14%
  await expect(page.locator('#rel-horas-ocupacao')).toHaveText('14%');
  // R$ 125 (40 + 85) em 10,5 h = R$ 11,90/h; 2 atendimentos em 10,5 h = 0,2/h
  await expect(page.locator('#rel-horas-fat-hora')).toHaveText(/R\$\s?11,90/);
  await expect(page.locator('#rel-horas-at-hora')).toHaveText('0,2');
  // abre em média (09:00 + 14:00) / 2 = 11:30; fecha (18:00 + 15:30) / 2 = 16:45
  await expect(page.locator('#rel-horas-abre-fecha')).toHaveText('11:30 · 16:45');
  await expect(page.locator('#rel-horas-extremos')).toHaveText('1h30 – 9h00');

  // tabela por dia: selo "automático" na abertura do dia 5, motivo do fechamento, e o dia 8
  // com atendimento mas sem linha no expediente aparece como "sem registro" (nunca inventa hora)
  const tabela = horas.locator('table.rel-horas-table');
  await expect(tabela.locator('tbody tr')).toHaveCount(3);
  await expect(tabela).toContainText('automático');
  await expect(tabela).toContainText('Fui embora mais cedo');
  await expect(tabela).toContainText('sem registro');
  await expect(tabela.locator('tfoot')).toContainText('10h30');
  await expect(horas).toContainText('1 dia com atendimento mas sem registro');
});

// Tabela expediente vazia (o registro só existe desde 26/09/2026): a tela avisa em vez de
// mostrar zero como se fosse dado.
test('Relatórios avisam quando não há expediente registrado no período', async ({ page }) => {
  await mockAdmin(page, { tables: { expediente: [] } });
  await page.goto('/admin-relatorios.html');
  await expect(page.locator('#admin-app')).toBeVisible();
  const horas = page.locator('#rel-horas');
  await expect(page.locator('#rel-horas-abertas')).toHaveText('—');
  await expect(horas.locator('table.rel-horas-table tbody tr')).toHaveCount(3);
  await expect(horas).toContainText('3 dias com atendimento mas sem registro');
});
