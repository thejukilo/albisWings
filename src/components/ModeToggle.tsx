'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useTransition } from 'react';
import type { Instructor } from '@/lib/types';

export function SchulungModeToggle({
  instructors,
  selectedInstructorId,
}: {
  instructors: Instructor[];
  selectedInstructorId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [, startTransition] = useTransition();

  const isOn = selectedInstructorId !== null;

  function toggleMode() {
    const next = new URLSearchParams(sp.toString());
    if (isOn) {
      next.delete('fi');
    } else if (instructors.length > 0) {
      next.set('fi', instructors[0].id);
    }
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  function setInstructor(id: string) {
    const next = new URLSearchParams(sp.toString());
    next.set('fi', id);
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  return (
    <div className="inline-flex items-center gap-2">
      <label className="flex items-center gap-2 px-3 py-1.5 border border-navy-800 rounded-sm cursor-pointer text-xs select-none transition-colors hover:bg-cream-50">
        <input
          type="checkbox"
          checked={isOn}
          onChange={toggleMode}
          className="accent-navy-800"
        />
        <span className="text-navy-800 font-medium">Schulung-Modus</span>
      </label>
      {isOn && (
        <select
          value={selectedInstructorId ?? ''}
          onChange={(e) => setInstructor(e.target.value)}
          className="text-xs px-2 py-1.5 border border-navy-800 rounded-sm bg-white text-navy-800"
        >
          {instructors.map((i) => (
            <option key={i.id} value={i.id}>{i.display_name}</option>
          ))}
        </select>
      )}
    </div>
  );
}
