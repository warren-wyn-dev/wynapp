'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { setCsrfToken } from '../lib/admin-api';

export default function AdminLogin() {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');

  async function submit(form: HTMLFormElement) {
    setState('loading');
    const data = new FormData(form);
    const response = await fetch('/admin/v1/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: data.get('email'),
        password: data.get('password'),
      }),
    });
    if (!response.ok) {
      setState('error');
      return;
    }
    const body = (await response.json()) as { data: { csrf_token: string } };
    setCsrfToken(body.data.csrf_token);
    router.push('/reports');
  }

  return (
    <section className="wyn-card">
      <h1>เข้าสู่ระบบ Admin</h1>
      <p className="muted">สำหรับทีมงานที่ได้รับสิทธิ์เท่านั้น</p>
      <form
        className="grid"
        onSubmit={(e) => {
          e.preventDefault();
          void submit(e.currentTarget);
        }}
      >
        <label>
          อีเมล
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          รหัสผ่าน
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        <button disabled={state === 'loading'}>
          {state === 'loading' ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
        </button>
        {state === 'error' && (
          <p role="alert">อีเมลหรือรหัสผ่านไม่ถูกต้อง หรือไม่มีสิทธิ์ Admin</p>
        )}
      </form>
    </section>
  );
}
