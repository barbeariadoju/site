// Gera os PDFs A4 das placas a partir do artes-a4.html (Chromium do Playwright do repo site).
const path = require('path');
// O Playwright vive no node_modules do repo site; este script mora no scratchpad.
const site = 'C:/Users/Juliano/Documents/GitHub/site/node_modules/';
let chromium;
try { ({ chromium } = require(site + 'playwright')); } catch { ({ chromium } = require(site + '@playwright/test')); }

const pasta = __dirname;
const html = 'file:///' + path.join(pasta, 'artes-a4.html').replace(/\\/g, '/');
const placas = ['senha', 'avaliar', 'wifi', 'pix', 'agendar'];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  async function pdf(url, arquivo) {
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.pdf({ path: path.join(pasta, arquivo), format: 'A4', printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
    console.log('ok', arquivo);
  }
  await pdf(html, 'barbearia-do-ju-placas-a4.pdf');
  for (const p of placas) await pdf(`${html}?only=${p}`, `placa-${p}-a4.pdf`);
  // Prévia em PNG de cada placa (pra conferir a arte sem abrir o PDF).
  const preview = await browser.newPage({ deviceScaleFactor: 1.4 });
  await preview.goto(html, { waitUntil: 'networkidle' });
  await preview.evaluate(() => document.fonts.ready);
  for (const p of placas) {
    await preview.locator('#' + p).screenshot({ path: path.join(pasta, `preview-${p}.png`) });
    console.log('ok', `preview-${p}.png`);
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
