'use client';
import { useState } from 'react';
export default function Forgot() {
  const [s, setS] = useState(false);
  return (
    <section className="card">
      <h1>ลืมรหัสผ่าน</h1>
      {s ? (
        <p role="status">หากบัญชีมีสิทธิ์ เราจะส่งอีเมลให้คุณ</p>
      ) : (
        <form
          className="grid"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            await fetch(
              `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/v1/auth/forgot-password`,
              {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ email: f.get('email') }),
              },
            );
            setS(true);
          }}
        >
          <label>
            อีเมล
            <input name="email" type="email" required />
          </label>
          <button>ส่งลิงก์รีเซ็ต</button>
        </form>
      )}
    </section>
  );
}
