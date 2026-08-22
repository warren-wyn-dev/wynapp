import * as Sentry from '@sentry/nextjs';

// NEXT_PUBLIC_ because this file ships in the client bundle — unset means
// the SDK stays inert (no events sent), not a crash.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
