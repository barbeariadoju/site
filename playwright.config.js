import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  // booking-live.spec.js grava e apaga dado real no Supabase de produção -
  // só roda com `npm run test:e2e:live` (opt-in explícito), nunca no `npm test`.
  testIgnore: process.env.RUN_LIVE_TESTS ? [] : ['**/booking-live.spec.js'],
  timeout: 30000,
  // suíte pequena; rodar em paralelo nesta máquina causou flakiness por
  // disputa de recursos (vários Chromium + servidor local ao mesmo tempo).
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:8090',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npx serve -l 8090 .',
    url: 'http://127.0.0.1:8090',
    reuseExistingServer: true,
    timeout: 30000,
  },
});
