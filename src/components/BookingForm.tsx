'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { createReservation } from '@/app/reservations/actions';
import type { Aircraft, Instructor, PreflightFinding } from '@/lib/types';

const PURPOSES_PILOT = [
  { value: 'privat',      label: 'Privat' },
  { value: 'schulung',    label: 'Schulung' },
  { value: 'kommerziell', label: 'Kommerziell' },
  { value: 'clubflug',    label: 'Clubflug' },
] as const;

const PURPOSES_STAFF = [
  ...PURPOSES_PILOT,
  { value: 'maintenance', label: 'Wartung' },
  { value: 'standby',     label: 'Standby' },
] as const;

export function BookingForm({
  aircraft,
  instructors,
  canBlockAircraft = false,
  defaults,
}: {
  aircraft: Aircraft[];
  instructors: Instructor[];
  canBlockAircraft?: boolean;
  defaults: {
    aircraftId?: string;
    startsAt?: string;
    endsAt?: string;
  };
}) {
  const PURPOSES = canBlockAircraft ? PURPOSES_STAFF : PURPOSES_PILOT;
  const router = useRouter();
  const supabase = createClient();
  const [pending, startTransition] = useTransition();

  const [aircraftId, setAircraftId] = useState(defaults.aircraftId ?? aircraft[0]?.id ?? '');
  const [startsAt,   setStartsAt]   = useState(defaults.startsAt ?? defaultStartTime());
  const [endsAt,     setEndsAt]     = useState(defaults.endsAt   ?? defaultEndTime(defaults.startsAt));
  const [purpose,    setPurpose]    = useState<string>('privat');
  const [instructorId, setInstructorId] = useState<string>('');
  const [destination,  setDestination]  = useState('');
  const [seats, setSeats] = useState('');
  const [plannedHours, setPlannedHours] = useState('');

  const isUnstaffed = purpose === 'maintenance' || purpose === 'standby';

  const [findings, setFindings] = useState<PreflightFinding[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!aircraftId || !startsAt || !endsAt) return;
    if (new Date(endsAt) <= new Date(startsAt)) return;

    let cancelled = false;
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
    })();
    return () => { cancelled = true; };
  }, [aircraftId, startsAt, endsAt, purpose, instructorId, supabase]);

  const blocker = findings.find(f => f.severity === 'block');
  const warning = findings.find(f => f.severity === 'warn');
  const banner  = blocker ?? warning;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    startTransition(async () => {
      const remarkParts = [
        destination && `Flugziel: ${destination}`,
        seats && `Freie Plätze: ${seats}`,
        plannedHours && `Geplant: ${plannedHours}`,
      ].filter(Boolean);
      const res = await createReservation({
        aircraftId,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        purpose,
        instructorId: instructorId || null,
        remarks: remarkParts.length > 0 ? remarkParts.join(' · ') : undefined,
      });
      if (res.ok) {
        router.push('/reservations');
        router.refresh();
      } else {
        setSubmitError(res.blockers.map(b => `${b.label}: ${b.detail}`).join('\n'));
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl">
      {banner && (
        <p className={`mb-5 text-sm ${banner.severity === 'block' ? 'text-red-700' : 'text-signal-600'}`}>
          {banner.detail}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-y-3 gap-x-4 items-center">
        <FieldLabel required>Reservationstyp</FieldLabel>
        <select
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
          className={selectClass}
        >
          {PURPOSES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>

        <FieldLabel required>Flugzeug</FieldLabel>
        <select
          value={aircraftId}
          onChange={(e) => setAircraftId(e.target.value)}
          className={selectClass}
        >
          {aircraft.map((a) => (
            <option key={a.id} value={a.id}>{a.registration}</option>
          ))}
        </select>

        {!isUnstaffed && (
          <>
            <FieldLabel required>Pilot</FieldLabel>
            <input
              value="Van de Velde Lode"
              readOnly
              className={`${inputClass} bg-neutral-50 text-neutral-700`}
            />

            <FieldLabel required={purpose === 'schulung'}>Fluglehrer</FieldLabel>
            <select
              value={instructorId}
              onChange={(e) => setInstructorId(e.target.value)}
              className={selectClass}
            >
              <option value="">—</option>
              {instructors.map((i) => (
                <option key={i.id} value={i.id}>{i.display_name}</option>
              ))}
            </select>
          </>
        )}

        <FieldLabel required>Von</FieldLabel>
        <input
          type="datetime-local"
          value={startsAt}
          step={3600}
          onChange={(e) => setStartsAt(e.target.value)}
          className={`${inputClass} font-mono`}
        />

        <FieldLabel required>Bis</FieldLabel>
        <input
          type="datetime-local"
          value={endsAt}
          step={3600}
          onChange={(e) => setEndsAt(e.target.value)}
          className={`${inputClass} font-mono`}
        />

        <div className="self-start pt-2">
          <FieldLabel>Flugziel</FieldLabel>
          <div className="text-[11px] text-neutral-500 mt-0.5">500 Zeichen</div>
        </div>
        <textarea
          value={destination}
          onChange={(e) => setDestination(e.target.value.slice(0, 500))}
          rows={5}
          className={inputClass}
          placeholder=""
        />

        <FieldLabel>Freie Plätze</FieldLabel>
        <input
          value={seats}
          onChange={(e) => setSeats(e.target.value)}
          className={inputClass}
        />

        <div className="self-start pt-2">
          <FieldLabel>Geplante Flugzeit</FieldLabel>
          <div className="text-[11px] text-neutral-500 mt-0.5">(hh:mm)</div>
        </div>
        <DurationInput value={plannedHours} onChange={setPlannedHours} />
      </div>

      {submitError && (
        <div className="mt-4 border border-red-300 bg-red-50 text-red-800 px-3 py-2 rounded-sm text-sm whitespace-pre-line">
          {submitError}
        </div>
      )}

      <div className="mt-6 flex gap-2">
        <button
          type="submit"
          disabled={pending || !!blocker}
          className="px-4 py-2 bg-neutral-400 text-white rounded-sm text-sm hover:bg-navy-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {pending ? 'Speichern…' : 'Speichern'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 text-sm text-neutral-500 hover:text-navy-800 transition-colors"
        >
          Abbrechen
        </button>
      </div>
    </form>
  );
}

const inputClass  = 'w-full px-3 py-1.5 border border-neutral-300 rounded-sm text-sm focus:outline-none focus:border-navy-800';
const selectClass = `${inputClass} bg-white`;

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="text-sm text-neutral-700">
      {children}{required && <span className="text-red-600">*</span>}
    </label>
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
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * hh:mm input that auto-formats raw digits on blur:
 *   "0250" -> "02:50"
 *   "250"  -> "02:50"
 *   "2"    -> "02:00"
 *   "2:5"  -> "02:05"   (explicit colon respected)
 *   "12:5" -> "12:05"
 * Invalid minute values (60+) are clamped to 59.
 */
function DurationInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  function format(raw: string): string {
    raw = raw.trim();
    if (raw === '') return '';
    // Explicit colon -> treat parts as hh and mm independently
    if (raw.includes(':')) {
      const [h, m] = raw.split(':');
      const hDigits = (h || '').replace(/\D/g, '');
      const mDigits = (m || '').replace(/\D/g, '');
      if (hDigits === '' && mDigits === '') return '';
      let hNum = parseInt(hDigits || '0', 10);
      let mNum = parseInt(mDigits || '0', 10);
      if (mNum > 59) mNum = 59;
      return `${hNum.toString().padStart(2, '0')}:${mNum.toString().padStart(2, '0')}`;
    }
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 0) return '';
    let hh = '', mm = '';
    if (digits.length <= 2) {
      hh = digits.padStart(2, '0');
      mm = '00';
    } else if (digits.length === 3) {
      hh = '0' + digits.slice(0, 1);
      mm = digits.slice(1);
    } else {
      hh = digits.slice(0, digits.length - 2);
      mm = digits.slice(-2);
    }
    let hNum = parseInt(hh, 10);
    let mNum = parseInt(mm, 10);
    if (mNum > 59) mNum = 59;
    return `${hNum.toString().padStart(2, '0')}:${mNum.toString().padStart(2, '0')}`;
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    onChange(format(e.target.value));
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    // While typing, allow digits and one colon
    const cleaned = e.target.value.replace(/[^\d:]/g, '');
    onChange(cleaned);
  }

  return (
    <input
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder="hh:mm"
      inputMode="numeric"
      className={`${inputClass} font-mono`}
    />
  );
}
