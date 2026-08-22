'use client';
import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

// Catches errors in the root layout itself, which app/error.tsx cannot —
// Next.js requires this file to render its own <html>/<body> since it
// replaces the root layout when triggered.
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="th">
      <body>
        <p>เกิดข้อผิดพลาดที่ไม่คาดคิด</p>
      </body>
    </html>
  );
}
