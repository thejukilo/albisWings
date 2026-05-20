'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useTransition } from 'react';
import type { Aircraft, Instructor } from '@/lib/types';
import { aircraftTint } from '@/lib/calendar';
import type { CalendarMode } from '@/components/ModeToggle';

export function CalendarSidebar({
  mode,
  aircraft,
  instructors,
  selectedAircraft,
  selectedInstructorId,
  myUserId,
}: {
  mode: CalendarMode;
  aircraft: Aircraft[];
  instructors: Instructor[];
  selectedAircraft: Set<string>;
  selectedInstructorId: string | null;
  myUserId: string;
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

  function setInstructor(id: string | null) {
    const next = new URLSearchParams(sp.toString());
    if (id) next.set('fi', id); else next.delete('fi');
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  function toggleAircraft(id: string) {
    const next = new Set(selectedAircraft);
    if (next.has(id)) next.delete(id); else next.add(id);
    updateAircraftFilter(next);
  }

  const allAircraftOn = selectedAircraft.size === aircraft.length || selectedAircraft.size === 0;

  return (
    <aside className="border-r border-neutral-200 bg-neutral-50 p-4 text-sm space-y-6 w-[200px] flex-shrink-0">
      {mode === 'flugzeug' ? (
        <>
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
        </>
      ) : (
        <>
          <div>
            <h3 className="text-[11px] uppercase tracking-wider text-neutral-500 font-medium mb-2">Fluglehrer</h3>
            <ul className="space-y-0.5">
              {instructors.map((i) => {
                const on = selectedInstructorId === i.id;
                return (
                  <li key={i.id}>
                    <button
                      onClick={() => setInstructor(on ? null : i.id)}
                      className={`w-full text-left flex items-center gap-2 px-1.5 py-1 rounded-sm hover:bg-neutral-100 transition-colors ${
                        on ? 'bg-navy-800 text-cream' : 'text-navy-800'
                      }`}
                    >
                      <span className={`inline-block w-2 h-2 rounded-full ${on ? 'bg-cream' : 'bg-neutral-300'}`} />
                      <span className="text-xs">{i.display_name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {!selectedInstructorId && (
              <p className="text-[10px] text-neutral-500 mt-3 leading-tight">
                Wähle einen Fluglehrer, um seine Verfügbarkeit zu sehen.
              </p>
            )}
          </div>

          <div className="pt-4 border-t border-neutral-200">
            <h3 className="text-[11px] uppercase tracking-wider text-neutral-500 font-medium mb-2">Legende</h3>
            <ul className="space-y-1 text-[11px] text-neutral-700">
              <li>
                <span className="inline-block w-3 h-2.5 bg-emerald-50 border border-emerald-200 align-middle mr-2"></span>
                Verfügbar
              </li>
              <li>
                <span
                  className="inline-block w-3 h-2.5 align-middle mr-2"
                  style={{ backgroundImage: 'repeating-linear-gradient(135deg,#F0EFE8 0,#F0EFE8 2px,#E5E4DE 2px,#E5E4DE 3px)' }}
                />
                Nicht verfügbar
              </li>
              <li><span className="inline-block w-3 h-2.5 bg-sky-300 align-middle mr-2"></span>Bestehende Schulung</li>
            </ul>
          </div>
        </>
      )}
    </aside>
  );
}
