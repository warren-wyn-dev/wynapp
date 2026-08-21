export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://wyn_test:wyn_test@127.0.0.1:5432/wyn_test';
export const API_PORT = 4000;
export const WEB_PORT = 3000;
export const WORKER_HEALTH_PORT = 4100;
export const API_ORIGIN = `http://localhost:${API_PORT}`;
export const WEB_ORIGIN = `http://localhost:${WEB_PORT}`;
export const ADMIN_ORIGIN = 'http://localhost:3001';

export const SEED_ADMIN_EMAIL = 'e2e-admin@wyn.test';
export const SEED_ADMIN_PASSWORD = 'E2eAdminPass!234';
