const required = [
  'DATABASE_URL',
  'APP_ORIGIN',
  'ADMIN_ORIGIN',
  'API_ORIGIN',
  'SESSION_SECRET',
  'OBJECT_STORAGE_BUCKET',
  'OBJECT_STORAGE_REGION',
  'EMAIL_FROM',
  'OBSERVABILITY_DSN',
];

const booleanFlags = [
  'FEATURE_CLUBS_ENABLED',
  'FEATURE_CHAT_ENABLED',
  'FEATURE_NOTIFICATIONS_ENABLED',
  'FEATURE_ADMIN_MODERATION_ENABLED',
];

export function validateProductionEnvironment(source) {
  const errors = [];
  if (source.WYN_ENV !== 'production' && source.WYN_ENV !== 'staging') {
    errors.push('WYN_ENV must be staging or production');
  }
  for (const name of required) {
    if (!source[name]?.trim()) errors.push(`${name} is required`);
  }
  for (const name of ['APP_ORIGIN', 'ADMIN_ORIGIN', 'API_ORIGIN']) {
    const value = source[name];
    if (value && !value.startsWith('https://'))
      errors.push(`${name} must use HTTPS`);
  }
  if (source.SESSION_SECRET && source.SESSION_SECRET.length < 32) {
    errors.push('SESSION_SECRET must contain at least 32 characters');
  }
  if (source.DATABASE_URL && !/^postgres(ql)?:\/\//.test(source.DATABASE_URL)) {
    errors.push('DATABASE_URL must be a PostgreSQL URL');
  }
  for (const name of booleanFlags) {
    if (
      source[name] !== undefined &&
      !['true', 'false'].includes(source[name])
    ) {
      errors.push(`${name} must be true or false`);
    }
  }
  if (
    new Set([source.APP_ORIGIN, source.ADMIN_ORIGIN, source.API_ORIGIN]).size <
    3
  ) {
    errors.push('consumer, admin, and API origins must be isolated');
  }
  return errors;
}

if (
  process.argv[1] &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href
) {
  const errors = validateProductionEnvironment(process.env);
  if (errors.length) {
    console.error(`Environment readiness failed:\n- ${errors.join('\n- ')}`);
    process.exitCode = 1;
  } else {
    console.log('Environment readiness passed (values were not printed).');
  }
}
