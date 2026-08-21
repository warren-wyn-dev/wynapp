'use client';

import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { DropCard } from '../components/drop-card';
import {
  pageData,
  type FeedDrop,
  type PublicUser,
  type Topic,
} from '../components/discovery-types';
import { RelationshipActions } from '../u/[username]/relationship-actions';

type SearchKind = 'users' | 'drops' | 'hashtags';
type Hashtag = {
  name?: string;
  hashtag?: string;
  slug?: string;
  drop_count?: number;
};

async function getPage<T>(
  path: string,
): Promise<{ items: T[]; next_cursor?: string | null }> {
  const response = await fetch(path, { credentials: 'include' });
  if (!response.ok) throw new Error('request failed');
  return pageData<T>(await response.json());
}

export default function DiscoveryPage() {
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<SearchKind>('users');
  const [results, setResults] = useState<unknown[]>([]);
  const [cursor, setCursor] = useState<string | null>();
  const [searchState, setSearchState] = useState<
    'idle' | 'loading' | 'ready' | 'error'
  >('idle');

  const search = useCallback(
    async (next?: string | null) => {
      if (!query.trim()) return;
      setSearchState('loading');
      try {
        const params = new URLSearchParams({ q: query.trim(), limit: '20' });
        if (next) params.set('cursor', next);
        const page = await getPage<unknown>(`/v1/search/${kind}?${params}`);
        setResults((current) =>
          next ? [...current, ...page.items] : page.items,
        );
        setCursor(page.next_cursor);
        setSearchState('ready');
      } catch {
        setSearchState('error');
      }
    },
    [kind, query],
  );

  useEffect(() => {
    if (query) void search();
  }, [query, kind, search]);
  function submit(event: FormEvent) {
    event.preventDefault();
    const normalized = input.trim().slice(0, 100);
    setResults([]);
    setCursor(null);
    setQuery(normalized);
  }

  return (
    <main className="discovery-shell">
      <header className="discovery-heading">
        <span className="eyebrow">DISCOVER</span>
        <h1>ค้นพบสิ่งที่ใช่สำหรับคุณ</h1>
        <p className="muted">
          ค้นหา Creator, Drop, Hashtag และสำรวจสิ่งที่กำลังได้รับความสนใจ
        </p>
      </header>
      <form className="search-form" role="search" onSubmit={submit}>
        <label className="sr-only" htmlFor="discovery-search">
          ค้นหา
        </label>
        <input
          id="discovery-search"
          value={input}
          maxLength={100}
          onChange={(event) => setInput(event.target.value)}
          placeholder="ค้นหา @username, Drop หรือ #hashtag"
          autoComplete="off"
        />
        <button type="submit" disabled={!input.trim()}>
          ค้นหา
        </button>
      </form>
      {query ? (
        <SearchResults
          kind={kind}
          setKind={setKind}
          query={query}
          state={searchState}
          results={results}
          retry={() => void search()}
          more={cursor ? () => void search(cursor) : undefined}
        />
      ) : (
        <DiscoveryOverview />
      )}
    </main>
  );
}

function SearchResults({
  kind,
  setKind,
  query,
  state,
  results,
  retry,
  more,
}: {
  kind: SearchKind;
  setKind: (kind: SearchKind) => void;
  query: string;
  state: string;
  results: unknown[];
  retry: () => void;
  more?: (() => void) | undefined;
}) {
  return (
    <section aria-labelledby="results-title">
      <h2 id="results-title">ผลการค้นหา “{query}”</h2>
      <div className="search-tabs" role="tablist" aria-label="ประเภทผลการค้นหา">
        {(['users', 'drops', 'hashtags'] as const).map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={kind === tab}
            onClick={() => setKind(tab)}
          >
            {tab === 'users' ? 'Users' : tab === 'drops' ? 'Drops' : 'Hashtags'}
          </button>
        ))}
      </div>
      <div role="tabpanel" aria-live="polite" aria-busy={state === 'loading'}>
        {state === 'loading' && results.length === 0 && (
          <span className="wyn-skeleton search-skeleton" />
        )}
        {state === 'error' && (
          <DiscoveryState title="ค้นหาไม่สำเร็จ" retry={retry} />
        )}
        {state === 'ready' && results.length === 0 && (
          <DiscoveryState
            title="ไม่พบผลลัพธ์"
            detail="ลองใช้คำค้นอื่นหรือสะกดให้กว้างขึ้น"
          />
        )}
        {kind === 'users' && <UserList users={results as PublicUser[]} />}
        {kind === 'drops' && (
          <div className="feed-list">
            {(results as FeedDrop[]).map((drop) => (
              <DropCard key={drop.id} drop={drop} />
            ))}
          </div>
        )}
        {kind === 'hashtags' && <Hashtags items={results as Hashtag[]} />}
        {more && state === 'ready' && (
          <button className="load-more" onClick={more}>
            ดูผลลัพธ์เพิ่มเติม
          </button>
        )}
      </div>
    </section>
  );
}

