import { startOfWeek, addDays, addMonths, startOfMonth, endOfMonth, startOfDay, endOfDay, getDay, format } from 'date-fns';
import { de } from 'date-fns/locale';

/** Club timezone — all calendar rendering uses this regardless of server locale. */
export const CLUB_TZ = 'Europe/Zurich';

/** Format an instant in club-local time. Replaces date-fns format() for any timestamptz-derived data. */
export function formatLocal(d: Date | string, pattern: 'HH:mm' | 'yyyy-MM-dd' | 'd' | 'dd.MM.' | 'dd.MM.yyyy' | 'HH:mm dd.MM.'): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  // Build via Intl parts to get a stable answer in CLUB_TZ.
  const f = new Intl.DateTimeFormat('de-CH', {
    timeZone: CLUB_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const parts: Record<string, string> = {};
  for (const p of f.formatToParts(date)) if (p.type !== 'literal') parts[p.type] = p.value;
  const { year, month, day, hour, minute } = parts;
  switch (pattern) {
    case 'HH:mm':       return `${hour}:${minute}`;
    case 'yyyy-MM-dd':  return `${year}-${month}-${day}`;
    case 'd':           return String(parseInt(day, 10));
    case 'dd.MM.':      return `${day}.${month}.`;
    case 'dd.MM.yyyy':  return `${day}.${month}.${year}`;
    case 'HH:mm dd.MM.': return `${hour}:${minute} ${day}.${month}.`;
  }
}

/** Return Y/M/D/H/M for a date in the club timezone -- useful for positioning. */
export function getLocalParts(d: Date | string): { year: number; month: number; day: number; hour: number; minute: number } {
  const date = typeof d === 'string' ? new Date(d) : d;
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: CLUB_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const parts: Record<string, string> = {};
  for (const p of f.formatToParts(date)) if (p.type !== 'literal') parts[p.type] = p.value;
  return {
    year:   parseInt(parts.year, 10),
    month:  parseInt(parts.month, 10),
    day:    parseInt(parts.day, 10),
    hour:   parseInt(parts.hour, 10) % 24,  // Intl returns 24 instead of 0 sometimes
    minute: parseInt(parts.minute, 10),
  };
}

/** Hours-since-club-midnight for positioning event blocks on the grid. */
export function localHoursFromMidnight(d: Date | string, refDay: Date): number {
  const e = getLocalParts(d);
  const r = getLocalParts(refDay);
  // Calculate day delta (positive if e is after r's day in club-local time)
  const eDate = new Date(Date.UTC(e.year, e.month - 1, e.day));
  const rDate = new Date(Date.UTC(r.year, r.month - 1, r.day));
  const dayDelta = (eDate.getTime() - rDate.getTime()) / 86_400_000;
  return dayDelta * 24 + e.hour + e.minute / 60;
}

export type ViewMode = 'day' | 'week' | 'month';

export const DAY_START_HOUR = 6;   // 06:00
export const DAY_END_HOUR   = 22;  // until 22:00
export const HOURS_VISIBLE  = DAY_END_HOUR - DAY_START_HOUR;

export function getRangeForView(view: ViewMode, anchor: Date): { from: Date; to: Date } {
  if (view === 'day') {
    return { from: startOfDay(anchor), to: endOfDay(anchor) };
  }
  if (view === 'week') {
    const wkStart = startOfWeek(anchor, { weekStartsOn: 1 }); // Monday
    return { from: startOfDay(wkStart), to: endOfDay(addDays(wkStart, 6)) };
  }
  // month
  const moStart = startOfMonth(anchor);
  const moEnd   = endOfMonth(anchor);
  // Pad to Monday-start grid
  const gridStart = startOfWeek(moStart, { weekStartsOn: 1 });
  const gridEnd   = endOfDay(addDays(startOfWeek(moEnd, { weekStartsOn: 1 }), 41)); // 6 weeks always
  return { from: gridStart, to: gridEnd };
}

export function formatRangeLabel(view: ViewMode, anchor: Date): string {
  if (view === 'day') {
    return format(anchor, 'EEEE, dd. MMMM yyyy', { locale: de });
  }
  if (view === 'week') {
    const wkStart = startOfWeek(anchor, { weekStartsOn: 1 });
    const wkEnd   = addDays(wkStart, 6);
    return `${format(wkStart, 'dd.', { locale: de })} – ${format(wkEnd, 'dd. MMMM yyyy', { locale: de })}`;
  }
  return format(anchor, 'MMMM yyyy', { locale: de });
}

export function shiftAnchor(view: ViewMode, anchor: Date, dir: 1 | -1): Date {
  if (view === 'day')   return addDays(anchor, dir);
  if (view === 'week')  return addDays(anchor, 7 * dir);
  return addMonths(anchor, dir);
}

/** Map (purpose, isMine) to a color class pair: background, text */
export function eventClasses(purpose: string, isMine: boolean): string {
  if (purpose === 'maintenance') return 'bg-red-700 text-white';
  if (purpose === 'standby')     return 'bg-yellow-200 text-yellow-900';
  if (purpose === 'kommerziell') return 'bg-amber-500 text-amber-50';
  if (purpose === 'clubflug')    return 'bg-navy-200 text-navy-800';
  if (purpose === 'schulung')    return isMine ? 'bg-sky-700 text-white' : 'bg-sky-300 text-sky-900';
  /* privat */                   return isMine ? 'bg-emerald-700 text-white' : 'bg-emerald-300 text-emerald-900';
}

/** German short day-of-week labels Mo, Di, ... starting Monday */
export const DOW_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

/** Aircraft tint palette in fixed order. The index of an aircraft in the
 *  sorted aircraft list determines its tint. Stable across renders.
 */
const AIRCRAFT_TINTS = [
  { bg: 'bg-ac-blue',   chip: 'bg-ac-blue-strong'   },
  { bg: 'bg-ac-amber',  chip: 'bg-ac-amber-strong'  },
  { bg: 'bg-ac-purple', chip: 'bg-ac-purple-strong' },
  { bg: 'bg-ac-teal',   chip: 'bg-ac-teal-strong'   },
  { bg: 'bg-ac-pink',   chip: 'bg-ac-pink-strong'   },
  { bg: 'bg-ac-slate',  chip: 'bg-ac-slate-strong'  },
] as const;

export function aircraftTint(index: number): { bg: string; chip: string } {
  return AIRCRAFT_TINTS[index % AIRCRAFT_TINTS.length];
}

/** Short form of a "Daniel Berchtold" style display name.
 *  - "Daniel Berchtold" -> { initials: "D.B.", short: "D.Berchtold", full: "Daniel Berchtold" }
 *  - For width-adaptive rendering: very narrow -> initials, medium -> short, wide -> full.
 */
export function shortenName(name: string): { initials: string; short: string; full: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { initials: '', short: '', full: '' };
  if (parts.length === 1) return { initials: (parts[0][0] ?? '') + '.', short: parts[0], full: parts[0] };
  const first = parts[0];
  const last  = parts[parts.length - 1];
  return {
    initials: `${first[0]}.${last[0]}.`,
    short:    `${first[0]}.${last}`,
    full:     name,
  };
}

export function isoDow(d: Date): number {
  // Monday = 0, Sunday = 6
  const js = getDay(d); // Sun=0..Sat=6
  return (js + 6) % 7;
}
