'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { createReservation } from '@/app/reservations/actions';
import type { Aircraft, Instructor, PreflightFinding } from '@/lib/types';

const PURPOSES = [
  { value: 'privat',      label: 'Privat' },
  { value: 'schulung',    label: 'Schulung' },
  { value: 'kommerziell', label: 'Kommerziell' },
  { value: 'clubflug',    label: 'Clubflug' },
] as const;

export function BookingForm({
  aircraft,
  instructors,
  defaults,
}: {
  aircraft: Aircraft[];
  instructors: Instructor[];
  defaults: {
    aircraftId?: string;
    startsAt?: string;  // "YYYY-MM-DDTHH:00"
    endsAt?: string;
  };
}) {
  const router = useRouter();
  const supabase = createClient();
  const [pending, startTransition] = useTransition();

  const [aircraftId, setAircraftId] = useState(defaults.aircraftId ?? aircraft[0]?.id ?? '');
  const [startsAt,   setStartsAt]   = useState(defaults.startsAt ?? defaultStartTime());
  const [endsAt,     setEndsAt]     = useState(defaults.endsAt   ?? defaultEndTime(defaults.startsAt));
  const [purpose,    setPurpose]    = useState<string>('privat');
  const [instructorId, setInstructorId] = useState<string>('');
  const [originIcao, setOriginIcao] = useState('LSZN');
  const [destinationIcao, setDestinationIcao] = useState('LSZN');
  const [remarks, setRemarks] = useState('');

  const [findings, setFindings] = useState<PreflightFinding[]>([]);
  const [checkLoading, setCheckLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Run preflight check whenever inputs that matter change
  useEffect(() => {
    if (!aircraftId || !startsAt || !endsAt) return;
    if (new Date(endsAt) <= new Date(startsAt)) return;

    let cancelled = false;
    setCheckLoading(true);
    (async () => {
      const { data, error } = await supabase.rpc('preflight_check', {
        p_pilot_id: (await supabase.auth.getUser()).data.user?.id,
        p_aircraft_id: aircraftId,
        p_period: `[${new Date(startsAt).toISOString()},${new Date(endsAt).toISOString()})`,
        p_purpose: purpose,
        p_instructor_id: instructorId || null,
      });
      if (cancelled) return;
      setFindings(error ? [] : (data ?? []));
      setCheckLoading(false);
    })();
    return () => { cancelled = true; };
  }, [aircraftId, startsAt, endsAt, purpose, instructorId, supabase]);

  const hasBlocker = findings.some(f => f.severity === 'block');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    startTransition(async () => {
      const res = await createReservation({
        aircraftId,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        purpose,
        instructorId: instructorId || null,
        originIcao,
        destinationIcao,
        remarks,
      });
      if (res.ok) {
        router.push('/reservations');
        router.refresh();
      } else {
        setSubmitError(res.blockers.map(b => `${b.label}: ${b.detail}`).join('\n'));
      }
    });
  }

  const selectedAircraft = aircraft.find(a => a.id === aircraftId);
  const durationHours = (new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 3_600_000;

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-4 max-w-3xl">
      <FieldLabel>Flugzeug</FieldLabel>
      <div>
        <select
          value={aircraftId}
          onChange={(e) => setAircraftId(e.target.value)}
          className="px-3 py-2 border border-neutral-300 rounded-sm bg-navy-800 text-cream font-mono text-sm max-w-[160px]"
        >
          {aircraft.map((a) => (
            <option key={a.id} value={a.id}>{a.registration}</option>
          ))}
        </select>
        {selectedAircraft && (
          <p className="text-xs text-neutral-500 mt-1">
            {selectedAircraft.manufacturer} {selectedAircraft.model} · {selectedAircraft.aircraft_class}
          </p>
        )}
      </div>

      <FieldLabel>Datum &amp; Zeit</FieldLabel>
      <div className="flex flex-col gap-2 max-w-md">
        <div className="flex gap-2 items-center">
          <input
            type="datetime-local"
            value={startsAt}
            step={3600}
            onChange={(e) => setStartsAt(e.target.value)}
            className="px-3 py-2 border border-neutral-300 rounded-sm font-mono text-sm flex-1"
          />
          <span className="text-neutral-500">→</span>
          <input
            type="datetime-local"
            value={endsAt}
            step={3600}
            onChange={(e) => setEndsAt(e.target.value)}
            className="px-3 py-2 border border-neutral-300 rounded-sm font-mono text-sm flex-1"
          />
        </div>
        {durationHours > 0 && (
          <p className="text-xs text-neutral-500">Dauer: {durationHours.toFixed(0)} h</p>
        )}
      </div>

      <FieldLabel>Zweck</FieldLabel>
      <select
        value={purpose}
        onChange={(e) => setPurpose(e.target.value)}
        className="px-3 py-2 border border-neutral-300 rounded-sm text-sm max-w-[200px]"
      >
        {PURPOSES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
      </select>

      <FieldLabel>Fluglehrer</FieldLabel>
      <div>
        <select
          value={instructorId}
          onChange={(e) => setInstructorId(e.target.value)}
          className="px-3 py-2 border border-neutral-300 rounded-sm text-sm max-w-[260px]"
        >
          <option value="">— kein Lehrer —</option>
          {instructors.map((i) => (
            <option key={i.id} value={i.id}>{i.display_name}</option>
          ))}
        </select>
        <p className="text-xs text-neutral-500 mt-1">
          {purpose === 'schulung' ? 'Pflicht bei Schulung' : 'Optional'}
        </p>
      </div>

      <FieldLabel>Route</FieldLabel>
      <div className="flex gap-2 items-center max-w-md">
        <input
          value={originIcao}
          onChange={(e) => setOriginIcao(e.target.value.toUpperCase())}
          maxLength={4}
          className="px-3 py-2 border border-neutral-300 rounded-sm font-mono text-sm w-24"
          placeholder="LSZN"
        />
        <span className="text-neutral-500">→</span>
        <input
          value={destinationIcao}
          onChange={(e) => setDestinationIcao(e.target.value.toUpperCase())}
          maxLength={4}
          className="px-3 py-2 border border-neutral-300 rounded-sm font-mono text-sm w-24"
          placeholder="LSZN"
        />
      </div>

      <FieldLabel>Bemerkung</FieldLabel>
      <input
        value={remarks}
        onChange={(e) => setRemarks(e.target.value)}
        className="px-3 py-2 border border-neutral-300 rounded-sm text-sm max-w-md"
        placeholder="z.B. Navflight LSZN-LSZB-LSZN"
      />

      <FieldLabel>Pre-flight Check</FieldLabel>
      <PreflightPanel findings={findings} loading={checkLoading} />

      {submitError && (
        <div className="md:col-span-2 border border-red-300 bg-red-50 text-red-800 px-3 py-2 rounded-sm text-sm whitespace-pre-line">
          {submitError}
        </div>
      )}

      <div className="md:col-span-2 flex gap-2 pt-4 border-t border-neutral-200 mt-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 border border-neutral-300 text-navy-800 bg-cream-50 rounded-sm text-sm hover:bg-cream transition-colors"
        >
          Abbrechen
        </button>
        <button
          type="submit"
          disabled={pending || hasBlocker || checkLoading}
          className="px-4 py-2 bg-navy-800 text-white rounded-sm text-sm hover:bg-navy-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {pending ? 'Speichern…' : hasBlocker ? 'Blockiert (siehe Pre-flight)' : 'Reservation speichern'}
        </button>
      </div>
    </form>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-sm text-navy-800 pt-2">{children}</label>;
}

function PreflightPanel({ findings, loading }: { findings: PreflightFinding[]; loading: boolean }) {
  if (loading && findings.length === 0) {
    return (
      <div className="bg-neutral-50 border border-neutral-200 px-4 py-3 rounded-sm text-sm text-neutral-500">
        Prüfung läuft…
      </div>
    );
  }
  if (findings.length === 0) {
    return (
      <div className="bg-neutral-50 border border-neutral-200 px-4 py-3 rounded-sm text-sm text-neutral-500">
        Fülle die Felder oben aus.
      </div>
    );
  }
  return (
    <ul className="bg-neutral-50 border border-neutral-200 rounded-sm divide-y divide-neutral-200">
      {findings.map((f) => (
        <li key={f.code} className="flex items-start gap-3 px-3 py-2 text-sm">
          <Pill severity={f.severity} />
          <div className="flex-1 min-w-0">
            <div className={`font-medium ${
              f.severity === 'block' ? 'text-red-700' :
              f.severity === 'warn'  ? 'text-signal-600' :
              'text-navy-800'
            }`}>{f.label}</div>
            <div className="text-neutral-600 text-xs">{f.detail}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Pill({ severity }: { severity: 'ok' | 'warn' | 'block' }) {
  const bg = severity === 'block' ? 'bg-red-700' : severity === 'warn' ? 'bg-signal-600' : 'bg-emerald-700';
  const ch = severity === 'block' ? '×' : severity === 'warn' ? '!' : '✓';
  return (
    <span className={`${bg} text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0`}>
      {ch}
    </span>
  );
}

function defaultStartTime() {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return toDatetimeLocalString(d);
}

function defaultEndTime(startStr?: string) {
  const start = startStr ? new Date(startStr) : (() => { const d = new Date(); d.setMinutes(0, 0, 0); d.setHours(d.getHours() + 1); return d; })();
  start.setHours(start.getHours() + 2);
  return toDatetimeLocalString(start);
}

function toDatetimeLocalString(d: Date) {
  // datetime-local wants "YYYY-MM-DDTHH:mm"
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
