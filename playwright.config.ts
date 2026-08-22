import { defineConfig } from '@playwright/test';
import {
  ADMIN_ORIGIN,
  ADMIN_PORT,
  API_ORIGIN,
  API_PORT,
  DEV_EMAIL_LOG_PATH,
  MOCK_S3_PORT,
  OBJECT_STORAGE_ENV,
  TEST_DATABASE_URL,
  WEB_ORIGIN,
  WEB_PORT,
  WORKER_HEALTH_PORT,
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
      // Playwright ignores webServer output by default, which is why a
      // startup crash in CI previously produced only "Exit code: N" with no
      // detail — pipe both streams so an actual crash shows its real error.
      stdout: 'pipe',
      stderr: 'pipe',
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
        DEV_EMAIL_LOG_PATH,
        ...OBJECT_STORAGE_ENV,
      },
    },
    {
      command: 'pnpm --filter @wyn/web start',
      url: `${WEB_ORIGIN}/login`,
      reuseExistingServer: reuse,
      timeout: 60000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: { API_ORIGIN, NODE_ENV: 'test', PORT: String(WEB_PORT) },
    },
    {
      command: 'pnpm --filter @wyn/admin start',
      url: `${ADMIN_ORIGIN}/login`,
      reuseExistingServer: reuse,
      timeout: 60000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: { API_ORIGIN, NODE_ENV: 'test', PORT: String(ADMIN_PORT) },
    },
    {
      // Nothing in apps/worker's deployable entrypoint previously called
      // the notification-dispatch loop at all (see the fix in
      // apps/worker/src/main.ts) — without this, notifications from real
      // actions (like, follow, mention, ...) never get created, so this is
      // load-bearing for tests/e2e/notifications.spec.ts.
      command: 'pnpm --filter @wyn/worker start',
      url: `http://localhost:${WORKER_HEALTH_PORT}/health`,
      reuseExistingServer: reuse,
      timeout: 30000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        WORKER_ID: 'e2e-worker',
        DATABASE_URL: TEST_DATABASE_URL,
        WORKER_HEALTH_PORT: String(WORKER_HEALTH_PORT),
        WORKER_POLL_INTERVAL_MS: '250',
        ...OBJECT_STORAGE_ENV,
      },
    },
    {
      // A minimal in-memory S3-compatible test double (see
      // tests/e2e/mock-s3-server.ts) so the media upload/processing E2E
      // coverage exercises the real S3MediaStorage/AWS SDK code path
      // without needing real cloud credentials.
      command: `pnpm exec tsx tests/e2e/mock-s3-server.ts`,
      url: `${OBJECT_STORAGE_ENV.OBJECT_STORAGE_ENDPOINT}/health`,
      reuseExistingServer: reuse,
      timeout: 15000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: { MOCK_S3_PORT: String(MOCK_S3_PORT) },
    },
  ],
});
