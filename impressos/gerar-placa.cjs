// PDF + prévia da placa "na barbearia" (uma página A4 com avaliação, Wi-Fi, Pix, Instagram e catálogo).
const path = require('path');
const site = 'C:/Users/Juliano/Documents/GitHub/site/node_modules/';
let chromium;
try { ({ chromium } = require(site + 'playwright')); } catch { ({ chromium } = require(site + '@playwright/test')); }

const pasta = __dirname;
const html = 'file:///' + path.join(pasta, 'placa-na-barbearia-a4.html').replace(/\\/g, '/');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1.4 });
  await page.goto(html, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: path.join(pasta, 'placa-na-barbearia-a4.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
  await page.locator('#placa').screenshot({ path: path.join(pasta, 'preview-na-barbearia.png') });
  console.log('ok placa-na-barbearia-a4.pdf + preview');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
