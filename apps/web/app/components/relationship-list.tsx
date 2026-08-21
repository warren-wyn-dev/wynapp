'use client';

import { useEffect, useState } from 'react';

type Person = {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
};
type RelationshipListProps = {
  endpoint: string;
  empty: string;
  action?: 'unblock' | 'unmute';
};

export function RelationshipList({
  endpoint,
  empty,
  action,
}: RelationshipListProps) {
  const [items, setItems] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    void fetch(endpoint, {
      credentials: 'include',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('load failed');
        const body = (await response.json()) as { data: { items: Person[] } };
        setItems(body.data.items);
      })
      .catch((cause: unknown) => {
        if (!(cause instanceof DOMException && cause.name === 'AbortError')) {
          setError('ไม่สามารถโหลดรายการได้');
        }
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [endpoint]);

  async function remove(person: Person) {
    if (!action) return;
    const previous = items;
    setItems((current) =>
      current.filter((item) => item.user_id !== person.user_id),
    );
    const token = document.cookie
      .split('; ')
      .find((cookie) => cookie.startsWith('__Host-wyn_csrf='))
      ?.split('=')[1];
    try {
      const response = await fetch(
        `/v1/users/${encodeURIComponent(person.username)}/${action.slice(2)}`,
        {
          method: 'DELETE',
          credentials: 'include',
          headers: { 'x-csrf-token': token ? decodeURIComponent(token) : '' },
        },
      );
      if (!response.ok) throw new Error('remove failed');
    } catch {
      setItems(previous);
      setError('ไม่สามารถบันทึกการเปลี่ยนแปลงได้');
    }
  }

  if (loading) return <p role="status">กำลังโหลด…</p>;
  if (error && items.length === 0) return <p role="alert">{error}</p>;
  if (items.length === 0) return <p className="muted">{empty}</p>;
  return (
    <div className="grid">
      {error && <p role="alert">{error}</p>}
      {items.map((person) => (
        <article className="card relationship-row" key={person.user_id}>
          <div>
            <strong>{person.display_name}</strong>
            <p className="muted">@{person.username}</p>
          </div>
          {action && (
            <button type="button" onClick={() => void remove(person)}>
              {action === 'unblock' ? 'เลิกบล็อก' : 'เลิกปิดเสียง'}
            </button>
          )}
        </article>
      ))}
    </div>
  );
}
