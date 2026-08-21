'use client';
import { useEffect, useState } from 'react';
import { EngagementPanel } from '../../components/engagement-panel';
type Drop = {
  body: string;
  caption: string;
  external_url?: string;
  location_label?: string;
  created_at: string;
  edited_at?: string;
  username: string;
  display_name: string;
  hashtags: string[];
  mentions: { userId: string; username: string }[];
  media: { id: string; position: number }[];
  poll_question?: string;
  poll_options: { id: string; label: string }[];
  id: string;
  likes_count: number;
  comments_count: number;
  redrops_count: number;
  views_count: number;
  liked: boolean;
  saved: boolean;
};
export default function DropDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [drop, setDrop] = useState<Drop>();
  const [state, setState] = useState('loading');
  useEffect(() => {
    params
      .then(({ id }) => fetch(`/v1/drops/${id}`, { credentials: 'include' }))
      .then(async (r) => {
        if (!r.ok) throw Error();
        setDrop(((await r.json()) as { data: Drop }).data);
        setState('ready');
      })
      .catch(() => setState('error'));
  }, [params]);
  if (state === 'loading')
    return (
      <section className="wyn-card">
        <p>กำลังโหลด Drop…</p>
      </section>
    );
  if (!drop)
    return (
      <section className="wyn-card">
        <h1>ไม่พบ Drop</h1>
        <p>เนื้อหานี้อาจถูกลบหรือคุณไม่มีสิทธิ์ดู</p>
      </section>
    );
  return (
    <article className="wyn-card drop-detail">
      <header>
        <strong>{drop.display_name}</strong> <span>@{drop.username}</span>
      </header>
      {drop.body && <p className="drop-body">{drop.body}</p>}
      {drop.caption && <p>{drop.caption}</p>}
      <div className="drop-images">
        {drop.media.map((m, i) => (
          <img key={m.id} src={`/v1/media/${m.id}`} alt={`รูปที่ ${i + 1}`} />
        ))}
      </div>
      <p>
        {drop.hashtags.map((h) => (
          <a key={h} href={`/search?q=${encodeURIComponent('#' + h)}`}>
            {' '}
            #{h}
          </a>
        ))}{' '}
        {drop.mentions.map((m) => (
          <a key={m.userId} href={`/u/${m.username}`}>
            {' '}
            @{m.username}
          </a>
        ))}
      </p>
      {drop.external_url && (
        <p>
          <a
            href={drop.external_url}
            target="_blank"
            rel="noopener noreferrer nofollow"
          >
            {drop.external_url}
          </a>
        </p>
      )}
      {drop.poll_question && (
        <fieldset disabled>
          <legend>{drop.poll_question}</legend>
          {drop.poll_options.map((o) => (
            <label key={o.id}>
              <input type="radio" name="poll" /> {o.label}
            </label>
          ))}
        </fieldset>
      )}
      {drop.location_label && <p>📍 {drop.location_label}</p>}
      <footer>
        <time>{new Date(drop.created_at).toLocaleString('th-TH')}</time>
        {drop.edited_at && <span> · แก้ไขแล้ว</span>}
      </footer>
      <EngagementPanel dropId={drop.id} initial={drop} />
    </article>
  );
}
