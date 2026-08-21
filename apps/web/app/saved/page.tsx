'use client';
import { useEffect, useState } from 'react';
type Saved = {
  id: string;
  body: string;
  caption: string;
  username: string;
  display_name: string;
  saved_at: string;
};
export default function SavedPage() {
  const [items, setItems] = useState<Saved[]>([]),
    [state, setState] = useState('loading');
  useEffect(() => {
    fetch('/v1/me/saved', { credentials: 'include' })
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((x) => {
        setItems(x.data.items);
        setState('ready');
      })
      .catch(() => setState('error'));
  }, []);
  return (
    <main className="wyn-card">
      <h1>บันทึกไว้</h1>
      {state === 'loading' && <p>กำลังโหลด…</p>}
      {state === 'error' && (
        <p role="alert">กรุณาเข้าสู่ระบบเพื่อดูรายการที่บันทึก</p>
      )}
      {state === 'ready' && items.length === 0 && (
        <p>ยังไม่มี Drop ที่บันทึกไว้</p>
      )}
      {items.map((x) => (
        <article className="saved-drop" key={x.id}>
          <a href={`/drops/${x.id}`}>
            <strong>{x.display_name}</strong> <small>@{x.username}</small>
            <p>{x.body || x.caption}</p>
          </a>
        </article>
      ))}
    </main>
  );
}
