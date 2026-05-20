import { addDays, startOfWeek, isSameDay } from 'date-fns';
import Link from 'next/link';
import type { Instructor, ReservationRow } from '@/lib/types';
import { DAY_START_HOUR, DAY_END_HOUR, HOURS_VISIBLE, DOW_LABELS, eventClasses, formatLocal, getLocalParts, shortenName } from '@/lib/calendar';

export type AvailabilityRow = {
  id: string;
  instructor_id: string;
  starts_at: string;
  ends_at: string;
  available: boolean;
  note: string | null;
};

export function InstructorView({
  anchor,
  instructor,
  reservations,
  availability,
  myUserId,
}: {
  anchor: Date;
  instructor: Instructor | null;
  reservations: ReservationRow[];
  availability: AvailabilityRow[];
  myUserId: string;
}) {
  const wkStart = startOfWeek(anchor, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }).map((_, i) => addDays(wkStart, i));
  const today = new Date();
  const HOUR_PX = 36;

  if (!instructor) {
    return (
      <div className="p-10 text-center text-neutral-500">
        Wähle einen Fluglehrer in der Seitenleiste.
      </div>
    );
  }

  // Build availability lookup by day
  const availByDay = new Map<string, AvailabilityRow[]>();
  for (const a of availability) {
    const startKey = formatLocal(a.starts_at, 'yyyy-MM-dd');
    const endKey   = formatLocal(a.ends_at,   'yyyy-MM-dd');
    if (startKey === endKey) {
      if (!availByDay.has(startKey)) availByDay.set(startKey, []);
      availByDay.get(startKey)!.push(a);
    } else {
      for (const d of days) {
        const k = formatLocal(d, 'yyyy-MM-dd');
        if (k >= startKey && k <= endKey) {
          if (!availByDay.has(k)) availByDay.set(k, []);
          availByDay.get(k)!.push(a);
        }
      }
    }
  }

  // Bucket reservations per day (instructor's bookings only)
  const evByDay = new Map<string, ReservationRow[]>();
  for (const r of reservations) {
    if (r.instructor_id !== instructor.id) continue;
    const startKey = formatLocal(r.starts_at, 'yyyy-MM-dd');
    const endKey   = formatLocal(r.ends_at,   'yyyy-MM-dd');
    if (startKey === endKey) {
      if (!evByDay.has(startKey)) evByDay.set(startKey, []);
      evByDay.get(startKey)!.push(r);
    } else {
      for (const d of days) {
        const k = formatLocal(d, 'yyyy-MM-dd');
        if (k >= startKey && k <= endKey) {
          if (!evByDay.has(k)) evByDay.set(k, []);
          evByDay.get(k)!.push(r);
        }
      }
    }
  }

  function hoursPx(h: number): number {
    return (h - DAY_START_HOUR) * HOUR_PX;
  }

  function clipHours(start: string, end: string, dayKey: string): { startH: number; endH: number } | null {
    const startKey = formatLocal(start, 'yyyy-MM-dd');
    const endKey   = formatLocal(end,   'yyyy-MM-dd');
    const startParts = getLocalParts(start);
    const endParts   = getLocalParts(end);
    const startH = startKey === dayKey ? startParts.hour + startParts.minute / 60 : DAY_START_HOUR;
    const endH   = endKey   === dayKey ? endParts.hour   + endParts.minute   / 60 : DAY_END_HOUR;
    const clippedStart = Math.max(startH, DAY_START_HOUR);
    const clippedEnd   = Math.min(endH,   DAY_END_HOUR);
    if (clippedEnd <= clippedStart) return null;
    return { startH: clippedStart, endH: clippedEnd };
  }

  return (
    <div className="overflow-x-auto">
      <div
        className="grid border-t border-neutral-200"
        style={{ gridTemplateColumns: `52px repeat(7, minmax(120px, 1fr))` }}
      >
        {/* Header row */}
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

        {/* Hour rows. The day columns get filled with "not available" hatched pattern
            as background, with available bands as a lighter green wash inside. */}
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
              {days.map((d) => {
                const dKey = formatLocal(d, 'yyyy-MM-dd');
                return (
                  <div
                    key={`cell-${d.toISOString()}-${h}`}
                    className="border-r border-b border-neutral-100 unavail-hatch"
                    style={{ height: HOUR_PX }}
                  />
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Overlay: availability bands (green wash) + reservation blocks, per day */}
      <div className="relative" style={{ marginTop: -(HOURS_VISIBLE * HOUR_PX), pointerEvents: 'none' }}>
        <div
          className="grid"
          style={{ gridTemplateColumns: `52px repeat(7, minmax(120px, 1fr))` }}
        >
          <div />
          {days.map((d) => {
            const dKey = formatLocal(d, 'yyyy-MM-dd');
            const avSlots = availByDay.get(dKey) ?? [];
            const evs = evByDay.get(dKey) ?? [];
            return (
              <div key={dKey} className="relative" style={{ height: HOURS_VISIBLE * HOUR_PX }}>
                {/* Availability bands behind reservations */}
                {avSlots.map((a) => {
                  if (!a.available) return null;
                  const c = clipHours(a.starts_at, a.ends_at, dKey);
                  if (!c) return null;
                  const topPx = hoursPx(c.startH);
                  const heightPx = (c.endH - c.startH) * HOUR_PX;
                  return (
                    <Link
                      key={`av-${a.id}-${dKey}`}
                      href={`/reservations/new?date=${dKey}&hour=${Math.floor(c.startH)}&purpose=schulung&instructor=${instructor.id}`}
                      className="absolute left-0.5 right-0.5 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                      style={{ top: topPx, height: heightPx, pointerEvents: 'auto' }}
                      title={`${instructor.display_name} ist verfügbar · ${formatLocal(a.starts_at, 'HH:mm')}–${formatLocal(a.ends_at, 'HH:mm')}${a.note ? ` · ${a.note}` : ''}`}
                    >
                      <span className="block text-[9px] text-emerald-800 px-1 py-0.5">
                        Verfügbar
                      </span>
                    </Link>
                  );
                })}

                {/* Existing schulung reservations for this instructor */}
                {evs.map((r) => {
                  const c = clipHours(r.starts_at, r.ends_at, dKey);
                  if (!c) return null;
                  const topPx = hoursPx(c.startH);
                  const heightPx = (c.endH - c.startH) * HOUR_PX;
                  const isMine = r.pilot_id === myUserId;
                  return (
                    <Link
                      key={r.id}
                      href={`/reservations/${r.id}`}
                      className={`absolute left-0.5 right-0.5 rounded-sm px-1.5 py-0.5 text-[9px] leading-tight overflow-hidden flex flex-col ${eventClasses(r.purpose, isMine)}`}
                      style={{ top: topPx, height: heightPx, pointerEvents: 'auto' }}
                      title={`${formatLocal(r.starts_at, 'HH:mm')}–${formatLocal(r.ends_at, 'HH:mm')}\nPilot: ${isMine ? `${r.pilot_name} (du)` : r.pilot_name}\nFlugzeug: ${r.registration}${r.remarks ? `\n${r.remarks}` : ''}`}
                    >
                      <div className="font-medium truncate">
                        {isMine ? `${shortenName(r.pilot_name).short} (du)` : shortenName(r.pilot_name).short}
                      </div>
                      <div className="font-mono opacity-90 truncate">{r.registration}</div>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        .unavail-hatch {
          background-image: repeating-linear-gradient(135deg, #F0EFE8 0, #F0EFE8 4px, #E5E4DE 4px, #E5E4DE 5px);
        }
      `}</style>
    </div>
  );
}
