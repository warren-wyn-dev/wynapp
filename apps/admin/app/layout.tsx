import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
export const metadata: Metadata = {
  title: 'WYN Admin Foundation',
  description: 'WYN engineering foundation',
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <header className="header">
            <span className="brand">WYN Admin</span>
            <nav className="nav" aria-label="Primary">
              <a href="/">Home</a>
              <a href="/users">/users</a>
              <a href="/content">/content</a>
              <a href="/clubs">/clubs</a>
              <a href="/reports">/reports</a>
              <a href="/analytics">/analytics</a>
              <a href="/settings">/settings</a>
            </nav>
          </header>
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
