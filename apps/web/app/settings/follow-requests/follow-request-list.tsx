'use client';

import { useEffect, useState } from 'react';
type Request = {
  id: string;
  username: string;
  display_name: string;
  created_at: string;
};

export function FollowRequestList() {
  const [items, setItems] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    void fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/v1/me/follow-requests`,
      { credentials: 'include', signal: controller.signal },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error('load failed');
        setItems(
          ((await response.json()) as { data: { items: Request[] } }).data
            .items,
        );
      })
      .catch((cause: unknown) => {
        if (!(cause instanceof DOMException && cause.name === 'AbortError'))
          setError('ไม่สามารถโหลดคำขอได้');
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);
  async function decide(id: string, decision: 'approve' | 'reject') {
    const previous = items;
    setItems((current) => current.filter((item) => item.id !== id));
    const token = document.cookie
      .split('; ')
      .find((cookie) => cookie.startsWith('__Host-wyn_csrf='))
      ?.split('=')[1];
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/v1/follow-requests/${id}/${decision}`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'x-csrf-token': token ? decodeURIComponent(token) : '' },
        },
      );
      if (!response.ok) throw new Error('decision failed');
    } catch {
      setItems(previous);
      setError('ไม่สามารถบันทึกการตัดสินใจได้');
    }
  }
  if (loading) return <p role="status">กำลังโหลด…</p>;
  if (error && items.length === 0) return <p role="alert">{error}</p>;
  if (items.length === 0) return <p className="muted">ยังไม่มีคำขอติดตาม</p>;
  return (
    <div className="grid">
      {error && <p role="alert">{error}</p>}
      {items.map((request) => (
        <article className="card" key={request.id}>
          <strong>{request.display_name}</strong>
          <p className="muted">@{request.username}</p>
          <div className="relationship-actions">
            <button onClick={() => void decide(request.id, 'approve')}>
              ยอมรับ
            </button>
            <button onClick={() => void decide(request.id, 'reject')}>
              ปฏิเสธ
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
