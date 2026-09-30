// v29.266.0 — Clube do Ju: assinatura com cobrança automática no cartão. O cartão é criptografado no
// navegador pelo SDK oficial do PagBank (servido do próprio site, /assets/js/vendor/) com a chave pública
// que {action:'planos'} devolve; o número do cartão nunca vai em claro para o servidor. Aqui a chave é
// um par RSA gerado no teste, e a function `clube` é interceptada (nada sai para a internet).
import { test, expect } from '@playwright/test';
import { generateKeyPairSync } from 'node:crypto';
import { PLANOS } from './_clube-mock.js';

const { publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const CHAVE = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
const NUMERO = '4111111111111111';

async function preparar(page, respostaAssinar) {
  await page.addInitScript(() => localStorage.setItem('bdj_cookie_consent_v1', 'accepted'));
  const chamadas = [];
  await page.route('**/functions/v1/clube', async (route) => {
    let body = {};
    try { body = JSON.parse(route.request().postData() || '{}'); } catch { /* sem corpo */ }
    chamadas.push({ body, raw: route.request().postData() || '' });
    const resp = body.action === 'planos' ? { ...PLANOS, contrato: { versao: 'v3', sha256: 'teste' }, cartao: { public_key: CHAVE } }
      : body.action === 'assinar' ? respostaAssinar
      : { ok: true };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(resp) });
  });
  await page.goto('/clube/');
  await page.locator('[data-assinar="clube-corte"]').first().click();
  await page.locator('#passo1-continuar').click();
  await page.locator('#f-nome').fill('Cliente Teste');
  await page.locator('#f-telefone').fill('11999998888');
  await page.locator('#f-email').fill('cliente.teste@example.com');
  await page.locator('#btn-codigo').click();
  await page.locator('#f-codigo').fill('123456');
  await page.locator('#passo2-continuar').click();
  await expect(page.locator('[data-passo="3"]')).toBeVisible();
  return chamadas;
}

test('Clube: cartão criptografado no navegador, aceite próprio da recorrência e assinatura ativa na hora', async ({ page }) => {
  const chamadas = await preparar(page, { ok: true, code: 'CJ-TESTE1', ativa: true, gerenciar: 'https://www.barbeariadoju.com.br/clube/minha-assinatura/?c=CJ-TESTE1&t=x' });

  // Cartão é o padrão; o resumo e o botão falam de cobrança automática.
  await expect(page.locator('#campos-cartao')).toBeVisible();
  await expect(page.locator('#resumo-pagamento')).toContainText('cobrança automática');
  await expect(page.locator('#btn-assinar')).toHaveText('Assinar e pagar no cartão');
  await expect(page.locator('#valor-recorrente')).toContainText('85');

  await page.locator('#f-cartao-numero').fill(NUMERO);
  await expect(page.locator('#f-cartao-numero')).toHaveValue('4111 1111 1111 1111');
  await page.locator('#f-cartao-nome').fill('CLIENTE TESTE');
  await page.locator('#f-cartao-validade').fill('1230');
  await expect(page.locator('#f-cartao-validade')).toHaveValue('12/30');
  await page.locator('#f-cartao-cvv').fill('123');
  await page.locator('#f-cartao-cpf').fill('52998224725');
  for (const id of ['#aceite-contrato', '#aceite-regras', '#aceite-privacidade']) await page.locator(id).check();

  // Sem a autorização da cobrança mensal, não envia.
  await page.locator('#btn-assinar').click();
  await expect(page.locator('#passo3-erro')).toContainText('autorização da cobrança mensal');
  expect(chamadas.filter((c) => c.body.action === 'assinar')).toHaveLength(0);

  await page.locator('#aceite-recorrente').check();
  await page.locator('#btn-assinar').click();
  await expect(page.locator('#assinar-fim')).toContainText('Assinatura ativa');

  const envio = chamadas.find((c) => c.body.action === 'assinar');
  expect(envio.body.pagamento).toBe('cartao');
  expect(envio.body.aceite).toMatchObject({ contrato: true, regras: true, privacidade: true, recorrente: true });
  expect(envio.body.cartao.encrypted.length).toBeGreaterThan(100);
  expect(envio.body.cartao.cpf).toBe('52998224725');
  expect(Object.keys(envio.body.cartao).sort()).toEqual(['cpf', 'cvv', 'encrypted']);
  expect(envio.raw).not.toContain(NUMERO); // o número do cartão nunca sai em claro
  await expect(page.locator('#f-cartao-numero')).toHaveValue('');
});

test('Clube: quem escolhe o link não vê o cartão e segue para o PagBank', async ({ page }) => {
  const chamadas = await preparar(page, { ok: true, code: 'CJ-TESTE2', pay_url: 'https://pagamento.pagbank.com.br/teste' });
  await page.route('https://pagamento.pagbank.com.br/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<p>PagBank</p>' }));
  await page.locator('input[name="forma-pag"][value="link"]').check();
  await expect(page.locator('#campos-cartao')).toBeHidden();
  await expect(page.locator('#btn-assinar')).toHaveText('Assinar e ir para o pagamento');
  await expect(page.locator('#resumo-pagamento')).toContainText('link de pagamento');
  for (const id of ['#aceite-contrato', '#aceite-regras', '#aceite-privacidade']) await page.locator(id).check();
  await page.locator('#btn-assinar').click();
  await expect(page.locator('#assinar-fim')).toContainText('Quase lá');
  const envio = chamadas.find((c) => c.body.action === 'assinar');
  expect(envio.body.pagamento).toBe('link');
  expect(envio.body.cartao).toBeUndefined();
});