function DiscoveryOverview() {
  return (
    <div className="discovery-grid">
      <RemoteSection<Topic>
        title="Trending Topics"
        path="/v1/discovery/trending-topics?limit=8"
        render={(items) => (
          <div className="topic-cloud">
            {items.map((topic) => (
              <a key={topic.slug} href={`/topics/${topic.slug}`}>
                #{topic.label ?? topic.slug}
                <small>
                  {topic.drop_count
                    ? `${topic.drop_count} Drops`
                    : 'กำลังมาแรง'}
                </small>
              </a>
            ))}
          </div>
        )}
      />
      <RemoteSection<PublicUser>
        title="WYN Top 100"
        path="/v1/discovery/top-creators?limit=10"
        render={(items) => <UserList users={items} ranked />}
      />
      <RemoteSection<PublicUser>
        title="Suggested Users"
        path="/v1/discovery/suggested-users?limit=8"
        render={(items) => <UserList users={items} />}
      />
      <RemoteSection<FeedDrop>
        title="Suggested Content"
        path="/v1/discovery/suggested-content?limit=8"
        render={(items) => (
          <div className="feed-list">
            {items.map((drop) => (
              <DropCard key={drop.id} drop={drop} />
            ))}
          </div>
        )}
      />
      <RemoteSection<FeedDrop>
        title="Trending Drops"
        path="/v1/discovery/trending-drops?limit=8"
        render={(items) => (
          <div className="feed-list">
            {items.map((drop) => (
              <DropCard key={drop.id} drop={drop} />
            ))}
          </div>
        )}
      />
      <section className="discovery-section club-foundation">
        <div>
          <span className="eyebrow">FOUNDATION</span>
          <h2>Suggested Clubs</h2>
        </div>
        <p className="muted">
          Clubs ยังไม่เปิดใช้งานในเวอร์ชันนี้ ส่วนนี้สงวนไว้สำหรับ data contract
          ในอนาคตและไม่มีข้อมูล Club จำลอง
        </p>
      </section>
    </div>
  );
}

function RemoteSection<T>({
  title,
  path,
  render,
}: {
  title: string;
  path: string;
  render: (items: T[]) => React.ReactNode;
}) {
  const [items, setItems] = useState<T[]>([]),
    [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const load = useCallback(() => {
    setState('loading');
    getPage<T>(path)
      .then((page) => {
        setItems(page.items);
        setState('ready');
      })
      .catch(() => setState('error'));
  }, [path]);
  useEffect(load, [load]);
  return (
    <section className="discovery-section">
      <h2>{title}</h2>
      {state === 'loading' && <span className="wyn-skeleton" />}
      {state === 'error' && (
        <DiscoveryState title={`โหลด ${title} ไม่สำเร็จ`} retry={load} />
      )}
      {state === 'ready' && items.length === 0 && (
        <p className="muted">ยังไม่มีรายการในส่วนนี้</p>
      )}
      {state === 'ready' && render(items)}
    </section>
  );
}

function UserList({
  users,
  ranked = false,
}: {
  users: PublicUser[];
  ranked?: boolean;
}) {
  return (
    <div className="user-list">
      {users.map((user, index) => (
        <article className="discovery-user" key={user.id ?? user.username}>
          {ranked && (
            <strong className="rank">#{user.rank ?? index + 1}</strong>
          )}
          <div>
            <a href={`/u/${user.username}`}>
              <strong>{user.display_name}</strong>
            </a>
            <p className="muted">@{user.username}</p>
            {user.bio && <p>{user.bio}</p>}
          </div>
          <RelationshipActions
            username={user.username}
            initial={user.relationship_state}
            initialRequestId={user.follow_request_id}
            compact
          />
        </article>
      ))}
    </div>
  );
}
function Hashtags({ items }: { items: Hashtag[] }) {
  return (
    <div className="hashtag-list">
      {items.map((item) => {
        const tag = item.name ?? item.hashtag ?? item.slug ?? '';
        return (
          <a key={tag} href={`/search?q=${encodeURIComponent(`#${tag}`)}`}>
            <strong>#{tag}</strong>
            <span className="muted">{item.drop_count ?? 0} Drops</span>
          </a>
        );
      })}
    </div>
  );
}
function DiscoveryState({
  title,
  detail,
  retry,
}: {
  title: string;
  detail?: string;
  retry?: () => void;
}) {
  return (
    <div className="wyn-state">
      <strong>{title}</strong>
      {detail && <p className="muted">{detail}</p>}
      {retry && <button onClick={retry}>ลองอีกครั้ง</button>}
    </div>
  );
}
