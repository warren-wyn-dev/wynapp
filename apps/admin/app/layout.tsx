import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SessionGate } from './session-gate';
export const metadata: Metadata = {
  title: 'WYN Admin',
  description: 'WYN moderation and operations',
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="th">
      <body>
        <div className="shell">
          <header className="header">
            <span className="brand">WYN Admin</span>
            <nav className="nav" aria-label="Primary">
              <a href="/reports">Reports</a>
              <a href="/users">Users</a>
              <a href="/content">Content</a>
              <a href="/clubs">Clubs</a>
              <a href="/analytics">Analytics</a>
              <a href="/settings">Settings</a>
            </nav>
          </header>
          <main className="main">
            <SessionGate>{children}</SessionGate>
          </main>
        </div>
      </body>
    </html>
  );
}
