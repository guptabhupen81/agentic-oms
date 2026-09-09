import type { Metadata } from 'next';
import './globals.css';
import { SidebarNav } from './sidebar-nav';

export const metadata: Metadata = {
  title: 'Agentic OMS',
  description: 'Order Management System — showcase build',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="app-shell">
          <aside className="sidebar">
            <div className="brand">
              Agentic OMS
              <span className="sub">FMCG distribution</span>
            </div>
            <SidebarNav />
          </aside>
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
