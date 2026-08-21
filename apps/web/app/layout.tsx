import './globals.css';
import type { ReactNode } from 'react';
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="th">
      <body>
        <main className="shell">
          <div className="rainbow" />
          <nav className="nav" aria-label="หลัก">
            <a className="brand" href="/">
              WYN
            </a>
            <a href="/">Home</a>
            <a href="/search">Discovery</a>
            <a href="/notifications">การแจ้งเตือน</a>
            <a href="/create">สร้าง Drop</a>
            <a href="/profile">โปรไฟล์</a>
            <a href="/settings">ตั้งค่า</a>
          </nav>
          {children}
        </main>
      </body>
    </html>
  );
}
