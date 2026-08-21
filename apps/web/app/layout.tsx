import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
export const metadata: Metadata = {
  title: 'WYN Foundation',
  description: 'WYN engineering foundation',
};
export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <header className="header">
            <span className="brand">WYN</span>
            <nav className="nav" aria-label="Primary">
              <a href="/">Home</a>
              <a href="/search">/search</a>
              <a href="/create">/create</a>
              <a href="/notifications">/notifications</a>
              <a href="/profile">/profile</a>
            </nav>
          </header>
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
