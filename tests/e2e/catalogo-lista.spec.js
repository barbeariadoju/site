import { test, expect } from '@playwright/test';

// v29.243.0 — A lista de serviços do /agendar/ é uma só (assets/js/catalogo-lista.js) e aparece
// igual na senha digital, no reagendamento e no vale-presente. Nada grava: o reagendar recebe
// um contexto falso interceptado aqui; senha e vale só montam a lista.

const aceitaCookies = (page) => page.addInitScript(() => localStorage.setItem('bdj_cookie_consent_v1', 'accepted'));

test.describe('lista de serviços padrão', () => {
  test('/senha/ monta as seções do /agendar/ e a regra de famílias troca o corte', async ({ page }) => {
    await aceitaCookies(page);
    await page.goto('/senha/');
    const box = page.locator('#senha-servicos');
    await expect(box.locator('.service-section').first()).toBeVisible();
    expect(await box.locator('.service-section').count()).toBeGreaterThanOrEqual(5);
    expect(await box.locator('.service-card').count()).toBeGreaterThanOrEqual(20);
    await expect(page.locator('#senha-enviar')).toBeDisabled();

    await box.locator('.service-btn[data-name="Corte + Lavagem"]').click();
    await expect(box.locator('.service-btn[data-name="Corte + Lavagem"]')).toHaveText('✓ Adicionado');
    await expect(page.locator('#senha-resumo')).toContainText('Corte + Lavagem');
    await expect(page.locator('#senha-enviar')).toBeEnabled();

    // Segundo corte: troca em vez de somar (1 corte por atendimento).
    await box.locator('.service-btn[data-name="Corte de cabelo"]').click();
    await expect(box.locator('.service-btn[data-name="Corte + Lavagem"]')).toHaveText('Adicionar');
    await expect(box.locator('.service-btn[data-name="Corte de cabelo"]')).toHaveText('✓ Adicionado');
    await expect(page.locator('#senha-regra')).toBeVisible();
  });

  test('/vale-presente/ "monte o seu" usa a lista com quantidade', async ({ page }) => {
    await aceitaCookies(page);
    await page.goto('/vale-presente/');
    const box = page.locator('#vp-services');
    await expect(box.locator('.service-card').first()).toBeVisible();
    // Só corte, barba e acabamentos entram como presente.
    await expect(box.locator('.service-btn[data-name="Nevou / Platinado"]')).toHaveCount(0);
    await expect(box.locator('.service-btn[data-name="Corte de cabelo"]')).toHaveCount(1);

    const corte = box.locator('.service-btn[data-name="Corte de cabelo"]');
    await corte.click();
    await corte.click();
    await expect(box.locator('.service-card.is-selected .service-qty b')).toHaveText('2');
    await expect(page.locator('#vp-total')).toHaveText(/80,00/);
    await expect(page.locator('#vp-go-2')).toBeEnabled();

    await box.locator('[data-menos="Corte de cabelo"]').click();
    await expect(box.locator('.service-qty b')).toHaveText('1');
    await expect(page.locator('#vp-total')).toHaveText(/40,00/);
  });

  test('/reagendar.html mostra serviços e produtos na mesma lista, com o serviço anterior marcado', async ({ page }) => {
    await aceitaCookies(page);
    // Contexto falso: nenhuma chamada chega ao Supabase.
    await page.route('**/functions/v1/rebooking-context', (route) => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ ok: true, booking: { service_name: 'Corte de cabelo + Barba Express', booking_date: '2026-09-22', start_time: '10:00', customer_name: 'Teste', customer_phone: '11999999999', notes: '', selected_products: [] } }),
    }));
    // Sem ".html": o `npx serve` local redireciona /reagendar.html para /reagendar e perde a query.
    await page.goto('/reagendar?code=TESTE&token=teste');
    const servicos = page.locator('#rebook-services');
    await expect(servicos.locator('.service-section').first()).toBeVisible();
    await expect(servicos.locator('.service-btn[data-name="Corte de cabelo"]')).toHaveText('✓ Adicionado');
    await expect(servicos.locator('.service-btn[data-name="Barba Express"]')).toHaveText('✓ Adicionado');
    await expect(page.locator('[data-next="2"]')).toBeEnabled();

    // Desmarcar tudo trava a próxima etapa; marcar de novo destrava.
    await servicos.locator('.service-btn[data-name="Corte de cabelo"]').click();
    await servicos.locator('.service-btn[data-name="Barba Express"]').click();
    await expect(page.locator('[data-next="2"]')).toBeDisabled();
    await servicos.locator('.service-btn[data-name="Corte + Lavagem"]').click();
    await expect(page.locator('[data-next="2"]')).toBeEnabled();

    const produtos = page.locator('#rebook-products');
    expect(await produtos.locator('.service-card').count()).toBeGreaterThan(0);
    await expect(produtos.locator('.service-meta span')).toHaveCount(0); // produto não tem duração
  });
});
