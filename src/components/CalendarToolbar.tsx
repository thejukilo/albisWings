'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useTransition } from 'react';
import { format } from 'date-fns';
import type { ViewMode } from '@/lib/calendar';
import { shiftAnchor, formatRangeLabel } from '@/lib/calendar';

export function CalendarToolbar({
  view,
  anchor,
}: {
  view: ViewMode;
  anchor: Date;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [, startTransition] = useTransition();

  function go(newView: ViewMode, newAnchor: Date) {
    const next = new URLSearchParams(sp.toString());
    next.set('view', newView);
    next.set('date', format(newAnchor, 'yyyy-MM-dd'));
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-neutral-200 bg-white">
      <a
        href={`/reservations/new?date=${format(anchor, 'yyyy-MM-dd')}`}
        className="bg-navy-800 text-white text-xs px-3 py-1.5 rounded-sm hover:bg-navy-700 transition-colors"
      >
        + Neue Reservation
      </a>
      <button
        onClick={() => go(view, new Date())}
        className="border border-neutral-300 text-xs px-3 py-1 rounded-sm hover:bg-neutral-50 transition-colors"
      >
        Heute
      </button>
      <div className="flex items-center">
        <button
          onClick={() => go(view, shiftAnchor(view, anchor, -1))}
          aria-label="Zurück"
          className="px-2 py-1 text-navy-800 hover:bg-neutral-100 rounded-sm transition-colors"
        >
          ‹
        </button>
        <button
          onClick={() => go(view, shiftAnchor(view, anchor, 1))}
          aria-label="Weiter"
          className="px-2 py-1 text-navy-800 hover:bg-neutral-100 rounded-sm transition-colors"
        >
          ›
        </button>
      </div>
      <span className="text-sm font-medium text-navy-800 ml-2">
        {formatRangeLabel(view, anchor)}
      </span>

      <div className="ml-auto flex border border-neutral-300 rounded-sm overflow-hidden">
        {(['month', 'week', 'day'] as ViewMode[]).map((v) => (
          <button
            key={v}
            onClick={() => go(v, anchor)}
            className={`text-xs px-3 py-1 border-r border-neutral-300 last:border-r-0 transition-colors ${
              view === v ? 'bg-cream text-navy-800 font-medium' : 'bg-white text-neutral-700 hover:bg-neutral-50'
            }`}
          >
            {v === 'day' ? 'Tag' : v === 'week' ? 'Woche' : 'Monat'}
          </button>
        ))}
      </div>
    </div>
  );
}
