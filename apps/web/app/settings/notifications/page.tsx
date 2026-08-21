'use client';
import { useEffect, useState } from 'react';
const names: Record<string, string> = {
  LIKES: 'ถูกใจ',
  COMMENTS: 'ความคิดเห็น',
  REPLIES: 'ตอบกลับ',
  REDROPS: 'ReDrops',
  FOLLOWS: 'ผู้ติดตาม',
  FOLLOW_REQUESTS: 'คำขอติดตาม',
  MENTIONS: 'การกล่าวถึง',
  TRENDING: 'Trending และ Top 100',
  SYSTEM: 'ประกาศระบบ',
};
type Pref = {
  category: string;
  in_app_enabled: boolean;
  web_push_enabled: boolean;
};
export default function Settings() {
  const [prefs, setPrefs] = useState<Pref[]>([]);
  useEffect(() => {
    fetch('/v1/me/notification-preferences', { credentials: 'include' })
      .then((r) => r.json() as Promise<{ data?: { items?: Pref[] } }>)
      .then((j) => setPrefs(j.data?.items ?? []))
      .catch(() => {});
  }, []);
  const change = async (
    p: Pref,
    key: 'in_app_enabled' | 'web_push_enabled',
  ) => {
    if (p.category === 'SYSTEM' && key === 'in_app_enabled') return;
    const next = { ...p, [key]: !p[key] };
    setPrefs((v) => v.map((x) => (x.category === p.category ? next : x)));
    await fetch('/v1/me/notification-preferences', {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        'x-csrf-token':
          document.cookie.match(/(?:^|; )wyn_csrf=([^;]+)/)?.[1] ?? '',
      },
      body: JSON.stringify({ preferences: [next] }),
    });
  };
  return (
    <section className="notification-settings">
      <a href="/notifications">← การแจ้งเตือน</a>
      <h1>ตั้งค่าการแจ้งเตือน</h1>
      <p className="muted">
        Push จะแสดงข้อความทั่วไปเพื่อปกป้องข้อมูลบนหน้าจอล็อก
        และเปิดได้เมื่อเบราว์เซอร์อนุญาตแล้วเท่านั้น
      </p>
      {prefs.map((p) => (
        <fieldset key={p.category}>
          <legend>{names[p.category]}</legend>
          <label>
            <input
              type="checkbox"
              checked={p.in_app_enabled}
              disabled={p.category === 'SYSTEM'}
              onChange={() => change(p, 'in_app_enabled')}
            />{' '}
            ในแอป
          </label>
          <label>
            <input
              type="checkbox"
              checked={p.web_push_enabled}
              disabled={
                !('Notification' in globalThis) ||
                Notification.permission !== 'granted'
              }
              onChange={() => change(p, 'web_push_enabled')}
            />{' '}
            Web Push
          </label>
        </fieldset>
      ))}
    </section>
  );
}
