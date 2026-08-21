'use client';
import { ErrorState, Button } from '@wyn/ui';
export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset(): void;
}) {
  return (
    <>
      <ErrorState />
      <Button onClick={reset}>Try again</Button>
    </>
  );
}
