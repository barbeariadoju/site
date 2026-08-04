import { test, expect } from '@playwright/test';
import { mockAdmin } from './_supabase-mock.js';

test('debug: click e selectOption imediato', async ({ page }) => {
  await mockAdmin(page);
  await page.goto('/admin-conteudo.html');
  await expect(page.locator('#admin-app')).toBeVisible();
  await page.click('#conteudo-new-btn');
  try {
    await page.selectOption('#conteudo-new-platform', 'instagram_story', { timeout: 3000 });
    console.log('SELECT OK');
  } catch {
    const state = await page.evaluate(() => ({
      formHidden: document.getElementById('conteudo-new-form').hidden,
      btnHidden: document.getElementById('conteudo-new-btn').hidden,
      selectDisplay: getComputedStyle(document.getElementById('conteudo-new-platform')).display,
      formDisplay: getComputedStyle(document.getElementById('conteudo-new-form')).display,
      styleHref: [...document.styleSheets].map(s => s.href).join(' | '),
    }));
    console.log('FALHOU:', JSON.stringify(state, null, 2));
  }
});
