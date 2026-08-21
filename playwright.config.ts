import { defineConfig } from '@playwright/test';
import {
  API_ORIGIN,
  API_PORT,
  TEST_DATABASE_URL,
  WEB_ORIGIN,
  WEB_PORT,
} from './tests/e2e/constants.js';

const reuse = !process.env.CI;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  globalSetup: './tests/e2e/global-setup.ts',
  use: {
    trace: 'on-first-retry',
    baseURL: WEB_ORIGIN,
    ...(process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? {
          launchOptions: {
            executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH,
          },
        }
      : {}),
  },
  webServer: [
    {
      // Runs the actual production artifact (apps/api/dist/server.js, built
      // by `pnpm build` beforehand) rather than the TS source, so this
      // exercises the same start command a real deployment would use.
      command: 'pnpm --filter @wyn/api start',
      url: `${API_ORIGIN}/health`,
      reuseExistingServer: reuse,
      timeout: 30000,
      env: {
        WYN_ENV: 'test',
        NODE_ENV: 'test',
        DATABASE_URL: TEST_DATABASE_URL,
        API_HOST: '127.0.0.1',
        API_PORT: String(API_PORT),
        APP_ORIGIN: WEB_ORIGIN,
        // The real auth rate limit (10/minute) is sized for one human, not
        // a suite that scripts many accounts' logins back to back; this
        // override only takes effect outside production (see server.ts).
        AUTH_RATE_LIMIT_MAX: '1000',
      },
    },
    {
      command: 'pnpm --filter @wyn/web start',
      url: `${WEB_ORIGIN}/login`,
      reuseExistingServer: reuse,
      timeout: 60000,
      env: { API_ORIGIN, NODE_ENV: 'test', PORT: String(WEB_PORT) },
    },
  ],
});
