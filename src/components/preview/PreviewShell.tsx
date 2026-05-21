'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type NavItem = { label: string; href: string; icon: React.ReactNode; section?: string };

const NAV: NavItem[] = [
  { label: 'Übersicht',     href: '/preview',          icon: <Icon name="home" /> },
  { label: 'Reservationen', href: '/reservations',     icon: <Icon name="calendar" />, section: 'Operations' },
  { label: 'Flightlog',     href: '/flightlog',        icon: <Icon name="log" /> },
  { label: 'Techlog',       href: '/techlog',          icon: <Icon name="wrench" /> },
  { label: 'Mein Konto',    href: '/profile',          icon: <Icon name="user" />, section: 'Konto' },
];

export function PreviewShell({
  user, tenantName, children,
}: {
  user: { name: string; initials: string };
  tenantName: string;
  children: React.ReactNode;
}) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Persist theme in localStorage
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('preview-theme') : null;
    if (saved === 'dark' || saved === 'light') setTheme(saved);
  }, []);
  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('preview-theme', theme);
  }, [theme]);

  return (
    <div className={`fd-root fd-theme-${theme}`}>
      <style>{cssTokens}</style>

      {/* Sidebar */}
      <aside className="fd-sidebar">
        <div className="fd-brand">
          <div className="fd-brand-mark">
            {/* Simple geometric mark — placeholder for the product logo */}
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M3 11L11 3L19 11L11 19L3 11Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M7 11L11 7L15 11L11 15L7 11Z" fill="currentColor"/>
            </svg>
          </div>
          <div className="fd-brand-text">
            <div className="fd-brand-product">Flightdesk</div>
            <div className="fd-brand-tenant">{tenantName}</div>
          </div>
        </div>

        <nav className="fd-nav">
          {NAV.map((item, i) => {
            const prev = i > 0 ? NAV[i - 1] : null;
            const showSection = item.section && (!prev || prev.section !== item.section);
            return (
              <div key={item.href}>
                {showSection && <div className="fd-nav-section">{item.section}</div>}
                <Link href={item.href} className="fd-nav-item">
                  <span className="fd-nav-icon">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              </div>
            );
          })}
        </nav>

        <div className="fd-sidebar-foot">
          <button
            type="button"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="fd-theme-toggle"
            aria-label="Theme umschalten"
          >
            {theme === 'light' ? <Icon name="moon" /> : <Icon name="sun" />}
            <span>{theme === 'light' ? 'Dark' : 'Light'} mode</span>
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="fd-main">
        <header className="fd-topbar">
          <div className="fd-search">
            <Icon name="search" />
            <input type="text" placeholder="Suche Flüge, Personen, Flugzeuge…" />
            <kbd>⌘K</kbd>
          </div>
          <div className="fd-topbar-right">
            <button className="fd-icon-btn" aria-label="Benachrichtigungen">
              <Icon name="bell" />
              <span className="fd-badge-dot" />
            </button>
            <div className="fd-avatar" title={user.name}>{user.initials}</div>
          </div>
        </header>

        <main className="fd-content">
          {children}
        </main>
      </div>
    </div>
  );
}

function Icon({ name }: { name: string }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (name) {
    case 'home':     return <svg {...common}><path d="M3 12l9-9 9 9"/><path d="M5 10v11h14V10"/></svg>;
    case 'calendar': return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>;
    case 'log':      return <svg {...common}><path d="M4 6h16M4 12h16M4 18h10"/></svg>;
    case 'wrench':   return <svg {...common}><path d="M14.7 6.3a4 4 0 015 5L18 13l-7 7-4-4 7-7 1.7-2.7z"/><path d="M9 11L4 16"/></svg>;
    case 'user':     return <svg {...common}><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>;
    case 'bell':     return <svg {...common}><path d="M6 8a6 6 0 0112 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 21a2 2 0 004 0"/></svg>;
    case 'search':   return <svg {...common}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>;
    case 'sun':      return <svg {...common}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/></svg>;
    case 'moon':     return <svg {...common}><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/></svg>;
    case 'arrow':    return <svg {...common}><path d="M5 12h14M13 5l7 7-7 7"/></svg>;
    default:         return null;
  }
}

