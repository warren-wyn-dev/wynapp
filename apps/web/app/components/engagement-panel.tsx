'use client';
import { useEffect, useState } from 'react';
type Counts = {
  likes_count: number;
  comments_count: number;
  redrops_count: number;
  views_count: number;
  liked: boolean;
  saved: boolean;
};
type Comment = {
  id: string;
  parent_comment_id?: string;
  body?: string;
  username: string;
  display_name: string;
  deleted_at?: string;
};
export function EngagementPanel({
  dropId,
  initial,
  countView = true,
  compact = false,
}: {
  dropId: string;
  initial: Counts;
  countView?: boolean;
  compact?: boolean;
}) {
  const [counts, setCounts] = useState(initial),
    [comments, setComments] = useState<Comment[]>([]),
    [text, setText] = useState(''),
    [busy, setBusy] = useState(''),
    [error, setError] = useState('');
  const csrf = () =>
    document.cookie
      .split('; ')
      .find(
        (v) => v.startsWith('__Host-wyn_csrf=') || v.startsWith('wyn_csrf='),
      )
      ?.split('=')[1] ?? '';
  async function mutate(path: string, method = 'POST', body?: object) {
    setBusy(path);
    setError('');
    try {
      const r = await fetch(path, {
        method,
        credentials: 'include',
        headers: { 'content-type': 'application/json', 'x-csrf-token': csrf() },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (r.status === 401) throw Error('กรุณาเข้าสู่ระบบ');
      if (!r.ok) throw Error('ดำเนินการไม่สำเร็จ');
      return r.status === 204 ? null : await r.json();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
      throw e;
    } finally {
      setBusy('');
    }
  }
  useEffect(() => {
    if (!compact) {
      fetch(`/v1/drops/${dropId}/comments`, { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((x) => setComments(x.data.items))
        .catch(() => {});
    }
    if (countView) void mutate(`/v1/drops/${dropId}/view`).catch(() => {});
  }, [dropId, countView, compact]);
  async function toggleLike() {
    const before = counts;
    setCounts((c) => ({
      ...c,
      liked: !c.liked,
      likes_count: c.likes_count + (c.liked ? -1 : 1),
    }));
    try {
      const x = await mutate(
        `/v1/drops/${dropId}/like`,
        before.liked ? 'DELETE' : 'POST',
      );
      setCounts((c) => ({ ...c, ...x.data }));
    } catch {
      setCounts(before);
    }
  }
  async function addComment() {
    if (!text.trim()) return;
    try {
      const x = await mutate(`/v1/drops/${dropId}/comments`, 'POST', { text });
      setComments((c) => [...c, x.data]);
      setCounts((c) => ({ ...c, comments_count: c.comments_count + 1 }));
      setText('');
    } catch {}
  }
  async function share() {
    try {
      const canShare = typeof navigator.share === 'function';
      if (canShare) await navigator.share({ url: location.href });
      else await navigator.clipboard.writeText(location.href);
      await mutate(`/v1/drops/${dropId}/share`, 'POST', {
        channel: canShare ? 'WEB_SHARE' : 'COPY_LINK',
      });
    } catch {}
  }
  return (
    <section
      className={`engagement${compact ? ' engagement-compact' : ''}`}
      aria-label="การมีส่วนร่วม"
    >
      <div className="engagement-counts">
        <span>{counts.views_count} Views</span>
        <span>{counts.likes_count} Likes</span>
        <span>{counts.comments_count} Comments</span>
        <span>{counts.redrops_count} ReDrops</span>
      </div>
      <div className="engagement-actions">
        <button
          disabled={!!busy}
          aria-pressed={counts.liked}
          onClick={() => void toggleLike()}
        >
          ❤️ {counts.liked ? 'Unlike' : 'Like'}
        </button>
        <button
          disabled={!!busy}
          onClick={() => document.getElementById('comment-composer')?.focus()}
        >
          💬 Comment
        </button>
        <button
          disabled={!!busy}
          onClick={() =>
            void mutate(`/v1/drops/${dropId}/redrop`)
              .then(() =>
                setCounts((c) => ({
                  ...c,
                  redrops_count: c.redrops_count + 1,
                })),
              )
              .catch(() => {})
          }
        >
          🔄 ReDrop
        </button>
        <button disabled={!!busy} onClick={() => void share()}>
          ↗️ Share
        </button>
        <button
          disabled={!!busy}
          aria-pressed={counts.saved}
          onClick={() =>
            void mutate(
              `/v1/drops/${dropId}/save`,
              counts.saved ? 'DELETE' : 'POST',
            )
              .then(() => setCounts((c) => ({ ...c, saved: !c.saved })))
              .catch(() => {})
          }
        >
          🔖 {counts.saved ? 'Saved' : 'Save'}
        </button>
      </div>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      {!compact && (
        <div className="comment-composer">
          <label htmlFor="comment-composer">แสดงความคิดเห็น</label>
          <textarea
            id="comment-composer"
            maxLength={2000}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button
            disabled={!!busy || !text.trim()}
            onClick={() => void addComment()}
          >
            ส่ง
          </button>
        </div>
      )}
      {!compact && (
        <div className="comment-list">
          {comments.length === 0 ? (
            <p className="muted">ยังไม่มีความคิดเห็น</p>
          ) : (
            comments.map((c) => (
              <article
                key={c.id}
                className={c.parent_comment_id ? 'comment reply' : 'comment'}
              >
                <strong>
                  {c.display_name} <small>@{c.username}</small>
                </strong>
                <p>{c.deleted_at ? 'ความคิดเห็นนี้ถูกลบแล้ว' : c.body}</p>
              </article>
            ))
          )}
        </div>
      )}
    </section>
  );
}
