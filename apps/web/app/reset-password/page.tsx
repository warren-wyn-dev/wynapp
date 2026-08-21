'use client';
import { useEffect, useState } from 'react';

export default function Reset() {
  const [token, setToken] = useState('');
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get('token') ?? '');
    setReady(true);
  }, []);

  async function submit(form: HTMLFormElement) {
    setStatus('loading');
    const f = new FormData(form);
    const r = await fetch('/v1/auth/reset-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token, password: f.get('password') }),
    });
    setStatus(r.ok ? 'success' : 'error');
  }

  if (ready && !token) {
    return (
      <section className="card">
        <h1>ตั้งรหัสผ่านใหม่</h1>
        <p role="alert">ลิงก์ไม่ถูกต้อง โปรดเปิดลิงก์จากอีเมลของคุณอีกครั้ง</p>
      </section>
    );
  }

  return (
    <section className="card">
      <h1>ตั้งรหัสผ่านใหม่</h1>
      {status === 'success' ? (
        <p role="status">
          เปลี่ยนรหัสผ่านสำเร็จ คุณสามารถเข้าสู่ระบบด้วยรหัสผ่านใหม่ได้แล้ว
        </p>
      ) : (
        <form
          className="grid"
          onSubmit={(e) => {
            e.preventDefault();
            void submit(e.currentTarget);
          }}
        >
          <label>
            รหัสผ่านใหม่
            <input name="password" type="password" minLength={12} required />
          </label>
          <button disabled={status === 'loading'}>
            {status === 'loading' ? 'กำลังเปลี่ยน…' : 'เปลี่ยนรหัสผ่าน'}
          </button>
          {status === 'error' && (
            <p role="alert">
              โทเค็นที่หมดอายุ ใช้แล้ว หรือไม่ถูกต้องจะถูกปฏิเสธ
            </p>
          )}
        </form>
      )}
    </section>
  );
}
