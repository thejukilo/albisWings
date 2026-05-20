import { startOfWeek, addDays, addMonths, startOfMonth, endOfMonth, startOfDay, endOfDay, getDay, format } from 'date-fns';
import { de } from 'date-fns/locale';

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

export function isoDow(d: Date): number {
  // Monday = 0, Sunday = 6
  const js = getDay(d); // Sun=0..Sat=6
  return (js + 6) % 7;
}
