'use client';
import { useEffect, useState } from 'react';
type Conversation = {
  id: string;
  peer_username: string;
  unread_count: number;
  kind?: string;
  created_at?: string;
};
type Request = {
  id: string;
  conversation_id: string;
  username_normalized: string;
};
export default function ChatInbox() {
  const [items, setItems] = useState<Conversation[]>([]),
    [requests, setRequests] = useState<Request[]>([]),
    [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const load = () =>
    Promise.all([
      fetch('/v1/conversations', { credentials: 'include' }),
      fetch('/v1/message-requests', { credentials: 'include' }),
    ])
      .then(async ([a, b]) => {
        if (!a.ok || !b.ok) throw Error();
        setItems(
          ((await a.json()) as { data: { items: Conversation[] } }).data.items,
        );
        setRequests(
          ((await b.json()) as { data: { items: Request[] } }).data.items,
        );
        setState('ready');
      })
      .catch(() => setState('error'));
  useEffect(() => {
    void load();
  }, []);
  const decide = async (id: string, action: 'accept' | 'reject') => {
    await fetch(`/v1/message-requests/${id}/${action}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'x-csrf-token':
          document.cookie.match(/(?:^|; )wyn_csrf=([^;]+)/)?.[1] ?? '',
      },
    });
    await load();
  };
  return (
    <main className="chat-shell">
      <header>
        <p className="eyebrow">PRIVATE &amp; SECURE</p>
        <h1>ข้อความ</h1>
        <p>คุยแบบส่วนตัว ข้อความจะปรากฏหลังจากบันทึกสำเร็จ</p>
      </header>
      {state === 'loading' && <p role="status">กำลังโหลดการสนทนา…</p>}
      {state === 'error' && (
        <div className="wyn-state" role="alert">
          เชื่อมต่อไม่ได้{' '}
          <button onClick={() => void load()}>ลองอีกครั้ง</button>
        </div>
      )}
      {requests.length > 0 && (
        <section>
          <h2>
            คำขอข้อความ <span>{requests.length}</span>
          </h2>
          <ul className="chat-list">
            {requests.map((r) => (
              <li key={r.id}>
                <strong>@{r.username_normalized}</strong>
                <div>
                  <button onClick={() => void decide(r.id, 'accept')}>
                    ยอมรับ
                  </button>
                  <button
                    className="quiet"
                    onClick={() => void decide(r.id, 'reject')}
                  >
                    ปฏิเสธ
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}{' '}
      {state === 'ready' && (
        <section>
          <h2>แชทของคุณ</h2>
          {!items.length && (
            <div className="wyn-state">
              <b>ยังไม่มีข้อความ</b>
              <p>เมื่อเริ่มการสนทนา รายการจะแสดงที่นี่</p>
            </div>
          )}
          <ul className="chat-list">
            {items.map((c) => (
              <li key={c.id}>
                <a href={`/chat/${c.id}`}>
                  <span className="chat-avatar">
                    {c.peer_username.slice(0, 1).toUpperCase()}
                  </span>
                  <span>
                    <strong>@{c.peer_username}</strong>
                    <small>
                      {c.kind
                        ? c.kind.replace('_', ' ').toLowerCase()
                        : 'เริ่มการสนทนา'}
                    </small>
                  </span>
                  {c.unread_count > 0 && (
                    <mark
                      aria-label={`${c.unread_count} ข้อความที่ยังไม่ได้อ่าน`}
                    >
                      {c.unread_count}
                    </mark>
                  )}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
