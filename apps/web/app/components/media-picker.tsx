'use client';
import { useRef, useState } from 'react';
type State =
  | 'idle'
  | 'preview'
  | 'uploading'
  | 'processing'
  | 'ready'
  | 'error';
export function MediaPicker({
  purpose,
  label,
}: {
  purpose: 'PROFILE_AVATAR' | 'PROFILE_COVER';
  label: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>('idle');
  const [preview, setPreview] = useState<string>();
  const [error, setError] = useState('');
  async function choose(file?: File) {
    if (!file) return;
    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      file.size > 15 * 1024 * 1024
    ) {
      setState('error');
      setError('รองรับ JPEG, PNG หรือ WebP ขนาดไม่เกิน 15 MB');
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
    setState('preview');
    setError('');
  }
  async function upload() {
    const file = input.current?.files?.[0];
    if (!file) return;
    try {
      setState('uploading');
      const csrf =
        document.cookie
          .split('; ')
          .find((v) => v.startsWith('wyn_csrf='))
          ?.split('=')[1] ?? '';
      const headers = {
        'content-type': 'application/json',
        'x-csrf-token': decodeURIComponent(csrf),
      };
      const intent = await fetch('/v1/media/upload-intents', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ purpose, mime: file.type, bytes: file.size }),
      });
      if (!intent.ok) throw new Error();
      const body = (await intent.json()) as {
        data: {
          id: string;
          upload: { url: string; headers: Record<string, string> };
        };
      };
      const put = await fetch(body.data.upload.url, {
        method: 'PUT',
        headers: body.data.upload.headers,
        body: file,
      });
      if (!put.ok) throw new Error();
      setState('processing');
      const done = await fetch(`/v1/media/${body.data.id}/complete`, {
        method: 'POST',
        credentials: 'include',
        headers,
      });
      if (!done.ok) throw new Error();
      for (let attempt = 0; attempt < 30; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const status = await fetch(`/v1/media/${body.data.id}`, {
          credentials: 'include',
        });
        if (
          status.ok &&
          ((await status.json()) as { data: { status: string } }).data
            .status === 'READY'
        ) {
          const kind = purpose === 'PROFILE_AVATAR' ? 'avatar' : 'cover';
          const attached = await fetch(`/v1/me/${kind}`, {
            method: 'PUT',
            credentials: 'include',
            headers,
            body: JSON.stringify({ mediaId: body.data.id }),
          });
          if (!attached.ok) throw new Error();
          setState('ready');
          return;
        }
      }
      throw new Error();
    } catch {
      setState('error');
      setError('อัปโหลดไม่สำเร็จ กรุณาลองอีกครั้ง');
    }
  }
  return (
    <div className="media-picker">
      <label>
        {label}
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => void choose(e.target.files?.[0])}
        />
      </label>
      {preview && (
        <img
          src={preview}
          alt="ตัวอย่างรูปที่เลือก"
          style={{ maxWidth: 320, maxHeight: 180, objectFit: 'cover' }}
        />
      )}
      <p aria-live="polite">
        {state === 'uploading'
          ? 'กำลังอัปโหลด…'
          : state === 'processing'
            ? 'กำลังประมวลผล…'
            : state === 'ready'
              ? 'บันทึกรูปแล้ว'
              : state === 'error'
                ? error
                : ''}
      </p>
      {state === 'preview' && (
        <button type="button" onClick={() => void upload()}>
          อัปโหลด
        </button>
      )}
      {state === 'error' && (
        <button type="button" onClick={() => void upload()}>
          ลองอีกครั้ง
        </button>
      )}
      {preview && (
        <button
          type="button"
          onClick={() => {
            URL.revokeObjectURL(preview);
            setPreview(undefined);
            setState('idle');
            if (input.current) input.current.value = '';
          }}
        >
          ลบ
        </button>
      )}
    </div>
  );
}
