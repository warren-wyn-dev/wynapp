'use client';
import { useState } from 'react';
type ImageItem = {
  file: File;
  preview: string;
  mediaId?: string;
  state: 'selected' | 'uploading' | 'processing' | 'ready' | 'error';
};
export function DropComposer({ initialDraftId }: { initialDraftId?: string }) {
  const [body, setBody] = useState('');
  const [caption, setCaption] = useState('');
  const [link, setLink] = useState('');
  const [location, setLocation] = useState('');
  const [visibility, setVisibility] = useState<'PUBLIC' | 'FOLLOWERS'>(
    'PUBLIC',
  );
  const [images, setImages] = useState<ImageItem[]>([]);
  const [poll, setPoll] = useState(false);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [state, setState] = useState<
    'idle' | 'saving' | 'publishing' | 'success' | 'error'
  >('idle');
  const [message, setMessage] = useState('');
  const csrf = () =>
    decodeURIComponent(
      document.cookie
        .split('; ')
        .find((v) => v.startsWith('__Host-wyn_csrf='))
        ?.split('=')[1] ?? '',
    );
  function choose(files: FileList | null) {
    if (!files) return;
    const room = 9 - images.length;
    const selected = [...files]
      .slice(0, room)
      .filter(
        (f) =>
          ['image/jpeg', 'image/png', 'image/webp'].includes(f.type) &&
          f.size <= 15 * 1024 * 1024,
      )
      .map((file) => ({
        file,
        preview: URL.createObjectURL(file),
        state: 'selected' as const,
      }));
    setImages((v) => [...v, ...selected]);
    if (files.length > room) setMessage('เลือกได้สูงสุด 9 รูป');
  }
  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= images.length) return;
    setImages((v) => {
      const n = [...v];
      [n[index], n[target]] = [n[target]!, n[index]!];
      return n;
    });
  }
  async function upload(item: ImageItem) {
    const csrfHeader = { 'x-csrf-token': csrf() };
    const intent = await fetch('/v1/media/upload-intents', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json', ...csrfHeader },
      body: JSON.stringify({
        purpose: 'DROP_IMAGE',
        mime: item.file.type,
        bytes: item.file.size,
      }),
    });
    if (!intent.ok) throw Error();
    const { data } = (await intent.json()) as {
      data: {
        id: string;
        upload: { url: string; headers: Record<string, string> };
      };
    };
    if (
      !(
        await fetch(data.upload.url, {
          method: 'PUT',
          headers: data.upload.headers,
          body: item.file,
        })
      ).ok
    )
      throw Error();
    await fetch(`/v1/media/${data.id}/complete`, {
      method: 'POST',
      credentials: 'include',
      headers: csrfHeader,
    });
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const response = await fetch(`/v1/media/${data.id}`, {
        credentials: 'include',
      });
      if (
        response.ok &&
        ((await response.json()) as { data: { status: string } }).data
          .status === 'READY'
      )
        return data.id;
    }
    throw Error();
  }
  async function submit(draft: boolean) {
    try {
      setState(draft ? 'saving' : 'publishing');
      const uploaded = [];
      for (let i = 0; i < images.length; i++) {
        const item = images[i]!;
        if (item.mediaId) {
          uploaded.push(item.mediaId);
          continue;
        }
        setImages((v) =>
          v.map((x, j) => (j === i ? { ...x, state: 'uploading' } : x)),
        );
        const id = await upload(item);
        uploaded.push(id);
        setImages((v) =>
          v.map((x, j) =>
            j === i ? { ...x, mediaId: id, state: 'ready' } : x,
          ),
        );
      }
      const response = await fetch(draft ? '/v1/drafts' : '/v1/drops', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'content-type': 'application/json',
          'x-csrf-token': csrf(),
          'idempotency-key': crypto.randomUUID(),
        },
        body: JSON.stringify({
          body,
          caption,
          externalUrl: link || null,
          locationLabel: location || null,
          visibility,
          mediaIds: uploaded,
          poll: poll ? { question, options: options.filter(Boolean) } : null,
        }),
      });
      if (!response.ok) throw Error();
      setState('success');
      setMessage(draft ? 'บันทึกฉบับร่างแล้ว' : 'เผยแพร่ Drop แล้ว');
    } catch {
      setState('error');
      setMessage('ดำเนินการไม่สำเร็จ กรุณาตรวจข้อมูลแล้วลองอีกครั้ง');
    }
  }
  return (
    <section className="wyn-card drop-composer" data-draft-id={initialDraftId}>
      <header>
        <span className="eyebrow">CREATE DROP</span>
        <h1>เล่าเรื่องของคุณ</h1>
        <p>ข้อความ รูปภาพ และสิ่งที่คุณอยากแบ่งปัน</p>
      </header>
      <label>
        ข้อความ
        <textarea
          maxLength={5000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          placeholder="วันนี้มีอะไรเกิดขึ้นบ้าง? #WYN @username"
        />
      </label>
      <label>
        คำบรรยาย
        <input
          maxLength={2200}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
        />
      </label>
      <div>
        <label className="image-button">
          เพิ่มรูป ({images.length}/9)
          <input
            hidden
            multiple
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={images.length >= 9}
            onChange={(e) => choose(e.target.files)}
          />
        </label>
        <div className="drop-images">
          {images.map((item, i) => (
            <figure key={item.preview}>
              <img src={item.preview} alt={`รูปที่ ${i + 1}`} />
              <figcaption>
                {i + 1} · {item.state}
              </figcaption>
              <div>
                <button type="button" onClick={() => move(i, -1)} disabled={!i}>
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === images.length - 1}
                >
                  →
                </button>
                <button
                  type="button"
                  onClick={() => setImages((v) => v.filter((_, j) => j !== i))}
                >
                  ลบ
                </button>
              </div>
            </figure>
          ))}
        </div>
      </div>
      <div className="composer-grid">
        <label>
          ลิงก์
          <input
            type="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://"
          />
        </label>
        <label>
          สถานที่โดยสมัครใจ
          <input
            value={location}
            maxLength={120}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="เช่น เชียงใหม่"
          />
        </label>
        <label>
          การมองเห็น
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as typeof visibility)}
          >
            <option value="PUBLIC">สาธารณะ</option>
            <option value="FOLLOWERS">ผู้ติดตาม</option>
          </select>
        </label>
      </div>
      <label className="check">
        <input
          type="checkbox"
          checked={poll}
          onChange={(e) => setPoll(e.target.checked)}
        />{' '}
        เพิ่มโพล
      </label>
      {poll && (
        <fieldset>
          <legend>โพล (2–4 ตัวเลือก)</legend>
          <input
            value={question}
            maxLength={280}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="คำถาม"
          />
          {options.map((o, i) => (
            <input
              key={i}
              value={o}
              maxLength={100}
              onChange={(e) =>
                setOptions((v) =>
                  v.map((x, j) => (j === i ? e.target.value : x)),
                )
              }
              placeholder={`ตัวเลือก ${i + 1}`}
            />
          ))}
          {options.length < 4 && (
            <button type="button" onClick={() => setOptions((v) => [...v, ''])}>
              เพิ่มตัวเลือก
            </button>
          )}
        </fieldset>
      )}
      <p aria-live="polite">{message}</p>
      <footer>
        <button
          type="button"
          className="secondary"
          disabled={state === 'saving' || state === 'publishing'}
          onClick={() => void submit(true)}
        >
          บันทึกฉบับร่าง
        </button>
        <button
          type="button"
          disabled={
            state === 'saving' ||
            state === 'publishing' ||
            images.some((x) => x.state === 'processing')
          }
          onClick={() => void submit(false)}
        >
          {state === 'publishing' ? 'กำลังเผยแพร่…' : 'เผยแพร่'}
        </button>
      </footer>
    </section>
  );
}
