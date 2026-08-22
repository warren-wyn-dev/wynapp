'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { adminFetch, AdminApiError, clearCsrfToken } from './lib/admin-api';

type Status =
  | { kind: 'checking' }
  | { kind: 'authenticated'; role: string }
  | { kind: 'anonymous' };

export function SessionGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: 'checking' });

  useEffect(() => {
    let cancelled = false;
    if (pathname === '/login') {
      setStatus({ kind: 'anonymous' });
      return;
    }
    adminFetch<{ authenticated: true; role: string }>('/admin/v1/session')
      .then((data) => {
        if (!cancelled) setStatus({ kind: 'authenticated', role: data.role });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setStatus({ kind: 'anonymous' });
        if (error instanceof AdminApiError && error.status === 401)
          router.replace('/login');
      });
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  async function logout() {
    try {
      await adminFetch('/admin/v1/auth/logout', { method: 'POST' });
    } finally {
      clearCsrfToken();
      router.replace('/login');
    }
  }

  if (pathname === '/login') return <>{children}</>;
  if (status.kind === 'checking')
    return (
      <p role="status" className="muted">
        กำลังตรวจสอบสิทธิ์…
      </p>
    );
  if (status.kind === 'anonymous') return null;
  return (
    <>
      <p className="session-badge">
        เข้าสู่ระบบในฐานะ <strong>{status.role}</strong>{' '}
        <button onClick={() => void logout()}>ออกจากระบบ</button>
      </p>
      {children}
    </>
  );
}
