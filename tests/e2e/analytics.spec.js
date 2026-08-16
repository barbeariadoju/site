import { test, expect } from '@playwright/test';

// Cobre a instrumentação do funil no dataLayer. Existe por causa de um achado
// real: `clique_agendamento` estava declarado como evento principal no GA4,
// mas nenhuma linha do site disparava — tínhamos o fim do funil
// (booking_confirmed) sem o começo, e ninguém percebeu porque nada testava.
// Estes testes olham só o dataLayer; se o evento chega ou não no GA4 depende
// da tag no GTM, que não dá pra cobrir daqui.

const nomesNoDataLayer = page =>
  page.evaluate(() => (window.dataLayer || []).map(e => e && e.event).filter(Boolean));

test.describe('eventos de funil no dataLayer', () => {
  test('clicar num CTA de agendar na home dispara clique_agendamento', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Somente essenciais' }).click().catch(() => {});

    // O popup de boas-vindas aparece 1,2s depois do load e cobre o hero — ele
    // intercepta o clique no CTA principal de quem chega pela primeira vez.
    await page.locator('.welcome-close').click({ timeout: 5000 }).catch(() => {});

    // O clique navega e destrói o contexto da página, então o push precisa ser
    // capturado do lado do Node no momento em que acontece.
    const eventos = [];
    await page.exposeFunction('__registra', e => eventos.push(e));
    await page.evaluate(() => {
      const dl = window.dataLayer || (window.dataLayer = []);
      const push = dl.push.bind(dl);
      dl.push = (...args) => { args.forEach(a => a && a.event && window.__registra(a)); return push(...args); };
    });

    await page.locator('a[href*="/agendar/"]').first().click({ noWaitAfter: true });
    await expect.poll(() => eventos.map(e => e.event)).toContain('clique_agendamento');

    const evento = eventos.find(e => e.event === 'clique_agendamento');
    expect(evento.origem_pagina).toBeTruthy();
  });

  // Regressão: o listener morava no script.js, que só é carregado em 3 páginas.
  // As 34 páginas de serviço e blog — justamente o tráfego de SEO — ficavam sem
  // medição nenhuma. Agora vive em funnel-events-v29.js, incluído em todas.
  for (const pagina of ['/servico-corte-masculino.html', '/servicos.html', '/blog-barboterapia.html']) {
    test(`CTA em ${pagina} dispara clique_agendamento`, async ({ page }) => {
      await page.goto(pagina);
      await page.getByRole('button', { name: 'Somente essenciais' }).click().catch(() => {});

      const eventos = [];
      await page.exposeFunction('__registra', e => eventos.push(e));
      await page.evaluate(() => {
        const dl = window.dataLayer || (window.dataLayer = []);
        const push = dl.push.bind(dl);
        dl.push = (...args) => { args.forEach(a => a && a.event && window.__registra(a)); return push(...args); };
      });

      await page.locator('a[href*="/agendar/"]').first().click({ noWaitAfter: true });
      await expect.poll(() => eventos.map(e => e.event)).toContain('clique_agendamento');
      // o servidor local (`npx serve`, cleanUrls) serve /servicos em vez de
      // /servicos.html; em produção a extensão aparece. Compara sem ela.
      const slug = pagina.replace('/', '').replace('.html', '');
      expect(eventos.find(e => e.event === 'clique_agendamento').origem_pagina).toContain(slug);
    });
  }

  test('de dentro de /agendar/ o clique NAO conta como entrada no funil', async ({ page }) => {
    await page.goto('/agendar/');
    await page.getByRole('button', { name: 'Somente essenciais' }).click().catch(() => {});

    await page.route('**/agendar/horario/**', route => route.abort());
    await page.getByRole('link', { name: 'Ir direto à agenda' }).click({ noWaitAfter: true });

    // dá tempo de um push errado acontecer antes de afirmar que não aconteceu
    await page.waitForTimeout(500);
    expect(await nomesNoDataLayer(page)).not.toContain('clique_agendamento');
  });

  test('adicionar serviço dispara service_selected com nome e valor', async ({ page }) => {
    await page.goto('/agendar/');
    await page.getByRole('button', { name: 'Somente essenciais' }).click().catch(() => {});

    // captura do lado do Node: o service worker pode recarregar a página no
    // 'controllerchange' e destruir o contexto no meio da leitura do dataLayer.
    const eventos = [];
    await page.exposeFunction('__registra', e => eventos.push(e));
    await page.evaluate(() => {
      const dl = window.dataLayer || (window.dataLayer = []);
      const push = dl.push.bind(dl);
      dl.push = (...args) => { args.forEach(a => a && a.event && window.__registra(a)); return push(...args); };
    });

    const card = page.locator('.service-card', { hasText: 'Corte de cabelo' }).first();
    await card.getByRole('button', { name: 'Adicionar' }).click();

    await expect.poll(() => eventos.map(e => e.event)).toContain('service_selected');
    const evento = eventos.find(e => e.event === 'service_selected');
    expect(evento.item_name).toContain('Corte de cabelo');
    expect(evento.value).toBeGreaterThan(0);
  });

  test('seguir pra agenda dispara checkout_step_horario com o total', async ({ page }) => {
    await page.goto('/agendar/');
    await page.getByRole('button', { name: 'Somente essenciais' }).click().catch(() => {});

    const card = page.locator('.service-card', { hasText: 'Corte de cabelo' }).first();
    await card.getByRole('button', { name: 'Adicionar' }).click();
    await page.locator('#open-service-cart').click();

    const eventos = [];
    await page.exposeFunction('__registra', e => eventos.push(e)).catch(() => {});
    await page.evaluate(() => {
      const dl = window.dataLayer || (window.dataLayer = []);
      const push = dl.push.bind(dl);
      dl.push = (...args) => { args.forEach(a => a && a.event && window.__registra(a)); return push(...args); };
    });

    await page.locator('#send-services').click();
    await page.waitForURL(/\/agendar\/horario\/?$/);

    const checkout = eventos.find(e => e.event === 'checkout_step_horario');
    expect(checkout, 'checkout_step_horario deveria ser disparado antes do redirect').toBeTruthy();
    expect(checkout.value).toBeGreaterThan(0);
    expect(checkout.items_count).toBeGreaterThan(0);
  });
});

// Regressão do popup de boas-vindas: ele era um modal com fundo escuro aberto
// 1,2s depois do load e interceptava o clique no CTA do hero. Agora é um card
// ancorado embaixo, que só aparece depois que a pessoa rola além do hero.
test.describe('popup de boas-vindas', () => {
  test('não bloqueia o CTA do hero de quem acabou de chegar', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Somente essenciais' }).click().catch(() => {});
    await page.waitForTimeout(2500); // bem depois do 1,2s do comportamento antigo

    const cta = page.locator('#topo a[href*="/agendar"]').first();
    await expect(cta).toBeVisible();
    // clique real, sem force: falha se qualquer camada estiver por cima
    await cta.click({ trial: true });
  });

  test('aparece depois de rolar além do hero', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Somente essenciais' }).click().catch(() => {});
    await expect(page.locator('#welcome-pop')).not.toHaveClass(/open/);

    await page.locator('#duvidas-frequentes').scrollIntoViewIfNeeded();
    await expect(page.locator('#welcome-pop')).toHaveClass(/open/);
  });
});
