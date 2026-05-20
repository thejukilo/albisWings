import Link from 'next/link';
import type { Aircraft, ReservationRow } from '@/lib/types';
import { DAY_START_HOUR, DAY_END_HOUR, HOURS_VISIBLE, eventClasses, formatLocal, localHoursFromMidnight } from '@/lib/calendar';

export function DayView({
  date,
  aircraft,
  reservations,
  myUserId,
}: {
  date: Date;
  aircraft: Aircraft[];
  reservations: ReservationRow[];
  myUserId: string;
}) {
  const byAircraft = new Map<string, ReservationRow[]>();
  for (const r of reservations) {
    if (!byAircraft.has(r.aircraft_id)) byAircraft.set(r.aircraft_id, []);
    byAircraft.get(r.aircraft_id)!.push(r);
  }

  const HOUR_PX = 48;
  const dateKey = formatLocal(date, 'yyyy-MM-dd');

  return (
    <div className="overflow-x-auto">
      <div
        className="grid border-t border-neutral-200"
        style={{ gridTemplateColumns: `60px repeat(${aircraft.length}, minmax(140px, 1fr))` }}
      >
        <div className="bg-neutral-50 border-b border-r border-neutral-200" />
        {aircraft.map((a) => (
          <div key={a.id} className="bg-white border-b border-r border-neutral-200 px-3 py-2 text-center">
            <div className="inline-block bg-navy-800 text-cream font-mono text-xs px-2 py-0.5 rounded-sm">{a.registration}</div>
            <div className="text-[10px] text-neutral-500 mt-1">{a.manufacturer} {a.model}</div>
          </div>
        ))}

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
              {aircraft.map((a) => (
                <Link
                  key={`cell-${a.id}-${h}`}
                  href={`/reservations/new?aircraft=${a.id}&date=${dateKey}&hour=${hour}`}
                  className="border-r border-b border-neutral-100 relative group hover:bg-cream/40 transition-colors"
                  style={{ height: HOUR_PX }}
                  aria-label={`Neue Reservation ${a.registration} ${hour}:00`}
                />
              ))}
            </div>
          );
        })}
      </div>

      <div className="relative" style={{ marginTop: -(HOURS_VISIBLE * HOUR_PX), pointerEvents: 'none' }}>
        <div
          className="grid"
          style={{ gridTemplateColumns: `60px repeat(${aircraft.length}, minmax(140px, 1fr))` }}
        >
          <div />
          {aircraft.map((a) => {
            const evs = byAircraft.get(a.id) ?? [];
            return (
              <div key={a.id} className="relative" style={{ height: HOURS_VISIBLE * HOUR_PX }}>
                {evs.map((r) => {
                  // Position relative to club-local midnight of the displayed date.
                  const startH = localHoursFromMidnight(r.starts_at, date);
                  const endH   = localHoursFromMidnight(r.ends_at,   date);
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
                      className={`absolute left-0.5 right-0.5 rounded px-2 py-1 text-[10px] leading-tight overflow-hidden ${eventClasses(r.purpose, isMine)}`}
                      style={{ top: topPx, height: heightPx, pointerEvents: 'auto' }}
                    >
                      <div className="font-medium truncate">
                        {isUnstaffed
                          ? (r.purpose === 'maintenance' ? 'Wartung' : 'Standby')
                          : isMine ? `${r.pilot_name} (du)` : r.pilot_name}
                      </div>
                      <div className="opacity-90 truncate">{r.remarks ?? r.purpose}</div>
                      <div className="opacity-75 font-mono">
                        {formatLocal(r.starts_at, 'HH:mm')}–{formatLocal(r.ends_at, 'HH:mm')}
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
