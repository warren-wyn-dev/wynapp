'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { DropCard } from '../../components/drop-card';
import { pageData, type FeedDrop } from '../../components/discovery-types';

export default function TopicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const [drops, setDrops] = useState<FeedDrop[]>([]);
  const [cursor, setCursor] = useState<string | null>();
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const load = useCallback(
    async (next?: string | null) => {
      setState('loading');
      try {
        const query = new URLSearchParams({ limit: '20' });
        if (next) query.set('cursor', next);
        const response = await fetch(
          `/v1/topics/${encodeURIComponent(slug)}?${query}`,
          { credentials: 'include' },
        );
        if (!response.ok) throw new Error();
        const page = pageData<FeedDrop>(await response.json());
        setDrops((current) =>
          next ? [...current, ...page.items] : page.items,
        );
        setCursor(page.next_cursor);
        setState('ready');
      } catch {
        setState('error');
      }
    },
    [slug],
  );
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <section className="feed-shell">
      <header className="feed-heading">
        <div>
          <span className="eyebrow">TOPIC</span>
          <h1>#{slug}</h1>
        </div>
        <a href="/search">กลับไป Discovery</a>
      </header>
      <div aria-live="polite" aria-busy={state === 'loading'}>
        {state === 'loading' && drops.length === 0 && (
          <span className="wyn-skeleton feed-skeleton" />
        )}
        {state === 'error' && (
          <div className="wyn-state">
            <h2>โหลด Topic ไม่สำเร็จ</h2>
            <button onClick={() => void load()}>ลองอีกครั้ง</button>
          </div>
        )}
        {state === 'ready' && drops.length === 0 && (
          <div className="wyn-state">
            <h2>ยังไม่มี Drop ใน Topic นี้</h2>
          </div>
        )}
        <div className="feed-list">
          {drops.map((drop) => (
            <DropCard key={drop.id} drop={drop} />
          ))}
        </div>
        {state === 'ready' && cursor && (
          <button className="load-more" onClick={() => void load(cursor)}>
            โหลดเพิ่มเติม
          </button>
        )}
      </div>
    </section>
  );
}
