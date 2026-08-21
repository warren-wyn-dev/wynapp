import path from 'node:path';

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://wyn_test:wyn_test@127.0.0.1:5432/wyn_test';

// There is no real mailbox in E2E — this is where DevelopmentEmailAdapter
// (apps/api/src/email.ts) appends every queued message, raw token included,
// so specs can drive the actual verify-email/reset-password links instead
// of stubbing them out. Playwright always runs from the repo root, same
// assumption the rest of this file's relative-path-free config already
// makes.
export const DEV_EMAIL_LOG_PATH = path.join(
  process.cwd(),
  'tests',
  'e2e',
  '.tmp',
  'dev-emails.jsonl',
);
export const API_PORT = 4000;
export const WEB_PORT = 3000;
export const ADMIN_PORT = 3001;
export const WORKER_HEALTH_PORT = 4100;
export const MOCK_S3_PORT = 4200;
export const API_ORIGIN = `http://localhost:${API_PORT}`;
export const WEB_ORIGIN = `http://localhost:${WEB_PORT}`;
// apps/admin/package.json hardcodes `next start -p 3001`, so this must match.
export const ADMIN_ORIGIN = `http://localhost:${ADMIN_PORT}`;
export const MOCK_S3_ORIGIN = `http://localhost:${MOCK_S3_PORT}`;

export const SEED_ADMIN_EMAIL = 'e2e-admin@wyn.test';
export const SEED_ADMIN_PASSWORD = 'E2eAdminPass!234';

// A permissive local test double (tests/e2e/mock-s3-server.ts), not a real
// bucket — these are the object-storage env vars apps/api and apps/worker
// both read via createS3MediaStorageFromEnv (packages/media/src/storage.ts).
export const OBJECT_STORAGE_ENV = {
  OBJECT_STORAGE_REGION: 'us-east-1',
  OBJECT_STORAGE_ENDPOINT: MOCK_S3_ORIGIN,
  OBJECT_STORAGE_FORCE_PATH_STYLE: 'true',
  OBJECT_STORAGE_QUARANTINE_BUCKET: 'wyn-e2e-quarantine',
  OBJECT_STORAGE_BUCKET: 'wyn-e2e-processed',
  OBJECT_STORAGE_CDN_ORIGIN: `${MOCK_S3_ORIGIN}/wyn-e2e-processed`,
  OBJECT_STORAGE_ACCESS_KEY_ID: 'e2e-mock-access-key',
  OBJECT_STORAGE_SECRET_ACCESS_KEY: 'e2e-mock-secret-key',
};
