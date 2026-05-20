'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createFlight, type FlightCategory } from '@/app/flightlog/actions';

const CATEGORIES: { value: FlightCategory; label: string }[] = [
  { value: 'schulung_vfr', label: 'Schulung VFR' },
  { value: 'schulung_ifr', label: 'Schulung IFR' },
  { value: 'charter_vfr',  label: 'Charter VFR'  },
  { value: 'charter_ifr',  label: 'Charter IFR'  },
  { value: 'privat_vfr',   label: 'Privat VFR'   },
  { value: 'privat_ifr',   label: 'Privat IFR'   },
  { value: 'rundflug',     label: 'Rundflug'     },
  { value: 'ueberflug',    label: 'Überflug'     },
  { value: 'wartung',      label: 'Wartung'      },
];

const FUEL_TYPES = [
  { value: '',            label: '—' },
  { value: 'MOGAS_95',    label: 'MOGAS 95' },
  { value: 'AVGAS_100LL', label: 'AVGAS 100LL' },
  { value: 'UL91',        label: 'UL91' },
];

export function NewFlightForm({
  aircraftId, registration,
  currentFtc, currentHobbs, lastPosition,
  me, isAdmin,
  pilots, instructors,
  reservationId, reservation,
}: {
  aircraftId: string;
  registration: string;
  currentFtc: number;
  currentHobbs: number;
  lastPosition: string;
  me: { id: string; displayName: string };
  isAdmin: boolean;
  pilots: { id: string; name: string }[];
  instructors: { id: string; name: string }[];
  reservationId: string | null;
  reservation: {
    pilotId: string | null;
    instructorId: string | null;
    purpose: string | null;
    startsAt: string | null;
    endsAt: string | null;
  } | null;
}) {
  const router = useRouter();

  // Derived defaults
  const todayLocal = todayLocalDate();
  const guessCategory = ((): FlightCategory => {
    if (reservation?.instructorId || reservation?.purpose === 'schulung') return 'schulung_vfr';
    if (reservation?.purpose === 'commercial') return 'charter_vfr';
    return 'privat_vfr';
  })();

  // Form state
  const [category,    setCategory]     = useState<FlightCategory>(guessCategory);
  const [mwstBefreit, setMwstBefreit]  = useState<boolean>(guessCategory.startsWith('schulung'));
  const [flightDate,  setFlightDate]   = useState(todayLocal);

  // Pilot is the current user by default. Admin can choose otherwise.
  const [pilotId, setPilotId] = useState(reservation?.pilotId || me.id);
  const [instructorId, setInstructorId] = useState(reservation?.instructorId || '');

  const [origin,      setOrigin]      = useState(lastPosition);
  const [destination, setDestination] = useState('LSZN');

  // Times — default to reservation window if available, otherwise blank
  const [blockOff, setBlockOff] = useState(timeFromIso(reservation?.startsAt) || '');
  const [takeoff,  setTakeoff]  = useState('');
  const [landing,  setLanding]  = useState('');
  const [blockOn,  setBlockOn]  = useState(timeFromIso(reservation?.endsAt) || '');

  // Counters — pre-fill start from current; end blank
  const [ftcStart,   setFtcStart]   = useState(currentFtc.toFixed(2));
  const [ftcEnd,     setFtcEnd]     = useState('');
  const [hobbsStart, setHobbsStart] = useState(currentHobbs.toFixed(2));
  const [hobbsEnd,   setHobbsEnd]   = useState('');

  const [ldgDay,    setLdgDay]    = useState('1');
  const [ldgNight,  setLdgNight]  = useState('0');
  const [goArounds, setGoArounds] = useState('0');

  const [passengers, setPassengers] = useState('0');
  const [fuelType,   setFuelType]   = useState('');
  const [fuelL,      setFuelL]      = useState('');
  const [oilQt,      setOilQt]      = useState('');
  const [oxygen,     setOxygen]     = useState(false);

  const [remarks, setRemarks] = useState('');
  const [machineOk, setMachineOk] = useState<boolean>(true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Compute live duration label
  const flightDurStr = computeDuration(takeoff, landing);
  const blockDurStr  = computeDuration(blockOff, blockOn);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Auto-fill: if blockOn/landing missing but the other is set, leave error to user.
    if (!blockOff || !takeoff || !landing || !blockOn) {
      setError('Bitte alle vier Zeiten (Blockzeit Start, Flugzeit Start, Flugzeit Ziel, Blockzeit Ziel) ausfüllen.');
      return;
    }
    if (!ftcEnd || !hobbsEnd) {
      setError('FTC Ende und Zähler 2 Ende sind erforderlich.');
      return;
    }
    if (!destination || destination.length !== 4) {
      setError('Zielort muss exakt 4 Zeichen sein (ICAO).');
      return;
    }

    setSubmitting(true);
    const res = await createFlight({
      reservationId,
      aircraftId,
      flightCategory:  category,
      mwstBefreit,
      flightDate,
      pilotId,
      instructorId:    instructorId || null,
      originIcao:      origin.toUpperCase(),
      destinationIcao: destination.toUpperCase(),
      ftcStart:   Number(ftcStart),
      ftcEnd:     Number(ftcEnd),
      hobbsStart: Number(hobbsStart),
      hobbsEnd:   Number(hobbsEnd),
      blockOff, takeoff, landing, blockOn,
      landingsDay:   Number(ldgDay)    || 0,
      landingsNight: Number(ldgNight)  || 0,
      goArounds:     Number(goArounds) || 0,
      passengerCount: Number(passengers) || 0,
      fuelType:       fuelType || null,
      fuelUpliftL:    fuelL ? Number(fuelL) : null,
      oilAddedQt:     oilQt ? Number(oilQt) : null,
      oxygenUsed:     oxygen,
      remarks:        remarks || null,
      machineOk,
    });
    setSubmitting(false);
    if (!res.ok) { setError(res.error); return; }

    if (reservationId) {
      router.push(`/reservations/${reservationId}`);
    } else {
      router.push(`/flightlog/${aircraftId}`);
    }
  }

  const isSchulung = category.startsWith('schulung');

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Flugart" required>
        <select value={category} onChange={(e) => setCategory(e.target.value as FlightCategory)} className={selectCls}>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </Field>

      <Field label="MWST befreit">
        <input
          type="checkbox"
          checked={mwstBefreit}
          onChange={(e) => setMwstBefreit(e.target.checked)}
          className="h-4 w-4 align-middle"
        />
      </Field>

      <Field label="Datum" required>
        <input type="date" value={flightDate} onChange={(e) => setFlightDate(e.target.value)} required className={inputCls} />
      </Field>

      <Field label="Flugzeug" required>
        <input value={registration} readOnly className={`${inputCls} bg-neutral-50 font-mono`} />
      </Field>

      <Field label="Pilot" required>
        {isAdmin ? (
          <select value={pilotId} onChange={(e) => setPilotId(e.target.value)} className={selectCls}>
            <option value={me.id}>{me.displayName} (Sie)</option>
            {pilots.filter(p => p.id !== me.id).map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        ) : (
          <input value={me.displayName} readOnly className={`${inputCls} bg-neutral-50`} />
        )}
      </Field>

      <Field label="Fluglehrer" required={isSchulung}>
        <select value={instructorId} onChange={(e) => setInstructorId(e.target.value)} className={selectCls} required={isSchulung}>
          <option value="">—</option>
          {instructors.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Startort" required>
          <input value={origin} onChange={(e) => setOrigin(e.target.value.toUpperCase().slice(0,4))} maxLength={4} required className={`${inputCls} font-mono`} />
        </Field>
        <Field label="Zielort" required>
          <input value={destination} onChange={(e) => setDestination(e.target.value.toUpperCase().slice(0,4))} maxLength={4} required className={`${inputCls} font-mono`} />
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-neutral-200">
        <Field label="FTC (Start)" required>
          <input type="number" step="0.01" value={ftcStart} onChange={(e) => setFtcStart(e.target.value)} required className={`${inputCls} font-mono`} />
        </Field>
        <Field label="FTC (Ende)" required>
          <input type="number" step="0.01" value={ftcEnd} onChange={(e) => setFtcEnd(e.target.value)} required className={`${inputCls} font-mono`} />
        </Field>

        <Field label="Zähler 2 / Hobbs (Start)" required>
          <input type="number" step="0.01" value={hobbsStart} onChange={(e) => setHobbsStart(e.target.value)} required className={`${inputCls} font-mono`} />
        </Field>
        <Field label="Zähler 2 / Hobbs (Ende)" required>
          <input type="number" step="0.01" value={hobbsEnd} onChange={(e) => setHobbsEnd(e.target.value)} required className={`${inputCls} font-mono`} />
        </Field>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-neutral-200">
        <Field label="Blockzeit Start" required>
          <input type="time" value={blockOff} onChange={(e) => setBlockOff(e.target.value)} required className={inputCls} />
        </Field>
        <Field label="Flugzeit Start" required>
          <input type="time" value={takeoff} onChange={(e) => setTakeoff(e.target.value)} required className={inputCls} />
        </Field>
        <Field label="Flugzeit Ziel" required>
          <input type="time" value={landing} onChange={(e) => setLanding(e.target.value)} required className={inputCls} />
        </Field>
        <Field label="Blockzeit Ziel" required>
          <input type="time" value={blockOn} onChange={(e) => setBlockOn(e.target.value)} required className={inputCls} />
        </Field>
      </div>

      <div className="text-[11px] text-neutral-500 -mt-2">
        Flugzeit: <span className="font-mono">{flightDurStr ?? '—'}</span>
        {' · '}
        Blockzeit: <span className="font-mono">{blockDurStr ?? '—'}</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-neutral-200">
        <Field label="LDG (day)" required>
          <input type="number" min="0" value={ldgDay} onChange={(e) => setLdgDay(e.target.value)} required className={`${inputCls} font-mono`} />
        </Field>
        <Field label="LDG (night)">
          <input type="number" min="0" value={ldgNight} onChange={(e) => setLdgNight(e.target.value)} className={`${inputCls} font-mono`} />
        </Field>
        <Field label="G/A">
          <input type="number" min="0" value={goArounds} onChange={(e) => setGoArounds(e.target.value)} className={`${inputCls} font-mono`} />
        </Field>
        <Field label="Passagiere">
          <input type="number" min="0" value={passengers} onChange={(e) => setPassengers(e.target.value)} className={`${inputCls} font-mono`} />
        </Field>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 border-t border-neutral-200">
        <Field label="Treibstoffart">
          <select value={fuelType} onChange={(e) => setFuelType(e.target.value)} className={selectCls}>
            {FUEL_TYPES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </Field>
        <Field label="Tank-Uplift (L)">
          <input type="number" min="0" step="0.1" value={fuelL} onChange={(e) => setFuelL(e.target.value)} className={`${inputCls} font-mono`} />
        </Field>
        <Field label="Öl (L)">
          <input type="number" min="0" step="0.1" value={oilQt} onChange={(e) => setOilQt(e.target.value)} className={`${inputCls} font-mono`} />
        </Field>
      </div>

      <Field label="Sauerstoff verbraucht">
        <input type="checkbox" checked={oxygen} onChange={(e) => setOxygen(e.target.checked)} className="h-4 w-4 align-middle" />
      </Field>

      <Field label="Kommentar (500 Zeichen)">
        <textarea
          value={remarks}
          onChange={(e) => setRemarks(e.target.value.slice(0, 500))}
          rows={3}
          className={inputCls}
          placeholder="Optionale Bemerkungen zum Flug…"
        />
      </Field>

      <Field label="Maschine OK" required>
        <select value={machineOk ? 'ja' : 'nein'} onChange={(e) => setMachineOk(e.target.value === 'ja')} className={selectCls}>
          <option value="ja">Ja</option>
          <option value="nein">Nein — Defekt melden</option>
        </select>
        {!machineOk && (
          <p className="text-[11px] text-amber-700 mt-1">
            Es wird automatisch ein Techlog-Eintrag &quot;Not Flight Relevant&quot; eröffnet, den der Mechaniker prüfen muss.
          </p>
        )}
      </Field>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-sm p-3 text-sm text-red-800 whitespace-pre-wrap">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-200">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 border border-neutral-300 text-navy-800 rounded-sm hover:bg-neutral-50"
        >
          Abbrechen
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 bg-navy-800 text-cream rounded-sm hover:bg-navy-900 disabled:opacity-50"
        >
          {submitting ? 'Speichere…' : 'Speichern'}
        </button>
      </div>
    </form>
  );
}

const inputCls  = 'w-full px-3 py-2 border border-neutral-300 rounded-sm bg-white text-navy-800 focus:border-navy-800 focus:outline-none focus:ring-1 focus:ring-navy-800';
const selectCls = inputCls;

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-neutral-600 mb-1">
        {label}{required && <span className="text-red-600">*</span>}
      </label>
      {children}
    </div>
  );
}

function todayLocalDate(): string {
  const d = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Zurich',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(d);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function timeFromIso(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Zurich',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso));
}

function computeDuration(start: string, end: string): string | null {
  if (!start || !end) return null;
  const [h1, m1] = start.split(':').map(Number);
  const [h2, m2] = end.split(':').map(Number);
  if (isNaN(h1) || isNaN(h2)) return null;
  let mins = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (mins < 0) mins += 24 * 60;
  const h = Math.floor(mins / 60);
  const r = mins % 60;
  return `${h.toString().padStart(2,'0')}:${r.toString().padStart(2,'0')}`;
}
