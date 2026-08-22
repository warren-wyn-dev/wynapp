'use client';
import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { ErrorState, Button } from '@wyn/ui';
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset(): void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <>
      <ErrorState />
      <Button onClick={reset}>Try again</Button>
    </>
  );
}
