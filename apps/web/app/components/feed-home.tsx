'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { DropCard } from './drop-card';
import { pageData, type FeedDrop } from './discovery-types';

type FeedKind = 'for-you' | 'following';

export function FeedHome() {
  const [kind, setKind] = useState<FeedKind>('for-you');
  const [items, setItems] = useState<FeedDrop[]>([]);
  const [cursor, setCursor] = useState<string | null>();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const request = useRef(0);

  const load = useCallback(
    async (next?: string | null, refresh = false) => {
      const id = ++request.current;
      if (refresh || !next) setStatus('loading');
      try {
        const params = new URLSearchParams({ limit: '20' });
        if (next) params.set('cursor', next);
        const response = await fetch(`/v1/feed/${kind}?${params}`, {
          credentials: 'include',
        });
        if (!response.ok) throw new Error('feed unavailable');
        const page = pageData<FeedDrop>(await response.json());
        if (id !== request.current) return;
        setItems((current) =>
          refresh || !next
            ? page.items
            : [
                ...current,
                ...page.items.filter(
                  (item) => !current.some((old) => old.id === item.id),
                ),
              ],
        );
        setCursor(page.next_cursor);
        setStatus('ready');
      } catch {
        if (id === request.current) setStatus('error');
      }
    },
    [kind],
  );

  useEffect(() => {
    void load(null, true);
  }, [load]);

  return (
    <section className="feed-shell">
      <header className="feed-heading">
        <div>
          <span className="eyebrow">HOME</span>
          <h1>พื้นที่ของคุณ</h1>
        </div>
        <button
          className="refresh-button"
          type="button"
          onClick={() => void load(null, true)}
          disabled={status === 'loading'}
        >
          รีเฟรช
        </button>
      </header>
      <div className="feed-tabs" role="tablist" aria-label="เลือกฟีด">
        <button
          role="tab"
          aria-selected={kind === 'for-you'}
          onClick={() => setKind('for-you')}
        >
          For You
        </button>
        <button
          role="tab"
          aria-selected={kind === 'following'}
          onClick={() => setKind('following')}
        >
          Following
        </button>
      </div>
      <div role="tabpanel" aria-live="polite" aria-busy={status === 'loading'}>
        {status === 'loading' && items.length === 0 && <FeedSkeleton />}
        {status === 'error' && (
          <State
            title="โหลดฟีดไม่สำเร็จ"
            detail="ตรวจสอบการเชื่อมต่อแล้วลองอีกครั้ง"
            action={() => void load(null, true)}
          />
        )}
        {status === 'ready' && items.length === 0 && (
          <State
            title={
              kind === 'following'
                ? 'ฟีด Following ยังว่าง'
                : 'ยังไม่มี Drop ที่แนะนำ'
            }
            detail={
              kind === 'following'
                ? 'ติดตาม Creator ที่สนใจเพื่อพบ Drop ของพวกเขาที่นี่'
                : 'กลับมาใหม่อีกครั้งเมื่อมี Drop สาธารณะ'
            }
          />
        )}
        <div className="feed-list">
          {items.map((drop) => (
            <DropCard key={drop.id} drop={drop} />
          ))}
        </div>
        {status === 'ready' && cursor && (
          <button className="load-more" onClick={() => void load(cursor)}>
            โหลดเพิ่มเติม
          </button>
        )}
      </div>
    </section>
  );
}

function FeedSkeleton() {
  return (
    <div className="feed-list" aria-label="กำลังโหลดฟีด">
      <span className="wyn-skeleton feed-skeleton" />
      <span className="wyn-skeleton feed-skeleton" />
      <span className="sr-only">กำลังโหลด</span>
    </div>
  );
}

function State({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: () => void;
}) {
  return (
    <div className="wyn-state feed-state">
      <h2>{title}</h2>
      <p className="muted">{detail}</p>
      {action && <button onClick={action}>ลองอีกครั้ง</button>}
    </div>
  );
}
