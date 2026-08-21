'use client';

import { useState } from 'react';

type State = 'NONE' | 'FOLLOWING' | 'REQUESTED';
type RelationshipActionsProps = {
  username: string;
  initial?: State | undefined;
  initialRequestId?: string | undefined;
  compact?: boolean;
};

function csrfToken(): string {
  const value = document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith('__Host-wyn_csrf='))
    ?.split('=')[1];
  return value ? decodeURIComponent(value) : '';
}

export function RelationshipActions({
  username,
  initial = 'NONE',
  initialRequestId,
  compact = false,
}: RelationshipActionsProps) {
  const [state, setState] = useState<State>(initial);
  const [requestId, setRequestId] = useState(initialRequestId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function mutate(path: string, method: 'POST' | 'DELETE') {
    return fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ''}${path}`, {
      method,
      credentials: 'include',
      headers: { 'x-csrf-token': csrfToken() },
    });
  }

  async function change() {
    const previous = state;
    setBusy(true);
    setError('');
    try {
      if (state === 'REQUESTED' && requestId) {
        const response = await mutate(
          `/v1/follow-requests/${requestId}`,
          'DELETE',
        );
        if (!response.ok) throw new Error('cancel failed');
        setState('NONE');
        setRequestId(undefined);
        return;
      }
      const response = await mutate(
        `/v1/users/${encodeURIComponent(username)}/follow`,
        state === 'NONE' ? 'POST' : 'DELETE',
      );
      if (!response.ok) throw new Error('relationship update failed');
      if (state === 'NONE') {
        const body = (await response.json()) as {
          data:
            | { state: 'FOLLOWING' }
            | { state: 'REQUESTED'; requestId: string };
        };
        setState(body.data.state);
        setRequestId(
          body.data.state === 'REQUESTED' ? body.data.requestId : undefined,
        );
      } else {
        setState('NONE');
      }
    } catch {
      setState(previous);
      setError('ไม่สามารถอัปเดตความสัมพันธ์ได้ กรุณาลองอีกครั้ง');
    } finally {
      setBusy(false);
    }
  }

  async function preference(kind: 'block' | 'mute') {
    setBusy(true);
    setError('');
    try {
      const response = await mutate(
        `/v1/users/${encodeURIComponent(username)}/${kind}`,
        'POST',
      );
      if (!response.ok) throw new Error(`${kind} failed`);
      if (kind === 'block') {
        setState('NONE');
        setRequestId(undefined);
      }
    } catch {
      setError('ไม่สามารถอัปเดตการตั้งค่าความสัมพันธ์ได้');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={compact ? 'relationship-actions-compact' : 'grid'}
      aria-live="polite"
    >
      <button disabled={busy} onClick={() => void change()}>
        {busy
          ? 'กำลังดำเนินการ…'
          : state === 'FOLLOWING'
            ? 'กำลังติดตาม'
            : state === 'REQUESTED'
              ? 'ยกเลิกคำขอ'
              : 'ติดตาม'}
      </button>
      {error && <p role="alert">{error}</p>}
      {!compact && (
        <details>
          <summary>ตัวเลือกความสัมพันธ์</summary>
          <button
            type="button"
            disabled={busy}
            onClick={() => void preference('block')}
          >
            บล็อก
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void preference('mute')}
          >
            ปิดเสียง
          </button>
        </details>
      )}
    </div>
  );
}
