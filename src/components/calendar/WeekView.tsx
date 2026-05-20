import { addDays, startOfWeek, isSameDay } from 'date-fns';
import Link from 'next/link';
import type { Aircraft, ReservationRow } from '@/lib/types';
import { DAY_START_HOUR, DAY_END_HOUR, HOURS_VISIBLE, DOW_LABELS, eventClasses, formatLocal, getLocalParts, aircraftTint, shortenName } from '@/lib/calendar';

export function WeekView({
  anchor,
  aircraft,
  selectedAircraftIds,
  reservations,
  myUserId,
  schulungInstructorId,
  aogAircraftIds,
}: {
  anchor: Date;
  aircraft: Aircraft[];
  selectedAircraftIds: Set<string>;
  reservations: ReservationRow[];
  myUserId: string;
  /** When set, Schulung-Modus is on for this instructor. */
  schulungInstructorId: string | null;
  /** Aircraft IDs currently AOG (any open Flight Relevant techlog entry). */
  aogAircraftIds: Set<string>;
}) {
  const wkStart = startOfWeek(anchor, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }).map((_, i) => addDays(wkStart, i));
  const today = new Date();

  const visibleAircraft = aircraft.filter(a => selectedAircraftIds.size === 0 || selectedAircraftIds.has(a.id));
  const acIndexById = new Map(aircraft.map((a, i) => [a.id, i]));

  // Pre-compute the instructor's already-booked windows per day.
  const instructorBookedByDay = new Map<string, { start: number; end: number }[]>();
  if (schulungInstructorId) {
    for (const r of reservations) {
      if (r.instructor_id !== schulungInstructorId) continue;
      const startKey = formatLocal(r.starts_at, 'yyyy-MM-dd');
      const endKey   = formatLocal(r.ends_at,   'yyyy-MM-dd');
      for (const d of days) {
        const k = formatLocal(d, 'yyyy-MM-dd');
        if (k < startKey || k > endKey) continue;
        const startParts = getLocalParts(r.starts_at);
        const endParts   = getLocalParts(r.ends_at);
        const startH = startKey === k ? startParts.hour + startParts.minute / 60 : DAY_START_HOUR;
        const endH   = endKey   === k ? endParts.hour   + endParts.minute   / 60 : DAY_END_HOUR;
        if (!instructorBookedByDay.has(k)) instructorBookedByDay.set(k, []);
        instructorBookedByDay.get(k)!.push({ start: startH, end: endH });
      }
    }
  }

  // Reservations bucketed per day (all aircraft, for the foreground blocks)
  const byDay = new Map<string, ReservationRow[]>();
  for (const r of reservations) {
    if (selectedAircraftIds.size !== 0 && !selectedAircraftIds.has(r.aircraft_id)) continue;
    const startKey = formatLocal(r.starts_at, 'yyyy-MM-dd');
    const endKey   = formatLocal(r.ends_at,   'yyyy-MM-dd');
    if (startKey === endKey) {
      if (!byDay.has(startKey)) byDay.set(startKey, []);
      byDay.get(startKey)!.push(r);
    } else {
      for (const d of days) {
        const k = formatLocal(d, 'yyyy-MM-dd');
        if (k >= startKey && k <= endKey) {
          if (!byDay.has(k)) byDay.set(k, []);
          byDay.get(k)!.push(r);
        }
      }
    }
  }

  function aircraftBookedAt(aircraftId: string, dayKey: string, hour: number): boolean {
    const evs = byDay.get(dayKey) ?? [];
    for (const r of evs) {
      if (r.aircraft_id !== aircraftId) continue;
      const startKey = formatLocal(r.starts_at, 'yyyy-MM-dd');
      const endKey   = formatLocal(r.ends_at,   'yyyy-MM-dd');
      const startParts = getLocalParts(r.starts_at);
      const endParts   = getLocalParts(r.ends_at);
      const startH = startKey === dayKey ? startParts.hour + startParts.minute / 60 : DAY_START_HOUR;
      const endH   = endKey   === dayKey ? endParts.hour   + endParts.minute   / 60 : DAY_END_HOUR;
      if (hour >= startH && hour < endH) return true;
    }
    return false;
  }

  function instructorBookedAt(dayKey: string, hour: number): boolean {
    const windows = instructorBookedByDay.get(dayKey) ?? [];
    return windows.some(w => hour >= w.start && hour < w.end);
  }

  const HOUR_PX = 36;
  const N = visibleAircraft.length;
  if (N === 0) {
    return (
      <div className="p-10 text-center text-neutral-500">
        Keine Flugzeuge ausgewählt — bitte mindestens eines in der Seitenleiste anklicken.
      </div>
    );
  }

  const schulungMode = schulungInstructorId !== null;

  return (
    <div className="overflow-x-auto">
      <div
        className="grid border-t border-neutral-200"
        style={{ gridTemplateColumns: `48px repeat(7, minmax(${N * 32}px, 1fr))` }}
      >
        {/* Header */}
        <div className="bg-neutral-50 border-b border-r border-neutral-200" />
        {days.map((d, i) => {
          const isToday = isSameDay(d, today);
          return (
            <div
              key={d.toISOString()}
              className={`border-b border-r-[1.5px] border-neutral-200 border-r-neutral-300 ${isToday ? 'bg-cream-50' : 'bg-white'}`}
            >
              <div className="text-center pt-1 pb-0.5">
                <div className="text-[10px] uppercase tracking-wider text-neutral-500">{DOW_LABELS[i]}</div>
                <div className={`text-lg font-medium leading-tight ${isToday ? 'text-signal-600' : 'text-navy-800'}`}>
                  {formatLocal(d, 'd')}
                </div>
              </div>
              <div className="grid border-t border-neutral-100" style={{ gridTemplateColumns: `repeat(${N}, 1fr)` }}>
                {visibleAircraft.map((a) => {
                  const tint = aircraftTint(acIndexById.get(a.id) ?? 0);
                  const isAog = aogAircraftIds.has(a.id);
                  return (
                    <div
                      key={a.id}
                      className={`text-center py-1 text-[10px] font-mono border-r border-neutral-100 last:border-r-0 ${
                        isAog ? 'bg-red-700 text-white font-bold' : `text-navy-800 ${tint.bg}`
                      }`}
                      title={isAog ? `${a.registration} ist AOG — keine Reservation möglich` : a.registration}
                    >
                      {isAog ? <>⚠ AOG</> : a.registration.replace('HB-', '')}
                    </div>
                  );
                })}
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
              {days.map((d) => {
                const dKey = formatLocal(d, 'yyyy-MM-dd');
                const instructorBusy = schulungMode && instructorBookedAt(dKey, hour);
                return (
                  <div
                    key={`day-${dKey}-${h}`}
                    className="border-r-[1.5px] border-r-neutral-300 border-b border-b-neutral-100 grid relative"
                    style={{ gridTemplateColumns: `repeat(${N}, 1fr)`, height: HOUR_PX }}
                  >
                    {visibleAircraft.map((a) => {
                      const tint = aircraftTint(acIndexById.get(a.id) ?? 0);
                      const isAog = aogAircraftIds.has(a.id);
                      const href = schulungMode
                        ? `/reservations/new?aircraft=${a.id}&date=${dKey}&hour=${hour}&purpose=schulung&instructor=${schulungInstructorId}`
                        : `/reservations/new?aircraft=${a.id}&date=${dKey}&hour=${hour}`;
                      if (isAog) {
                        return (
                          <div
                            key={`cell-${a.id}-${dKey}-${h}`}
                            className="aog-cell border-r border-r-white/40 last:border-r-0"
                            title={`${a.registration} ist AOG — keine Reservation möglich`}
                          />
                        );
                      }
                      return (
                        <Link
                          key={`cell-${a.id}-${dKey}-${h}`}
                          href={href}
                          className={`${tint.bg} border-r border-r-white/40 last:border-r-0 hover:brightness-95 transition-all relative ${
                            instructorBusy ? 'instructor-busy' : ''
                          }`}
                          aria-label={`${a.registration} ${formatLocal(d, 'dd.MM.')} ${hour}:00`}
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Overlay: existing reservation blocks */}
      <div className="relative" style={{ marginTop: -(HOURS_VISIBLE * HOUR_PX), pointerEvents: 'none' }}>
        <div className="grid" style={{ gridTemplateColumns: `48px repeat(7, minmax(${N * 32}px, 1fr))` }}>
          <div />
          {days.map((d) => {
            const dKey = formatLocal(d, 'yyyy-MM-dd');
            const evs = byDay.get(dKey) ?? [];
            return (
              <div key={dKey} className="relative" style={{ height: HOURS_VISIBLE * HOUR_PX }}>
                {evs.map((r) => {
                  const acIdx = visibleAircraft.findIndex(a => a.id === r.aircraft_id);
                  if (acIdx < 0) return null;
                  const startKey = formatLocal(r.starts_at, 'yyyy-MM-dd');
                  const endKey   = formatLocal(r.ends_at,   'yyyy-MM-dd');
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
                  const leftPct  = (acIdx / N) * 100;
                  const widthPct = (1 / N) * 100;

                  return (
                    <Link
                      key={r.id}
                      href={`/reservations/${r.id}`}
                      className={`absolute rounded-sm px-1 py-0.5 text-[8px] leading-tight overflow-hidden flex flex-col ${eventClasses(r.purpose, isMine)}`}
                      style={{
                        top: topPx, height: heightPx,
                        left: `calc(${leftPct}% + 1px)`,
                        width: `calc(${widthPct}% - 2px)`,
                        pointerEvents: 'auto',
                      }}
                      title={buildTooltip(r, isMine, isUnstaffed)}
                    >
                      <div className="truncate font-medium">
                        {isUnstaffed
                          ? (r.purpose === 'maintenance' ? 'Wartung' : 'Standby')
                          : isMine ? `${pilotShort(r.pilot_name)} (du)` : pilotShort(r.pilot_name)}
                      </div>
                      {r.instructor_name && (
                        <div className={`truncate mt-auto pt-0.5 border-t border-white/25 text-[7px] -mx-1 px-1 ${
                          r.instructor_id === myUserId
                            ? 'bg-navy-800 text-cream font-semibold'
                            : 'opacity-80'
                        }`}>
                          + {shortenName(r.instructor_name).initials}
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
        .instructor-busy {
          position: relative;
        }
        .instructor-busy::before {
          content: '';
          position: absolute;
          inset: 0;
          background: rgba(220, 38, 38, 0.32);
          pointer-events: none;
        }
        .aog-cell {
          background: repeating-linear-gradient(
            -45deg,
            rgba(220, 38, 38, 0.18) 0,
            rgba(220, 38, 38, 0.18) 6px,
            rgba(220, 38, 38, 0.08) 6px,
            rgba(220, 38, 38, 0.08) 12px
          );
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}

function pilotShort(displayName: string | null): string {
  if (!displayName) return '';
  return displayName.split(/\s+/)[0];
}

function buildTooltip(r: ReservationRow, isMine: boolean, isUnstaffed: boolean): string {
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
