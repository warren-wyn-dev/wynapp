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
      // The compiled apps/api/dist/**/server.js cannot actually run: tsc
      // mirrors this app's cross-package relative imports (e.g.
      // ../../../packages/database) into apps/api/dist/packages/..., which
      // then can't resolve those packages' own node_modules (drizzle-orm
      // etc.) at runtime. That's a real production-deployability bug
      // (`pnpm --filter @wyn/api start` is broken), tracked separately from
      // this test harness. Running the TS source directly exercises the
      // same app.ts/server.ts over a real HTTP server without depending on
      // that broken build output.
      command: 'pnpm --filter @wyn/api exec tsx src/server.ts',
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
