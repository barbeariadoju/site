// Snapshot do estilo calculado — prova de que uma reorganização de CSS não mudou nada.
// NÃO roda no `npm test`. Uso (v29.250.0):
//
//   ROTULO=antes  npx playwright test -c playwright.estilo.config.js
//   ...mexe no CSS...
//   ROTULO=depois npx playwright test -c playwright.estilo.config.js
//   node tests/estilo/comparar.mjs antes depois
//
// Captura, elemento por elemento (e ::before/::after), as propriedades AUTORAIS (cor, fonte,
// borda, espaçamento interno, display, fundo, sombra…) de todas as páginas públicas e de todas
// as telas do painel já logadas (mock do Supabase dos testes do admin: nada vai ao banco),
// em 1280 e 390 px. Largura, altura e margem automática ficam de fora: dependem de layout e
// da hora em que a fonte carregou, e variavam entre rodadas (lição da 29.179.0).
import { test } from '@playwright/test';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { mockAdmin } from '../e2e/admin/_supabase-mock.js';

const ROTULO = process.env.ROTULO || 'snapshot';
const DIR = `.estilo/${ROTULO}`;
mkdirSync(DIR, { recursive: true });

const publicas = [
  ...readdirSync('.').filter((f) => f.endsWith('.html') && !f.startsWith('admin') && !['agendar.html', 'experiencia.html', 'offline.html'].includes(f)),
  'agendar/index.html', 'agendar/horario/index.html', 'precos/index.html', 'clube/index.html',
  'senha/index.html', 'vale-presente/index.html',
];
const painel = readdirSync('.').filter((f) => f.startsWith('admin') && f.endsWith('.html') && f !== 'admin-atendimento.html');

const PROPS = [
  'display', 'position', 'visibility', 'opacity', 'z-index', 'float', 'overflow-x', 'overflow-y',
  'color', 'background-color', 'background-image', 'box-shadow', 'text-shadow', 'filter', 'backdrop-filter',
  'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing', 'text-transform',
  'text-align', 'text-decoration-line', 'white-space', 'word-break',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
  'border-top-style', 'border-top-color', 'border-left-color', 'border-radius',
  'outline-style', 'outline-color', 'gap', 'row-gap', 'column-gap', 'flex-direction', 'flex-wrap',
  'justify-content', 'align-items', 'grid-template-columns', 'grid-auto-flow', 'list-style-type',
  'cursor', 'content', 'object-fit', 'aspect-ratio', 'max-width', 'min-height',
];

async function capturar(page) {
  return page.evaluate((PROPS) => {
    const out = {};
    const caminho = (el) => {
      const p = [];
      for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
        const i = e.parentElement ? [...e.parentElement.children].indexOf(e) : 0;
        p.unshift(`${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}:${i}`);
      }
      return p.join('>');
    };
    for (const el of document.body.querySelectorAll('*')) {
      if (['SCRIPT', 'STYLE', 'LINK', 'META', 'NOSCRIPT', 'TEMPLATE'].includes(el.tagName)) continue;
      const k = caminho(el);
      for (const pseudo of [null, '::before', '::after']) {
        const cs = getComputedStyle(el, pseudo);
        if (pseudo && (cs.content === 'none' || cs.content === 'normal')) continue;
        const v = {};
        for (const p of PROPS) v[p] = cs.getPropertyValue(p);
        out[k + (pseudo || '')] = v;
      }
    }
    return out;
  }, PROPS);
}

async function preparar(page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // Consentimento de cookies já respondido: o banner não entra na foto e não varia.
  await page.addInitScript(() => { try { localStorage.setItem('bdj_cookie_consent_v1', 'essential'); } catch {} });
}

for (const largura of [1280, 390]) {
  test.describe(`${largura}px`, () => {
    test.use({ viewport: { width: largura, height: 900 } });

    for (const f of publicas) {
      test(`público ${f}`, async ({ page }) => {
        await preparar(page);
        await page.route(/supabase\.co|googletagmanager|google-analytics|doubleclick|facebook/, (r) => r.abort());
        await page.goto('/' + f.replace(/index\.html$/, ''), { waitUntil: 'load' });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(600);
        writeFileSync(`${DIR}/${largura}__${f.replace(/[\\/]/g, '_')}.json`, JSON.stringify(await capturar(page)));
      });
    }

    for (const f of painel) {
      test(`painel ${f}`, async ({ page }) => {
        await preparar(page);
        await mockAdmin(page);
        await page.goto('/' + f);
        await page.locator('#admin-app').waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(900);
        writeFileSync(`${DIR}/${largura}__${f}.json`, JSON.stringify(await capturar(page)));
      });
    }
  });
}
