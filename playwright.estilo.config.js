import { defineConfig } from '@playwright/test';

// Só para o snapshot de estilo calculado (tests/estilo/). Fora do `npm test`.
export default defineConfig({
  testDir: './tests/estilo',
  timeout: 45000,
  workers: 2,
  reporter: [['dot']],
  use: { baseURL: 'http://127.0.0.1:8090' },
  webServer: {
    command: 'npx serve -l 8090 .',
    url: 'http://127.0.0.1:8090',
    reuseExistingServer: true,
    timeout: 30000,
  },
});