const cssTokens = `
.fd-root {
  --bg:       #ffffff;
  --surface:  #fafafa;
  --surface-2:#f5f5f5;
  --border:   #e5e5e5;
  --border-strong: #d4d4d4;
  --text:     #0a0a0a;
  --text-2:   #525252;
  --text-3:   #a3a3a3;
  --accent:   #3b82f6;
  --accent-bg:#eff6ff;
  --success:  #16a34a;
  --success-bg:#f0fdf4;
  --warning:  #d97706;
  --warning-bg:#fffbeb;
  --danger:   #dc2626;
  --danger-bg:#fef2f2;
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.04);
  --shadow:    0 4px 16px rgba(0,0,0,0.06);

  font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
  font-feature-settings: 'cv11', 'ss01', 'ss03';
  font-variant-numeric: tabular-nums;
  background: var(--bg);
  color: var(--text);

  display: grid;
  grid-template-columns: 240px 1fr;
  min-height: 100vh;
}
body:has(.fd-theme-dark) { background: #0a0a0a; }
.fd-theme-dark {
  --bg:       #0a0a0a;
  --surface:  #111111;
  --surface-2:#171717;
  --border:   #262626;
  --border-strong: #404040;
  --text:     #fafafa;
  --text-2:   #a3a3a3;
  --text-3:   #525252;
  --accent:   #60a5fa;
  --accent-bg:#1e3a8a33;
  --success:  #22c55e;
  --success-bg:#14532d33;
  --warning:  #eab308;
  --warning-bg:#71370733;
  --danger:   #ef4444;
  --danger-bg:#7f1d1d33;
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.4);
  --shadow:    0 4px 16px rgba(0,0,0,0.5);
}

.fd-root, .fd-root * { box-sizing: border-box; }

/* Sidebar */
.fd-sidebar {
  background: var(--surface);
  border-right: 1px solid var(--border);
  display: flex; flex-direction: column;
  padding: 18px 12px;
  position: sticky; top: 0; height: 100vh;
}
.fd-brand { display: flex; gap: 10px; align-items: center; padding: 4px 8px 18px; }
.fd-brand-mark {
  width: 32px; height: 32px; border-radius: 8px;
  background: var(--accent); color: white;
  display: grid; place-items: center;
}
.fd-brand-text .fd-brand-product { font-weight: 600; font-size: 14px; letter-spacing: -0.01em; color: var(--text); }
.fd-brand-text .fd-brand-tenant  { font-size: 11px; color: var(--text-2); }

.fd-nav { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.fd-nav-section {
  font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--text-3); padding: 16px 10px 6px;
}
.fd-nav-item {
  display: flex; align-items: center; gap: 10px;
  padding: 7px 10px; border-radius: 6px;
  font-size: 13px; color: var(--text-2);
  text-decoration: none;
  transition: background-color 0.08s, color 0.08s;
}
.fd-nav-item:hover { background: var(--surface-2); color: var(--text); }
.fd-nav-item.active { background: var(--accent-bg); color: var(--accent); }
.fd-nav-icon { display: grid; place-items: center; color: inherit; opacity: 0.85; }

.fd-sidebar-foot { padding-top: 12px; border-top: 1px solid var(--border); }
.fd-theme-toggle {
  width: 100%; display: flex; align-items: center; gap: 10px;
  padding: 7px 10px; border-radius: 6px;
  background: transparent; border: none; color: var(--text-2);
  font-size: 13px; cursor: pointer; font-family: inherit;
  transition: background-color 0.08s;
}
.fd-theme-toggle:hover { background: var(--surface-2); color: var(--text); }

/* Topbar */
.fd-main { display: flex; flex-direction: column; min-width: 0; }
.fd-topbar {
  position: sticky; top: 0; z-index: 10;
  background: color-mix(in srgb, var(--bg) 88%, transparent);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--border);
  padding: 12px 24px; display: flex; align-items: center; gap: 16px;
}
.fd-search {
  flex: 1; max-width: 480px;
  display: flex; align-items: center; gap: 8px;
  background: var(--surface); border: 1px solid var(--border);
  padding: 6px 10px; border-radius: 8px; color: var(--text-2);
}
.fd-search input {
  flex: 1; background: transparent; border: none; outline: none;
  font: inherit; color: var(--text); font-size: 13px;
}
.fd-search input::placeholder { color: var(--text-3); }
.fd-search kbd {
  font: inherit; font-size: 11px; padding: 1px 5px;
  background: var(--bg); border: 1px solid var(--border);
  border-radius: 4px; color: var(--text-2);
}

.fd-topbar-right { display: flex; align-items: center; gap: 12px; margin-left: auto; }
.fd-icon-btn {
  position: relative;
  background: transparent; border: none; padding: 6px;
  border-radius: 6px; color: var(--text-2); cursor: pointer;
  display: grid; place-items: center;
}
.fd-icon-btn:hover { background: var(--surface-2); color: var(--text); }
.fd-badge-dot {
  position: absolute; top: 5px; right: 5px;
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--danger); border: 2px solid var(--bg);
}
.fd-avatar {
  width: 32px; height: 32px; border-radius: 50%;
  background: var(--accent); color: white;
  display: grid; place-items: center;
  font-size: 11px; font-weight: 600; letter-spacing: 0.02em;
}

.fd-content { padding: 28px 32px; max-width: 1400px; margin: 0 auto; width: 100%; }

@media (max-width: 768px) {
  .fd-root { grid-template-columns: 1fr; }
  .fd-sidebar { display: none; }
}
`;
