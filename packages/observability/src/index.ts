import pino, { type Logger } from 'pino';
import { randomUUID } from 'node:crypto';
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
