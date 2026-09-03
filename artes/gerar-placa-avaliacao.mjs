// Gera a plaquinha de avaliação no Google em A5 300 dpi, pronta pra gráfica.
// Rode da RAIZ do repo: node artes/gerar-placa-avaliacao.mjs
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

const b64 = (f) => `data:image/png;base64,${readFileSync(`artes/${f}`).toString('base64')}`;

const html = readFileSync('artes/placa-avaliacao-google.html', 'utf8')
  .replace('QR_GOOGLE', b64('qr-google.png'))
  .replace('QR_WIFI', b64('qr-wifi.png'))
  .replace('QR_PIX', b64('qr-pix.png'))
  .replace('QR_INSTAGRAM', b64('qr-instagram.png'))
  .replace('QR_SERVICOS', b64('qr-servicos.png'));

writeFileSync('artes/.render-avaliacao.html', html);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1748, height: 2480 }, deviceScaleFactor: 1 });
await page.goto('file://' + process.cwd().replace(/\\/g, '/') + '/artes/.render-avaliacao.html');
await page.waitForTimeout(600);

// Mede transbordo por JS. O --window-size do chrome headless não respeita a largura:
// renderiza maior e recorta, fazendo a peça PARECER quebrada (gotcha de 30/08).
const m = await page.evaluate(() => ({
  larguraDoc: document.documentElement.scrollWidth, alturaDoc: document.documentElement.scrollHeight,
  larguraJanela: window.innerWidth, alturaJanela: window.innerHeight,
}));
console.log('medida:', JSON.stringify(m));
if (m.larguraDoc > m.larguraJanela) console.log(`*** TRANSBORDOU NA LARGURA (${m.larguraDoc - m.larguraJanela}px) ***`);
if (m.alturaDoc > m.alturaJanela) console.log(`*** TRANSBORDOU NA ALTURA (${m.alturaDoc - m.alturaJanela}px) ***`);

await page.screenshot({ path: 'PLAQUINHA-avaliacao-google-A5-v2.png' });
await browser.close();
console.log('gerado: PLAQUINHA-avaliacao-google-A5-v2.png (1748x2480 = A5 em 300dpi)');
