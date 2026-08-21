'use client';
import { useEffect, useState } from 'react';

type Status = 'checking' | 'no-token' | 'success' | 'error';

export default function Verify() {
  const [status, setStatus] = useState<Status>('checking');
  const [resendState, setResendState] = useState<'idle' | 'loading' | 'sent'>(
    'idle',
  );

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) {
      setStatus('no-token');
      return;
    }
    fetch('/v1/auth/verify-email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then((r) => setStatus(r.ok ? 'success' : 'error'))
      .catch(() => setStatus('error'));
  }, []);

  async function resend(form: HTMLFormElement) {
    setResendState('loading');
    const f = new FormData(form);
    await fetch('/v1/auth/resend-verification', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: f.get('email') }),
    });
    setResendState('sent');
  }

  return (
    <section className="card">
      <h1>ยืนยันอีเมล</h1>
      {status === 'checking' && <p role="status">กำลังตรวจสอบลิงก์…</p>}
      {status === 'success' && (
        <p role="status">ยืนยันอีเมลสำเร็จ คุณสามารถเข้าสู่ระบบได้แล้ว</p>
      )}
      {(status === 'error' || status === 'no-token') && (
        <>
          <p role="alert">
            {status === 'error'
              ? 'ลิงก์หมดอายุหรือไม่ถูกต้อง'
              : 'เปิดลิงก์ในอีเมลของคุณ ลิงก์ที่หมดอายุหรือไม่ถูกต้องสามารถขอใหม่ได้'}
          </p>
          {resendState === 'sent' ? (
            <p role="status">หากบัญชีมีสิทธิ์ เราจะส่งอีเมลให้คุณ</p>
          ) : (
            <form
              className="grid"
              onSubmit={(e) => {
                e.preventDefault();
                void resend(e.currentTarget);
              }}
            >
              <label>
                อีเมล
                <input name="email" type="email" required />
              </label>
              <button disabled={resendState === 'loading'}>
                {resendState === 'loading'
                  ? 'กำลังส่ง…'
                  : 'ส่งอีเมลยืนยันอีกครั้ง'}
              </button>
            </form>
          )}
        </>
      )}
    </section>
  );
}
