'use client';
import { use, useEffect, useState } from 'react';
type Message = {
  id: string;
  sequence: number;
  sender_user_id: string;
  kind: string;
  body?: string;
  deleted: boolean;
  reply_to_message_id?: string;
};
export default function Conversation({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params),
    [messages, setMessages] = useState<Message[]>([]),
    [body, setBody] = useState(''),
    [reply, setReply] = useState<Message>(),
    [status, setStatus] = useState<'connecting' | 'live' | 'offline'>(
      'connecting',
    );
  const load = () =>
    fetch(`/v1/conversations/${id}/messages`, { credentials: 'include' })
      .then(async (r) => {
        if (!r.ok) throw Error();
        const x = (
          (await r.json()) as { data: { items: Message[] } }
        ).data.items.reverse();
        setMessages(x);
        setStatus('live');
        if (x.length)
          void fetch(`/v1/conversations/${id}/read`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'content-type': 'application/json',
              'x-csrf-token':
                document.cookie.match(/(?:^|; )wyn_csrf=([^;]+)/)?.[1] ?? '',
            },
            body: JSON.stringify({ sequence: x.at(-1)!.sequence }),
          });
      })
      .catch(() => setStatus('offline'));
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 10000);
    return () => clearInterval(timer);
  }, [id]);
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    const r = await fetch(`/v1/conversations/${id}/messages`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token':
          document.cookie.match(/(?:^|; )wyn_csrf=([^;]+)/)?.[1] ?? '',
      },
      body: JSON.stringify({
        kind: 'TEXT',
        body: text,
        replyToMessageId: reply?.id,
        clientMessageId: crypto.randomUUID(),
      }),
    });
    if (r.ok) {
      setBody('');
      setReply(undefined);
      await load();
    }
  };
  return (
    <main className="conversation">
      <header>
        <a href="/chat" aria-label="กลับไปกล่องข้อความ">
          ←
        </a>
        <div>
          <h1>การสนทนา</h1>
          <small className={`connection ${status}`}>
            {status === 'live'
              ? 'เชื่อมต่อแล้ว'
              : status === 'connecting'
                ? 'กำลังเชื่อมต่อ…'
                : 'ออฟไลน์ — กำลังลองใหม่'}
          </small>
        </div>
      </header>
      <ol aria-live="polite">
        {messages.map((m) => (
          <li key={m.id} className="bubble">
            <small>{m.kind.replace('_', ' ')}</small>
            {m.deleted ? (
              <i>ลบข้อความแล้ว</i>
            ) : (
              <>
                {m.reply_to_message_id && (
                  <span className="reply-line">↳ ตอบกลับข้อความ</span>
                )}
                <p>
                  {m.body ?? (m.kind === 'IMAGE' ? 'รูปภาพ' : 'การ์ดที่แชร์')}
                </p>
                <button onClick={() => setReply(m)}>ตอบกลับ</button>
              </>
            )}
          </li>
        ))}
      </ol>
      <form className="chat-composer" onSubmit={send}>
        {reply && (
          <div>
            กำลังตอบกลับ{' '}
            <button type="button" onClick={() => setReply(undefined)}>
              ยกเลิก
            </button>
          </div>
        )}
        <label className="sr-only" htmlFor="message">
          ข้อความ
        </label>
        <textarea
          id="message"
          maxLength={4000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="เขียนข้อความ…"
        />
        <button className="wyn-button" disabled={!body.trim()}>
          ส่ง
        </button>
      </form>
    </main>
  );
}
