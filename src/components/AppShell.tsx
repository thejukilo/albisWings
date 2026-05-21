'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from '@/app/actions';

type NavItem = { label: string; href: string; icon: React.ReactNode; section?: string; match?: (p: string) => boolean };

const NAV: NavItem[] = [
  { label: 'Übersicht',     href: '/',             icon: <Icon name="home" />,
    match: (p) => p === '/' },
  { label: 'Reservationen', href: '/reservations', icon: <Icon name="calendar" />, section: 'Operations',
    match: (p) => p.startsWith('/reservations') },
  { label: 'Flightlog',     href: '/flightlog',    icon: <Icon name="log" />,
    match: (p) => p.startsWith('/flightlog') },
  { label: 'Techlog',       href: '/techlog',      icon: <Icon name="wrench" />,
    match: (p) => p.startsWith('/techlog') },
  { label: 'Mein Konto',    href: '/profile',      icon: <Icon name="user" />, section: 'Konto',
    match: (p) => p.startsWith('/profile') },
];

export function AppShell({
  user, tenantName, children,
}: {
  user: { name: string; initials: string };
  tenantName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname() || '/';
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('fd-theme') : null;
    if (saved === 'dark' || saved === 'light') setTheme(saved);
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (hydrated) localStorage.setItem('fd-theme', theme);
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('fd-theme-dark', theme === 'dark');
    }
  }, [theme, hydrated]);

  return (
    <div className={`fd-root ${theme === 'dark' ? 'fd-theme-dark' : ''}`}>
      <style>{shellStyles}</style>

      {/* Sidebar */}
      <aside className="fd-sidebar">
        <Link href="/" className="fd-brand">
          <div className="fd-brand-mark">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M3 11L11 3L19 11L11 19L3 11Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M7 11L11 7L15 11L11 15L7 11Z" fill="currentColor"/>
            </svg>
          </div>
          <div className="fd-brand-text">
            <div className="fd-brand-product">Flightdesk</div>
            <div className="fd-brand-tenant">{tenantName}</div>
          </div>
        </Link>

        <nav className="fd-nav">
          {NAV.map((item, i) => {
            const prev = i > 0 ? NAV[i - 1] : null;
            const showSection = item.section && (!prev || prev.section !== item.section);
            const active = item.match ? item.match(pathname) : pathname === item.href;
            return (
              <div key={item.href}>
                {showSection && <div className="fd-nav-section">{item.section}</div>}
                <Link href={item.href} className={`fd-nav-item ${active ? 'fd-nav-active' : ''}`}>
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
            <span>{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>
          </button>
          <form action={signOut} className="fd-signout-form">
            <button type="submit" className="fd-theme-toggle">
              <Icon name="logout" />
              <span>Abmelden</span>
            </button>
          </form>
        </div>
      </aside>

      {/* Main */}
      <div className="fd-main">
        <header className="fd-topbar">
          <div className="fd-search">
            <Icon name="search" />
            <input type="text" placeholder="Suche Flüge, Personen, Flugzeuge…" />
            <kbd>⌘K</kbd>
          </div>
          <div className="fd-topbar-right">
            <div className="fd-user-name">{user.name}</div>
            <div className="fd-avatar" title={user.name}>{user.initials}</div>
          </div>
        </header>

        <main className="fd-content">{children}</main>
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
    case 'search':   return <svg {...common}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>;
    case 'sun':      return <svg {...common}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/></svg>;
    case 'moon':     return <svg {...common}><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/></svg>;
    case 'logout':   return <svg {...common}><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/></svg>;
    default:         return null;
  }
}

const shellStyles = `
.fd-root, .fd-root * { box-sizing: border-box; }
.fd-root { display: grid; grid-template-columns: 240px 1fr; min-height: 100vh; }

.fd-sidebar {
  background: var(--surface);
  border-right: 1px solid var(--border);
  display: flex; flex-direction: column;
  padding: 18px 12px;
  position: sticky; top: 0; height: 100vh;
}
.fd-brand { display: flex; gap: 10px; align-items: center; padding: 4px 8px 18px; text-decoration: none; }
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
.fd-nav-active { background: var(--accent-bg); color: var(--accent); }
.fd-nav-active:hover { background: var(--accent-bg); color: var(--accent); }
.fd-nav-icon { display: grid; place-items: center; color: inherit; opacity: 0.85; }

.fd-sidebar-foot { padding-top: 12px; border-top: 1px solid var(--border); display: flex; flex-direction: column; gap: 2px; }
.fd-signout-form { margin: 0; }
.fd-theme-toggle {
  width: 100%; display: flex; align-items: center; gap: 10px;
  padding: 7px 10px; border-radius: 6px;
  background: transparent; border: none; color: var(--text-2);
  font-size: 13px; cursor: pointer; font-family: inherit;
  transition: background-color 0.08s;
}
.fd-theme-toggle:hover { background: var(--surface-2); color: var(--text); }

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
.fd-user-name { font-size: 13px; color: var(--text-2); font-weight: 500; }
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
