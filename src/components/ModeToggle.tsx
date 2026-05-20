'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useTransition } from 'react';

export type CalendarMode = 'flugzeug' | 'fluglehrer';

export function ModeToggle({ mode }: { mode: CalendarMode }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [, startTransition] = useTransition();

  function setMode(next: CalendarMode) {
    const params = new URLSearchParams(sp.toString());
    if (next === 'flugzeug') params.delete('mode'); else params.set('mode', next);
    // Clear the filter params when switching modes since they have different meanings
    params.delete('ac');
    params.delete('fi');
    startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }));
  }

  return (
    <div className="inline-flex border border-navy-800 rounded-sm overflow-hidden text-xs">
      <button
        onClick={() => setMode('flugzeug')}
        className={`px-3 py-1.5 transition-colors ${
          mode === 'flugzeug'
            ? 'bg-navy-800 text-cream font-medium'
            : 'bg-white text-navy-800 hover:bg-cream-50'
        }`}
      >
        Flugzeug-Verfügbarkeit
      </button>
      <button
        onClick={() => setMode('fluglehrer')}
        className={`px-3 py-1.5 border-l border-navy-800 transition-colors ${
          mode === 'fluglehrer'
            ? 'bg-navy-800 text-cream font-medium'
            : 'bg-white text-navy-800 hover:bg-cream-50'
        }`}
      >
        Fluglehrer-Verfügbarkeit
      </button>
    </div>
  );
}
