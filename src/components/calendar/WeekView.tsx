import { addDays, startOfWeek, isSameDay } from 'date-fns';
import Link from 'next/link';
import type { ReservationRow } from '@/lib/types';
import { DAY_START_HOUR, DAY_END_HOUR, HOURS_VISIBLE, DOW_LABELS, eventClasses, formatLocal, getLocalParts } from '@/lib/calendar';

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

  // Bucket events by day using club-local date.
  // For multi-day reservations, register the event on every day it touches
  // so each daily column renders its slice.
  const byDay = new Map<string, ReservationRow[]>();
  for (const r of reservations) {
    const startKey = formatLocal(r.starts_at, 'yyyy-MM-dd');
    const endKey   = formatLocal(r.ends_at,   'yyyy-MM-dd');
    if (startKey === endKey) {
      if (!byDay.has(startKey)) byDay.set(startKey, []);
      byDay.get(startKey)!.push(r);
    } else {
      // Walk the days in the displayed week and add the event to each one
      // whose local date falls within [startKey, endKey].
      for (const d of days) {
        const k = formatLocal(d, 'yyyy-MM-dd');
        if (k >= startKey && k <= endKey) {
          if (!byDay.has(k)) byDay.set(k, []);
          byDay.get(k)!.push(r);
        }
      }
    }
  }

  const HOUR_PX = 38;

  return (
    <div className="overflow-x-auto">
      <div
        className="grid border-t border-neutral-200"
        style={{ gridTemplateColumns: `60px repeat(7, minmax(120px, 1fr))` }}
      >
        <div className="bg-neutral-50 border-b border-r border-neutral-200" />
        {days.map((d, i) => {
          const isToday = isSameDay(d, today);
          return (
            <div
              key={d.toISOString()}
              className={`bg-white border-b border-r border-neutral-200 py-2 text-center ${isToday ? 'bg-cream-50' : ''}`}
            >
              <div className="text-[10px] uppercase tracking-wider text-neutral-500">{DOW_LABELS[i]}</div>
              <div className={`text-lg font-medium ${isToday ? 'text-signal-600' : 'text-navy-800'}`}>
                {formatLocal(d, 'd')}
              </div>
            </div>
          );
        })}

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
                  href={`/reservations/new?date=${formatLocal(d, 'yyyy-MM-dd')}&hour=${hour}`}
                  className="border-r border-b border-neutral-100 relative hover:bg-cream/40 transition-colors"
                  style={{ height: HOUR_PX }}
                  aria-label={`Neue Reservation ${formatLocal(d, 'dd.MM.')} ${hour}:00`}
                />
              ))}
            </div>
          );
        })}
      </div>

      <div className="relative" style={{ marginTop: -(HOURS_VISIBLE * HOUR_PX), pointerEvents: 'none' }}>
        <div
          className="grid"
          style={{ gridTemplateColumns: `60px repeat(7, minmax(120px, 1fr))` }}
        >
          <div />
          {days.map((d) => {
            const dKey = formatLocal(d, 'yyyy-MM-dd');
            const evs = byDay.get(dKey) ?? [];
            return (
              <div key={dKey} className="relative" style={{ height: HOURS_VISIBLE * HOUR_PX }}>
                {evs.map((r) => {
                  const startKey = formatLocal(r.starts_at, 'yyyy-MM-dd');
                  const endKey   = formatLocal(r.ends_at,   'yyyy-MM-dd');
                  // Clip per-day: if event started before this column, treat as DAY_START_HOUR.
                  // If it continues past this column, treat as DAY_END_HOUR.
                  const startParts = getLocalParts(r.starts_at);
                  const endParts   = getLocalParts(r.ends_at);
                  const startH = startKey === dKey ? startParts.hour + startParts.minute / 60 : DAY_START_HOUR;
                  const endH   = endKey   === dKey ? endParts.hour   + endParts.minute   / 60 : DAY_END_HOUR;
                  const clippedStart = Math.max(startH, DAY_START_HOUR);
                  const clippedEnd   = Math.min(endH,   DAY_END_HOUR);
                  if (clippedEnd <= clippedStart) return null;
                  const topPx    = (clippedStart - DAY_START_HOUR) * HOUR_PX;
                  const heightPx = (clippedEnd - clippedStart) * HOUR_PX;
                  const isMine = r.pilot_id === myUserId;
                  const isUnstaffed = r.pilot_id === null;
                  return (
                    <Link
                      key={r.id}
                      href={`/reservations/${r.id}`}
                      className={`absolute left-0.5 right-0.5 rounded px-1.5 py-0.5 text-[9px] leading-tight overflow-hidden ${eventClasses(r.purpose, isMine)}`}
                      style={{ top: topPx, height: heightPx, pointerEvents: 'auto' }}
                    >
                      <div className="font-mono font-medium truncate">{r.registration}</div>
                      <div className="truncate">
                        {isUnstaffed
                          ? (r.purpose === 'maintenance' ? 'Wartung' : 'Standby')
                          : isMine ? `${r.pilot_name} (du)` : r.pilot_name}
                      </div>
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
