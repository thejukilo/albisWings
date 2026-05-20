'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useTransition } from 'react';
import type { Aircraft, Instructor } from '@/lib/types';

export function CalendarSidebar({
  aircraft,
  instructors,
  selectedAircraft,
  selectedInstructors,
  myUserId,
}: {
  aircraft: Aircraft[];
  instructors: Instructor[];
  selectedAircraft: Set<string>;
  selectedInstructors: Set<string>;
  myUserId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [, startTransition] = useTransition();

  function updateParam(key: string, values: Set<string>, allValues: string[]) {
    const next = new URLSearchParams(sp.toString());
    // If everything is selected, drop the param to keep URLs short.
    if (values.size === allValues.length || values.size === 0) {
      next.delete(key);
    } else {
      next.set(key, Array.from(values).join(','));
    }
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  function toggleAircraft(id: string) {
    const next = new Set(selectedAircraft);
    if (next.has(id)) next.delete(id); else next.add(id);
    updateParam('ac', next, aircraft.map(a => a.id));
  }

  function toggleInstructor(id: string) {
    const next = new Set(selectedInstructors);
    if (next.has(id)) next.delete(id); else next.add(id);
    updateParam('fi', next, instructors.map(i => i.id));
  }

  const allAircraftOn   = selectedAircraft.size === aircraft.length || selectedAircraft.size === 0;
  const noInstructorFilter = selectedInstructors.size === 0 || selectedInstructors.size === instructors.length;

  return (
    <aside className="border-r border-neutral-200 bg-neutral-50 p-4 text-sm space-y-6 w-[200px] flex-shrink-0">
      <div>
        <h3 className="text-[11px] uppercase tracking-wider text-neutral-500 font-medium mb-2">Flugzeuge</h3>
        <ul className="space-y-0.5">
          {aircraft.map((a) => {
            const on = allAircraftOn || selectedAircraft.has(a.id);
            return (
              <li key={a.id}>
                <label className="flex items-center gap-2 px-1.5 py-1 rounded-sm cursor-pointer hover:bg-neutral-100">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggleAircraft(a.id)}
                    className="accent-navy-800"
                  />
                  <span className="text-navy-800 font-mono text-xs">{a.registration}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <h3 className="text-[11px] uppercase tracking-wider text-neutral-500 font-medium mb-2">Fluglehrer</h3>
        <ul className="space-y-0.5">
          {instructors.map((i) => {
            const on = !noInstructorFilter && selectedInstructors.has(i.id);
            return (
              <li key={i.id}>
                <label className={`flex items-center gap-2 px-1.5 py-1 rounded-sm cursor-pointer hover:bg-neutral-100 ${on ? 'bg-navy-800 text-cream' : ''}`}>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggleInstructor(i.id)}
                    className="accent-cream"
                  />
                  <span className="text-xs">{i.display_name}</span>
                </label>
              </li>
            );
          })}
        </ul>
        {!noInstructorFilter && (
          <p className="text-[10px] text-neutral-500 mt-2 leading-tight">
            Filter aktiv: nur Reservationen mit gewähltem Lehrer
          </p>
        )}
      </div>

      <div className="pt-4 border-t border-neutral-200">
        <h3 className="text-[11px] uppercase tracking-wider text-neutral-500 font-medium mb-2">Legende</h3>
        <ul className="space-y-1 text-[11px] text-neutral-700">
          <li><span className="inline-block w-3 h-2.5 bg-sky-700 align-middle mr-2"></span>Schulung (eigene)</li>
          <li><span className="inline-block w-3 h-2.5 bg-sky-300 align-middle mr-2"></span>Schulung (andere)</li>
          <li><span className="inline-block w-3 h-2.5 bg-emerald-700 align-middle mr-2"></span>Privat (eigene)</li>
          <li><span className="inline-block w-3 h-2.5 bg-emerald-300 align-middle mr-2"></span>Privat (andere)</li>
          <li><span className="inline-block w-3 h-2.5 bg-red-700 align-middle mr-2"></span>Maintenance</li>
        </ul>
      </div>
    </aside>
  );
}
