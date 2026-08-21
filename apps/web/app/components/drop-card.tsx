'use client';

import { useEffect, useRef } from 'react';
import { EngagementPanel } from './engagement-panel';
import type { FeedDrop } from './discovery-types';
import { RelationshipActions } from '../u/[username]/relationship-actions';

export function DropCard({ drop }: { drop: FeedDrop }) {
  const card = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = card.current;
    if (!element) return;
    let dwell: ReturnType<typeof setTimeout> | undefined;
    let counted = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !counted) {
          dwell = setTimeout(() => {
            counted = true;
            void fetch(`/v1/drops/${drop.id}/view`, {
              method: 'POST',
              credentials: 'include',
              headers: {
                'x-csrf-token':
                  document.cookie
                    .split('; ')
                    .find((value) => value.startsWith('__Host-wyn_csrf='))
                    ?.split('=')[1] ?? '',
              },
            });
          }, 2000);
        } else if (dwell) clearTimeout(dwell);
      },
      { threshold: 0.6 },
    );
    observer.observe(element);
    return () => {
      if (dwell) clearTimeout(dwell);
      observer.disconnect();
    };
  }, [drop.id]);

  return (
    <article
      className="feed-drop wyn-card"
      ref={card}
      aria-labelledby={`drop-${drop.id}-author`}
    >
      <header className="feed-drop-header">
        <div>
          <a id={`drop-${drop.id}-author`} href={`/u/${drop.username}`}>
            <strong>{drop.display_name}</strong>
          </a>{' '}
          <span className="muted">@{drop.username}</span>
        </div>
        <RelationshipActions
          username={drop.username}
          initial={drop.relationship_state}
          initialRequestId={drop.follow_request_id}
          compact
        />
      </header>
      <a className="drop-card-link" href={`/drops/${drop.id}`}>
        {drop.body && <p className="drop-body">{drop.body}</p>}
        {drop.caption && <p>{drop.caption}</p>}
      </a>
      {!!drop.media?.length && (
        <div className="drop-images">
          {drop.media.map((media, index) => (
            <img
              key={media.id}
              src={`/v1/media/${media.id}`}
              alt={`รูปที่ ${index + 1}`}
              loading="lazy"
            />
          ))}
        </div>
      )}
      {!!drop.hashtags?.length && (
        <p className="hashtags">
          {drop.hashtags.map((tag) => (
            <a key={tag} href={`/search?q=${encodeURIComponent(`#${tag}`)}`}>
              #{tag}
            </a>
          ))}
        </p>
      )}
      {(drop.created_at ?? drop.published_at) && (
        <time className="muted" dateTime={drop.created_at ?? drop.published_at}>
          {new Date((drop.created_at ?? drop.published_at)!).toLocaleString(
            'th-TH',
          )}
        </time>
      )}
      <EngagementPanel
        dropId={drop.id}
        initial={{
          likes_count: drop.likes_count ?? 0,
          comments_count: drop.comments_count ?? 0,
          redrops_count: drop.redrops_count ?? 0,
          views_count: drop.views_count ?? 0,
          liked: drop.liked ?? false,
          saved: drop.saved ?? false,
        }}
        countView={false}
        compact
      />
    </article>
  );
}
