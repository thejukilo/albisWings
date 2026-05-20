import { format, startOfMonth, startOfWeek, addDays, isSameDay, isSameMonth, getMonth } from 'date-fns';
import Link from 'next/link';
import type { ReservationRow } from '@/lib/types';
import { DOW_LABELS, eventClasses } from '@/lib/calendar';

export function MonthView({
  anchor,
  reservations,
  myUserId,
}: {
  anchor: Date;
  reservations: ReservationRow[];
  myUserId: string;
}) {
  const moStart = startOfMonth(anchor);
  const gridStart = startOfWeek(moStart, { weekStartsOn: 1 });
  const cells = Array.from({ length: 42 }).map((_, i) => addDays(gridStart, i));
  const today = new Date();

  // Bucket events by day
  const byDay = new Map<string, ReservationRow[]>();
  for (const r of reservations) {
    const dKey = format(new Date(r.starts_at), 'yyyy-MM-dd');
    if (!byDay.has(dKey)) byDay.set(dKey, []);
    byDay.get(dKey)!.push(r);
  }

  return (
    <div className="flex flex-col">
      {/* DOW headers */}
      <div className="grid grid-cols-7 border-b border-neutral-200 bg-neutral-50">
        {DOW_LABELS.map((d) => (
          <div key={d} className="px-3 py-2 text-[10px] uppercase tracking-wider text-neutral-500">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 grid-rows-6 flex-1">
        {cells.map((d) => {
          const dKey = format(d, 'yyyy-MM-dd');
          const evs = byDay.get(dKey) ?? [];
          const isCurMonth = isSameMonth(d, anchor);
          const isToday = isSameDay(d, today);
          const visible = evs.slice(0, 3);
          const overflow = evs.length - visible.length;
          return (
            <Link
              key={dKey}
              href={`/reservations?view=day&date=${dKey}`}
              className={`min-h-[88px] border-r border-b border-neutral-100 p-1.5 flex flex-col gap-1 transition-colors ${
                isCurMonth ? 'bg-white hover:bg-cream-50' : 'bg-neutral-50 text-neutral-400 hover:bg-neutral-100'
              } ${isToday ? 'bg-cream-50' : ''}`}
            >
              <span className={`text-xs font-medium ${isToday ? 'text-signal-600' : ''}`}>
                {format(d, 'd')}
              </span>
              {visible.map((r) => {
                const isMine = r.pilot_id === myUserId;
                return (
                  <div
                    key={r.id}
                    className={`text-[9px] px-1.5 py-0.5 rounded truncate ${eventClasses(r.purpose, isMine)}`}
                  >
                    <span className="font-mono">{r.registration}</span>
                    {' · '}
                    <span>{isMine ? `${r.pilot_name} (du)` : r.pilot_name}</span>
                  </div>
                );
              })}
              {overflow > 0 && (
                <div className="text-[9px] text-neutral-500 px-1.5">+{overflow} weitere</div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
