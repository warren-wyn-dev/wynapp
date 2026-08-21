import { z } from 'zod';
const environment = z.enum([
  'local',
  'development',
  'staging',
  'production',
  'test',
]);
export const featureFlagSchema = z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true');
export const baseEnvironmentSchema = z
  .object({ WYN_ENV: environment.default('local') })
  .passthrough();
export type BaseEnvironment = z.infer<typeof baseEnvironmentSchema>;
export function parseEnvironment<T>(
  schema: z.ZodType<T>,
  source: Record<string, string | undefined> = process.env,
): T {
  return schema.parse(source);
}
export const serverEnvironmentSchema = baseEnvironmentSchema.extend({
  DATABASE_URL: z.string().url().startsWith('postgresql://'),
});
export function assertSafeDatabase(
  environmentName: string,
  databaseUrl: string,
): void {
  if (
    environmentName === 'test' &&
    !/(test|localhost|127\.0\.0\.1)/i.test(databaseUrl)
  )
    throw new Error('Test database must be isolated');
  if (environmentName !== 'production' && /prod(uction)?/i.test(databaseUrl))
    throw new Error('Refusing production-like database outside production');
}
