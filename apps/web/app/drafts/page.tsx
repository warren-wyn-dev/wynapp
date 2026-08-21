'use client';
import { useEffect, useState } from 'react';
type Draft = { id: string; body: string; caption: string; updated_at: string };
export default function Drafts() {
  const [items, setItems] = useState<Draft[]>([]);
  const [state, setState] = useState('loading');
  useEffect(() => {
    fetch('/v1/me/drafts', { credentials: 'include' })
      .then(async (r) => {
        if (!r.ok) throw Error();
        setItems(((await r.json()) as { data: Draft[] }).data);
        setState('ready');
      })
      .catch(() => setState('error'));
  }, []);
  return (
    <section className="wyn-card">
      <h1>ฉบับร่าง</h1>
      {state === 'loading' ? (
        <p>กำลังโหลด…</p>
      ) : state === 'error' ? (
        <p>โหลดฉบับร่างไม่สำเร็จ</p>
      ) : !items.length ? (
        <p>ยังไม่มีฉบับร่าง</p>
      ) : (
        <ul className="draft-list">
          {items.map((d) => (
            <li key={d.id}>
              <a href={`/drafts/${d.id}`}>
                {d.body || d.caption || 'Drop ที่ยังไม่มีข้อความ'}
              </a>
              <time>{new Date(d.updated_at).toLocaleString('th-TH')}</time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
