import Link from 'next/link';
import type { Aircraft, ReservationRow } from '@/lib/types';
import { DAY_START_HOUR, DAY_END_HOUR, HOURS_VISIBLE, eventClasses, formatLocal, localHoursFromMidnight, getLocalParts, aircraftTint, shortenName } from '@/lib/calendar';

export function DayView({
  date,
  aircraft,
  reservations,
  myUserId,
  schulungInstructorId,
}: {
  date: Date;
  aircraft: Aircraft[];
  reservations: ReservationRow[];
  myUserId: string;
  schulungInstructorId: string | null;
}) {
  const byAircraft = new Map<string, ReservationRow[]>();
  for (const r of reservations) {
    if (!byAircraft.has(r.aircraft_id)) byAircraft.set(r.aircraft_id, []);
    byAircraft.get(r.aircraft_id)!.push(r);
  }

  const dKey = formatLocal(date, 'yyyy-MM-dd');
  const schulungMode = schulungInstructorId !== null;

  // Instructor's already-booked windows for this day
  const instructorBooked: { start: number; end: number }[] = [];
  if (schulungMode) {
    for (const r of reservations) {
      if (r.instructor_id !== schulungInstructorId) continue;
      const startKey = formatLocal(r.starts_at, 'yyyy-MM-dd');
      const endKey   = formatLocal(r.ends_at,   'yyyy-MM-dd');
      if (dKey < startKey || dKey > endKey) continue;
      const sp = getLocalParts(r.starts_at);
      const ep = getLocalParts(r.ends_at);
      const startH = startKey === dKey ? sp.hour + sp.minute / 60 : DAY_START_HOUR;
      const endH   = endKey   === dKey ? ep.hour + ep.minute / 60 : DAY_END_HOUR;
      instructorBooked.push({ start: startH, end: endH });
    }
  }

  function instructorBookedAt(hour: number): boolean {
    return instructorBooked.some(w => hour >= w.start && hour < w.end);
  }
  function aircraftBookedAt(aircraftId: string, hour: number): boolean {
    const evs = byAircraft.get(aircraftId) ?? [];
    for (const r of evs) {
      const startKey = formatLocal(r.starts_at, 'yyyy-MM-dd');
      const endKey   = formatLocal(r.ends_at,   'yyyy-MM-dd');
      const sp = getLocalParts(r.starts_at);
      const ep = getLocalParts(r.ends_at);
      const startH = startKey === dKey ? sp.hour + sp.minute / 60 : DAY_START_HOUR;
      const endH   = endKey   === dKey ? ep.hour + ep.minute / 60 : DAY_END_HOUR;
      if (hour >= startH && hour < endH) return true;
    }
    return false;
  }

  const HOUR_PX = 48;

  return (
    <div className="overflow-x-auto">
      <div
        className="grid border-t border-neutral-200"
        style={{ gridTemplateColumns: `60px repeat(${aircraft.length}, minmax(140px, 1fr))` }}
      >
        <div className="bg-neutral-50 border-b border-r border-neutral-200" />
        {aircraft.map((a, idx) => {
          const tint = aircraftTint(idx);
          return (
            <div key={a.id} className={`${tint.bg} border-b border-r border-neutral-200 px-3 py-2 text-center`}>
              <div className="inline-block bg-navy-800 text-cream font-mono text-xs px-2 py-0.5 rounded-sm">{a.registration}</div>
              <div className="text-[10px] text-neutral-500 mt-1">{a.manufacturer} {a.model}</div>
            </div>
          );
        })}

        {Array.from({ length: HOURS_VISIBLE }).map((_, h) => {
          const hour = DAY_START_HOUR + h;
          const instrBusy  = schulungMode && instructorBookedAt(hour);
          return (
            <div key={`row-${h}`} className="contents">
              <div
                className="text-[10px] text-neutral-500 font-mono text-right pr-2 pt-0.5 border-r border-neutral-200 bg-neutral-50"
                style={{ height: HOUR_PX }}
              >
                {hour.toString().padStart(2, '0')}:00
              </div>
              {aircraft.map((a, idx) => {
                const tint = aircraftTint(idx);
                const acBusy = aircraftBookedAt(a.id, hour);
                const bookable = schulungMode && !instrBusy && !acBusy;
                const href = bookable
                  ? `/reservations/new?aircraft=${a.id}&date=${dKey}&hour=${hour}&purpose=schulung&instructor=${schulungInstructorId}`
                  : `/reservations/new?aircraft=${a.id}&date=${dKey}&hour=${hour}`;
                return (
                  <Link
                    key={`cell-${a.id}-${h}`}
                    href={href}
                    className={`${tint.bg} border-r border-b border-neutral-100 hover:brightness-95 transition-all relative ${
                      bookable ? 'schulung-bookable' : ''
                    }`}
                    style={{ height: HOUR_PX }}
                    aria-label={`Neue Reservation ${a.registration} ${hour}:00`}
                  />
                );
              })}
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
                      className={`absolute left-0.5 right-0.5 rounded px-2 py-1 text-[10px] leading-tight overflow-hidden flex flex-col ${eventClasses(r.purpose, isMine)}`}
                      style={{ top: topPx, height: heightPx, pointerEvents: 'auto' }}
                      title={buildTooltipDay(r, isMine, isUnstaffed)}
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
                      {r.instructor_name && (
                        <div className="opacity-85 truncate mt-auto pt-0.5 border-t border-white/25 text-[9px]">
                          + {shortenName(r.instructor_name).short}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        .schulung-bookable {
          box-shadow: inset 0 0 0 2px #3B6D11;
        }
        .schulung-bookable::after {
          content: '✓';
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          font-size: 18px;
          color: #3B6D11;
          font-weight: 700;
          opacity: 0.5;
          pointer-events: none;
        }
        .schulung-bookable:hover { filter: brightness(0.92); }
      `}</style>
    </div>
  );
}

function buildTooltipDay(r: ReservationRow, isMine: boolean, isUnstaffed: boolean): string {
  const time = `${formatLocal(r.starts_at, 'HH:mm')}–${formatLocal(r.ends_at, 'HH:mm')}`;
  const date = formatLocal(r.starts_at, 'dd.MM.');
  if (isUnstaffed) {
    const label = r.purpose === 'maintenance' ? 'Wartung' : 'Standby';
    return `${r.registration} · ${date} ${time}\n${label}${r.remarks ? ` · ${r.remarks}` : ''}`;
  }
  const pilot = isMine ? `${r.pilot_name} (du)` : r.pilot_name;
  const lehrer = r.instructor_name ? ` · Lehrer: ${r.instructor_name}` : '';
  const remark = r.remarks ? `\n${r.remarks}` : '';
  return `${r.registration} · ${date} ${time}\nPilot: ${pilot}${lehrer}${remark}`;
}
