'use client';
import { useEffect, useState } from 'react';
type Item = {
  id: string;
  type: string;
  actor_display_name?: string;
  read_at?: string;
  created_at: string;
};
const labels: Record<string, string> = {
  DROP_LIKED: 'ถูกใจ Drop ของคุณ',
  COMMENT_CREATED: 'แสดงความคิดเห็นใน Drop ของคุณ',
  COMMENT_REPLIED: 'ตอบกลับความคิดเห็นของคุณ',
  DROP_REDROPPED: 'ReDrop โพสต์ของคุณ',
  QUOTE_REDROP_CREATED: 'Quote ReDrop โพสต์ของคุณ',
  USER_FOLLOWED: 'ติดตามคุณแล้ว',
  FOLLOW_REQUEST_RECEIVED: 'ส่งคำขอติดตาม',
  FOLLOW_REQUEST_APPROVED: 'อนุมัติคำขอติดตามของคุณ',
  USER_MENTIONED: 'กล่าวถึงคุณ',
  TRENDING_ACHIEVED: 'Drop ของคุณกำลังติดเทรนด์',
  TOP100_ACHIEVED: 'คุณติด WYN Top 100',
  SYSTEM_ANNOUNCEMENT: 'ประกาศจาก WYN',
  CHAT_MESSAGE: 'ส่งข้อความถึงคุณ',
};
export default function Page() {
  const [items, setItems] = useState<Item[]>([]),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true);
  const load = () =>
    fetch('/v1/notifications', { credentials: 'include' })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const j = (await r.json()) as { data: { items: Item[] } };
        setItems(j.data.items);
      })
      .catch(() => setError('ไม่สามารถโหลดการแจ้งเตือนได้'))
      .finally(() => setLoading(false));
  useEffect(() => {
    void load();
  }, []);
  const all = async () => {
    await fetch('/v1/notifications/read-all', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'x-csrf-token':
          document.cookie.match(/(?:^|; )__Host-wyn_csrf=([^;]+)/)?.[1] ?? '',
      },
    });
    setItems((v) =>
      v.map((x) => ({ ...x, read_at: new Date().toISOString() })),
    );
  };
  return (
    <section className="notifications-page">
      <header>
        <div>
          <p className="eyebrow">WYN UPDATES</p>
          <h1>การแจ้งเตือน</h1>
        </div>
        <div>
          <a href="/settings/notifications">ตั้งค่า</a>{' '}
          <button className="wyn-button" onClick={all}>
            อ่านทั้งหมด
          </button>
        </div>
      </header>
      {loading && <p role="status">กำลังโหลด…</p>}
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {!loading && !error && !items.length && (
        <div className="wyn-state">ยังไม่มีการแจ้งเตือน</div>
      )}
      <ul className="notification-list">
        {items.map((n) => (
          <li key={n.id} className={n.read_at ? '' : 'unread'}>
            <span className="notification-icon" aria-hidden>
              {n.type.includes('LIKED')
                ? '♥'
                : n.type.includes('COMMENT')
                  ? '●'
                  : n.type.includes('FOLLOW')
                    ? '＋'
                    : n.type.includes('TRENDING') || n.type.includes('TOP100')
                      ? '↗'
                      : n.type.includes('SYSTEM')
                        ? 'W'
                        : '@'}
            </span>
            <div>
              <strong>
                {n.actor_display_name ??
                  (n.type === 'SYSTEM_ANNOUNCEMENT' ? 'WYN' : '')}
              </strong>{' '}
              {labels[n.type] ?? 'มีอัปเดตใหม่'}
              <time>{new Date(n.created_at).toLocaleString('th-TH')}</time>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
