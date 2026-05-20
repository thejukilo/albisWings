import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Albis Wings — Crew Portal',
  description: 'Crew Portal',
  icons: {
    icon: [
      { url: '/icon-32.png',  sizes: '32x32',  type: 'image/png' },
      { url: '/icon-64.png',  sizes: '64x64',  type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
