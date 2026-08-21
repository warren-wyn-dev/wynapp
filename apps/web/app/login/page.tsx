'use client';
import { useState } from 'react';
export default function Login() {
  const [state, setState] = useState('idle');
  return (
    <section className="card">
      <h1>เข้าสู่ระบบ</h1>
      <form
        className="grid"
        onSubmit={async (e) => {
          e.preventDefault();
          setState('loading');
          const f = new FormData(e.currentTarget);
          const r = await fetch('/v1/auth/login', {
            method: 'POST',
            credentials: 'include',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              email: f.get('email'),
              password: f.get('password'),
            }),
          });
          setState(r.ok ? 'success' : 'error');
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
        {state === 'error' && <p role="alert">อีเมลหรือรหัสผ่านไม่ถูกต้อง</p>}
        {state === 'success' && <p role="status">เข้าสู่ระบบสำเร็จ</p>}
        <a href="/forgot-password">ลืมรหัสผ่าน?</a>
      </form>
    </section>
  );
}
