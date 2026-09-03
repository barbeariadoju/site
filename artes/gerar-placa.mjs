// Gera a plaquinha do reajuste em A5 300 dpi, pronta pra gráfica.
// Mesmo método da plaquinha de 30/08: HTML + screenshot do Playwright, porque dá controle
// tipográfico exato e sai em pixel cheio, sem reamostragem.
//
// O QR é reaproveitado da arte da designer (já conferido: aponta pra /precos/, com barra).
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

const qrBase64 = readFileSync('arte-placa-1.png').toString('base64');
const html = readFileSync('placa.html', 'utf8').replace('QR_AQUI', `data:image/png;base64,${qrBase64}`);
writeFileSync('placa-render.html', html);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1748, height: 2480 }, deviceScaleFactor: 1 });
await page.goto('file://' + process.cwd().replace(/\\/g, '/') + '/placa-render.html');
await page.waitForTimeout(600);

// Confere que nada transbordou — o gotcha registrado em 30/08 é justamente medir de verdade,
// em vez de confiar no olho ou no --window-size do chrome headless.
const medida = await page.evaluate(() => ({
  larguraDoc: document.documentElement.scrollWidth,
  alturaDoc: document.documentElement.scrollHeight,
  larguraJanela: window.innerWidth,
  alturaJanela: window.innerHeight,
}));
console.log('medida:', JSON.stringify(medida));
if (medida.larguraDoc > medida.larguraJanela) console.log('*** TRANSBORDOU NA LARGURA ***');
if (medida.alturaDoc > medida.alturaJanela) console.log(`*** TRANSBORDOU NA ALTURA (${medida.alturaDoc - medida.alturaJanela}px) ***`);

await page.screenshot({ path: 'PLAQUINHA-reajuste-outubro-A5-v2.png' });
await browser.close();
console.log('gerado: PLAQUINHA-reajuste-outubro-A5-v2.png (1748x2480 = A5 em 300dpi)');
