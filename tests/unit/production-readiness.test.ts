import { describe, expect, it } from 'vitest';
import { validateProductionEnvironment } from '../../scripts/verify-production-env.mjs';

const valid = {
  WYN_ENV: 'staging',
  DATABASE_URL: 'postgresql://wyn@db.internal/wyn_staging',
  APP_ORIGIN: 'https://staging.wyn.example',
  ADMIN_ORIGIN: 'https://admin.staging.wyn.example',
  API_ORIGIN: 'https://api.staging.wyn.example',
  SESSION_SECRET: 'x'.repeat(32),
  OBJECT_STORAGE_BUCKET: 'wyn-staging',
  OBJECT_STORAGE_QUARANTINE_BUCKET: 'wyn-staging-quarantine',
  OBJECT_STORAGE_REGION: 'us-east-1',
  OBJECT_STORAGE_CDN_ORIGIN: 'https://cdn.staging.wyn.example',
  EMAIL_FROM: 'no-reply@wyn.example',
  RESEND_API_KEY: 're_configured',
  OBSERVABILITY_DSN: 'configured',
};

describe('production environment readiness', () => {
  it('accepts a secret-safe, isolated staging configuration', () => {
    expect(validateProductionEnvironment(valid)).toEqual([]);
  });

  it('fails closed for missing values, insecure origins, and malformed flags', () => {
    const errors = validateProductionEnvironment({
      ...valid,
      SESSION_SECRET: 'short',
      ADMIN_ORIGIN: valid.APP_ORIGIN,
      API_ORIGIN: 'http://api.example',
      FEATURE_CHAT_ENABLED: 'yes',
    });
    expect(errors).toContain(
      'SESSION_SECRET must contain at least 32 characters',
    );
    expect(errors).toContain('API_ORIGIN must use HTTPS');
    expect(errors).toContain('FEATURE_CHAT_ENABLED must be true or false');
    expect(errors).toContain(
      'consumer, admin, and API origins must be isolated',
    );
  });
});
