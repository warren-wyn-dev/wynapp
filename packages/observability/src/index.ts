import pino, { type Logger } from 'pino';
import { randomUUID } from 'node:crypto';
import * as Sentry from '@sentry/node';
const redact = [
  'password',
  'token',
  'cookie',
  'authorization',
  'secret',
  'session',
  'req.headers.authorization',
  'req.headers.cookie',
];
export function createLogger(service: string): Logger {
  return pino({
    name: service,
    redact: { paths: redact, censor: '[REDACTED]' },
  });
}
export const createRequestId = (): string => randomUUID();
export const createCorrelationId = createRequestId;
export interface ErrorCapture {
  capture(error: unknown, context?: Record<string, string>): void;
}
export interface Metrics {
  increment(name: string, value?: number): void;
  observe(name: string, value: number): void;
}
export const noopErrorCapture: ErrorCapture = { capture: () => undefined };
export const noopMetrics: Metrics = {
  increment: () => undefined,
  observe: () => undefined,
};

/**
 * Initializes the Sentry Node SDK once and returns an ErrorCapture backed by
 * it. tracesSampleRate is 0 — this wires error reporting only, not
 * performance tracing, which would need its own review of what's worth the
 * overhead.
 */
export function createSentryErrorCapture(
  dsn: string,
  environment: string,
): ErrorCapture {
  Sentry.init({ dsn, environment, tracesSampleRate: 0 });
  return {
    capture(error, context) {
      Sentry.captureException(error, context ? { extra: context } : undefined);
    },
  };
}
