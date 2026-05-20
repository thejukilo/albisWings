'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useTransition } from 'react';
import type { Aircraft, Instructor } from '@/lib/types';
import { aircraftTint } from '@/lib/calendar';

export function CalendarSidebar({
  aircraft,
  instructors,
  selectedAircraft,
  schulungInstructorId,
  myUserId,
  isInstructor,
}: {
  aircraft: Aircraft[];
  instructors: Instructor[];
  selectedAircraft: Set<string>;
  schulungInstructorId: string | null;
  myUserId: string;
  isInstructor: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [, startTransition] = useTransition();

  function updateAircraftFilter(values: Set<string>) {
    const next = new URLSearchParams(sp.toString());
    if (values.size === aircraft.length || values.size === 0) next.delete('ac');
    else next.set('ac', Array.from(values).join(','));
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  function toggleAircraft(id: string) {
    const next = new Set(selectedAircraft);
    if (next.has(id)) next.delete(id); else next.add(id);
    updateAircraftFilter(next);
  }

  const allAircraftOn = selectedAircraft.size === aircraft.length || selectedAircraft.size === 0;
  const schulungMode = schulungInstructorId !== null;
  const activeInstructor = instructors.find(i => i.id === schulungInstructorId) ?? null;

  return (
    <aside className="border-r border-neutral-200 bg-neutral-50 p-4 text-sm space-y-6 w-[200px] flex-shrink-0">
      <div>
        <h3 className="text-[11px] uppercase tracking-wider text-neutral-500 font-medium mb-2">Flugzeuge</h3>
        <ul className="space-y-0.5">
          {aircraft.map((a, idx) => {
            const on = allAircraftOn || selectedAircraft.has(a.id);
            const tint = aircraftTint(idx);
            return (
              <li key={a.id}>
                <label className="flex items-center gap-2 px-1.5 py-1 rounded-sm cursor-pointer hover:bg-neutral-100">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggleAircraft(a.id)}
                    className="accent-navy-800"
                  />
                  <span className={`inline-block w-3 h-3 rounded-sm ${tint.chip}`} />
                  <span className="text-navy-800 font-mono text-xs">{a.registration}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>

      {schulungMode && activeInstructor && (
        <div className="pt-4 border-t border-neutral-200">
          <h3 className="text-[11px] uppercase tracking-wider text-neutral-500 font-medium mb-2">Schulung-Modus</h3>
          <p className="text-[11px] text-navy-800 leading-snug">
            Mit <strong>{activeInstructor.display_name}</strong>.
          </p>
          <p className="text-[10px] text-neutral-500 leading-tight mt-2">
            Rot markierte Stunden = Lehrer ist schon gebucht.
          </p>
        </div>
      )}

      <div className="pt-4 border-t border-neutral-200">
        <h3 className="text-[11px] uppercase tracking-wider text-neutral-500 font-medium mb-2">Legende</h3>
        <ul className="space-y-1 text-[11px] text-neutral-700">
          <li><span className="inline-block w-3 h-2.5 bg-sky-700 align-middle mr-2"></span>Schulung (eigene)</li>
          <li><span className="inline-block w-3 h-2.5 bg-sky-300 align-middle mr-2"></span>Schulung (andere)</li>
          <li><span className="inline-block w-3 h-2.5 bg-emerald-700 align-middle mr-2"></span>Privat (eigene)</li>
          <li><span className="inline-block w-3 h-2.5 bg-emerald-300 align-middle mr-2"></span>Privat (andere)</li>
          <li><span className="inline-block w-3 h-2.5 bg-red-700 align-middle mr-2"></span>Maintenance</li>
          {isInstructor && (
            <li>
              <span className="inline-block w-3 h-2.5 bg-navy-800 align-middle mr-2"></span>
              Sie als Fluglehrer
            </li>
          )}
          {schulungMode && (
            <li>
              <span
                className="inline-block w-3 h-2.5 align-middle mr-2"
                style={{ background: 'rgba(220, 38, 38, 0.32)' }}
              />
              Lehrer anderswo belegt
            </li>
          )}
        </ul>
      </div>
    </aside>
  );
}
