import Link from 'next/link';
import Image from 'next/image';
import { signOut } from '@/app/actions';

const navItems = [
  { href: '/',             key: 'checkin',      label: 'Check-in' },
  { href: '/reservations', key: 'reservations', label: 'Reservationen' },
  { href: '/flightlog',    key: 'flightlog',    label: 'Flightlog' },
  { href: '/techlog',      key: 'techlog',      label: 'Techlog' },
  { href: '/drive',        key: 'drive',        label: 'FlyDrive' },
  { href: '/contacts',     key: 'contacts',     label: 'Kontakte' },
  { href: '/shop',         key: 'shop',         label: 'Shop' },
  { href: '/training',     key: 'training',     label: 'Training' },
  { href: '/account',      key: 'account',      label: 'Mein Konto' },
];

export function TopNav({ userName, active = 'checkin' }: { userName: string; active?: string }) {
  return (
    <header>
      <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
        <Link href="/" aria-label="Albis Wings home">
          <Image
            src="/aw-logo.png"
            alt="Albis Wings"
            width={140}
            height={92}
            priority
            className="h-16 w-auto"
          />
        </Link>
        <div className="flex items-center gap-6">
          <span className="text-navy-800 text-sm">{userName}</span>
          <form action={signOut}>
            <button
              type="submit"
              className="text-sm text-neutral-500 hover:text-signal-600 transition-colors"
            >
              Logout
            </button>
          </form>
        </div>
      </div>

      <div className="nav-stripe">
        <nav className="max-w-7xl mx-auto px-6">
          <ul className="flex items-center gap-1 overflow-x-auto py-3">
            {navItems.map((item, idx) => (
              <li key={item.href} className="flex items-center">
                <Link
                  href={item.href}
                  className={`text-sm whitespace-nowrap transition-colors px-3 ${
                    active === item.key
                      ? 'text-navy-800 font-medium'
                      : 'text-neutral-500 hover:text-navy-800'
                  }`}
                >
                  {item.label}
                </Link>
                {idx < navItems.length - 1 && (
                  <span aria-hidden className="text-neutral-300 text-xs">•</span>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
