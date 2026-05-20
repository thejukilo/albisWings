import { format, addDays, startOfWeek, isSameDay } from 'date-fns';
import { de } from 'date-fns/locale';
import Link from 'next/link';
import type { ReservationRow } from '@/lib/types';
import { DAY_START_HOUR, DAY_END_HOUR, HOURS_VISIBLE, DOW_LABELS, eventClasses } from '@/lib/calendar';

export function WeekView({
  anchor,
  reservations,
  myUserId,
}: {
  anchor: Date;
  reservations: ReservationRow[];
  myUserId: string;
}) {
  const wkStart = startOfWeek(anchor, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }).map((_, i) => addDays(wkStart, i));
  const today = new Date();

  // Bucket events by day
  const byDay = new Map<string, ReservationRow[]>();
  for (const r of reservations) {
    const dKey = format(new Date(r.starts_at), 'yyyy-MM-dd');
    if (!byDay.has(dKey)) byDay.set(dKey, []);
    byDay.get(dKey)!.push(r);
  }

  const HOUR_PX = 38;

  return (
    <div className="overflow-x-auto">
      <div
        className="grid border-t border-neutral-200"
        style={{ gridTemplateColumns: `60px repeat(7, minmax(120px, 1fr))` }}
      >
        {/* Day headers */}
        <div className="bg-neutral-50 border-b border-r border-neutral-200" />
        {days.map((d, i) => {
          const isToday = isSameDay(d, today);
          return (
            <div
              key={d.toISOString()}
              className={`bg-white border-b border-r border-neutral-200 py-2 text-center ${
                isToday ? 'bg-cream-50' : ''
              }`}
            >
              <div className="text-[10px] uppercase tracking-wider text-neutral-500">{DOW_LABELS[i]}</div>
              <div className={`text-lg font-medium ${isToday ? 'text-signal-600' : 'text-navy-800'}`}>
                {format(d, 'd', { locale: de })}
              </div>
            </div>
          );
        })}

        {/* Hour rows */}
        {Array.from({ length: HOURS_VISIBLE }).map((_, h) => {
          const hour = DAY_START_HOUR + h;
          return (
            <div key={`row-${h}`} className="contents">
              <div
                className="text-[10px] text-neutral-500 font-mono text-right pr-2 pt-0.5 border-r border-neutral-200 bg-neutral-50"
                style={{ height: HOUR_PX }}
              >
                {hour.toString().padStart(2, '0')}:00
              </div>
              {days.map((d) => (
                <Link
                  key={`cell-${d.toISOString()}-${h}`}
                  href={`/reservations/new?date=${format(d, 'yyyy-MM-dd')}&hour=${hour}`}
                  className="border-r border-b border-neutral-100 relative hover:bg-cream/40 transition-colors"
                  style={{ height: HOUR_PX }}
                  aria-label={`Neue Reservation ${format(d, 'dd.MM.')} ${hour}:00`}
                />
              ))}
            </div>
          );
        })}
      </div>

      {/* Overlay events per day column */}
      <div className="relative" style={{ marginTop: -(HOURS_VISIBLE * HOUR_PX), pointerEvents: 'none' }}>
        <div
          className="grid"
          style={{ gridTemplateColumns: `60px repeat(7, minmax(120px, 1fr))` }}
        >
          <div />
          {days.map((d) => {
            const dKey = format(d, 'yyyy-MM-dd');
            const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), DAY_START_HOUR).getTime();
            const dayEnd   = new Date(d.getFullYear(), d.getMonth(), d.getDate(), DAY_END_HOUR).getTime();
            const evs = byDay.get(dKey) ?? [];
            return (
              <div key={dKey} className="relative" style={{ height: HOURS_VISIBLE * HOUR_PX }}>
                {evs.map((r) => {
                  const startMs = new Date(r.starts_at).getTime();
                  const endMs   = new Date(r.ends_at).getTime();
                  const clippedStart = Math.max(startMs, dayStart);
                  const clippedEnd   = Math.min(endMs, dayEnd);
                  if (clippedEnd <= clippedStart) return null;
                  const topPx    = ((clippedStart - dayStart) / 3_600_000) * HOUR_PX;
                  const heightPx = ((clippedEnd - clippedStart) / 3_600_000) * HOUR_PX;
                  const isMine = r.pilot_id === myUserId;
                  return (
                    <Link
                      key={r.id}
                      href={`/reservations/${r.id}`}
                      className={`absolute left-0.5 right-0.5 rounded px-1.5 py-0.5 text-[9px] leading-tight overflow-hidden ${eventClasses(r.purpose, isMine)}`}
                      style={{ top: topPx, height: heightPx, pointerEvents: 'auto' }}
                    >
                      <div className="font-mono font-medium truncate">{r.registration}</div>
                      <div className="truncate">{isMine ? `${r.pilot_name} (du)` : r.pilot_name}</div>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
