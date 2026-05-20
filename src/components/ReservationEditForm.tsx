'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Instructor } from '@/lib/types';
import { updateReservation, cancelReservation } from '@/app/reservations/actions';

export type EditableReservation = {
  id: string;
  aircraft_id: string;
  registration: string;
  starts_at: string;
  ends_at: string;
  purpose: string;
  instructor_id: string | null;
  remarks: string | null;
  status: string;
};

export function ReservationEditForm({
  reservation,
  instructors,
}: {
  reservation: EditableReservation;
  instructors: Instructor[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Convert ISO → local datetime-local string ("yyyy-MM-ddTHH:mm")
  const initStart = isoToLocal(reservation.starts_at);
  const initEnd   = isoToLocal(reservation.ends_at);

  const [purpose, setPurpose]           = useState(reservation.purpose);
  const [instructorId, setInstructorId] = useState(reservation.instructor_id ?? '');
  const [startsAt, setStartsAt]         = useState(initStart);
  const [endsAt, setEndsAt]             = useState(initEnd);
  const [remarks, setRemarks]           = useState(reservation.remarks ?? '');

  const [errors, setErrors]   = useState<{ code: string; label: string; detail: string }[]>([]);
  const [saving, setSaving]   = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [toast, setToast]     = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  // Auto-dismiss toast after 3 seconds
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // Show instructor field for schulung
  const needsInstructor = purpose === 'schulung';

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setErrors([]);
    setSaving(true);
    try {
      const result = await updateReservation({
        id: reservation.id,
        startsAt: new Date(startsAt).toISOString(),
        endsAt:   new Date(endsAt).toISOString(),
        purpose,
        instructorId: needsInstructor ? instructorId || null : null,
        remarks: remarks.trim() || undefined,
      });
      if (!result.ok) {
        setErrors(result.blockers);
        setToast({ kind: 'error', text: 'Konnte nicht gespeichert werden.' });
      } else {
        setToast({ kind: 'success', text: 'Änderungen gespeichert.' });
        startTransition(() => router.refresh());
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel() {
    setErrors([]);
    setCancelling(true);
    try {
      const result = await cancelReservation(reservation.id);
      if (!result.ok) {
        setErrors([{ code: 'cancel', label: 'Stornieren', detail: result.error ?? 'Fehler' }]);
        setToast({ kind: 'error', text: 'Stornieren fehlgeschlagen.' });
      } else {
        // Don't bother with toast — we redirect immediately
        router.push('/reservations');
      }
    } finally {
      setCancelling(false);
    }
  }

  return (
    <>
      <form onSubmit={handleSave} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Flugzeug</label>
          <input
            type="text"
            value={reservation.registration}
            disabled
            className="w-full px-3 py-2 border border-neutral-200 rounded-sm bg-neutral-50 font-mono text-navy-800 cursor-not-allowed"
          />
          <p className="text-[10px] text-neutral-500 mt-1">Flugzeug kann nicht geändert werden. Neue Reservation für anderes Flugzeug anlegen.</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Reservationstyp</label>
          <select
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            className="w-full px-3 py-2 border border-neutral-300 rounded-sm bg-white text-navy-800"
          >
            <option value="privat">Privat</option>
            <option value="schulung">Schulung</option>
            <option value="commercial">Kommerziell</option>
            <option value="club">Clubflug</option>
          </select>
        </div>

        {needsInstructor && (
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-neutral-600 mb-1">Fluglehrer</label>
            <select
              value={instructorId}
              onChange={(e) => setInstructorId(e.target.value)}
              required
              className="w-full px-3 py-2 border border-neutral-300 rounded-sm bg-white text-navy-800"
            >
              <option value="">— Lehrer wählen —</option>
              {instructors.map((i) => (
                <option key={i.id} value={i.id}>{i.display_name}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Von</label>
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            required
            className="w-full px-3 py-2 border border-neutral-300 rounded-sm bg-white text-navy-800"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Bis</label>
          <input
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            required
            className="w-full px-3 py-2 border border-neutral-300 rounded-sm bg-white text-navy-800"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-neutral-600 mb-1">Bemerkungen / Flugziel</label>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={3}
            placeholder="z.B. LSZN-LSZG-LSZN, Übungsflug, etc."
            className="w-full px-3 py-2 border border-neutral-300 rounded-sm bg-white text-navy-800"
          />
        </div>
      </div>

      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-sm p-3 space-y-1">
          {errors.map((err, i) => (
            <div key={i} className="text-sm text-red-800">
              <strong>{err.label}:</strong> {err.detail}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 pt-2 border-t border-neutral-200">
        {!confirmCancel ? (
          <button
            type="button"
            onClick={() => setConfirmCancel(true)}
            className="text-sm text-red-700 hover:text-red-900 underline"
          >
            Reservation stornieren
          </button>
        ) : (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-red-800">Sicher?</span>
            <button
              type="button"
              onClick={handleCancel}
              disabled={cancelling}
              className="px-3 py-1.5 bg-red-700 text-white rounded-sm hover:bg-red-800 disabled:opacity-50"
            >
              {cancelling ? 'Storniere…' : 'Ja, stornieren'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmCancel(false)}
              className="px-3 py-1.5 border border-neutral-300 text-navy-800 rounded-sm hover:bg-neutral-50"
            >
              Abbrechen
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push('/reservations')}
            className="px-4 py-2 border border-neutral-300 text-navy-800 rounded-sm hover:bg-neutral-50"
          >
            Zurück
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-navy-800 text-cream rounded-sm hover:bg-navy-900 disabled:opacity-50"
          >
            {saving ? 'Speichere…' : 'Änderungen speichern'}
          </button>
        </div>
      </div>
    </form>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-sm shadow-lg border text-sm flex items-center gap-3 animate-slide-up ${
            toast.kind === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-red-50 border-red-300 text-red-900'
          }`}
        >
          <span className={`inline-block w-2 h-2 rounded-full ${
            toast.kind === 'success' ? 'bg-emerald-500' : 'bg-red-500'
          }`} />
          {toast.text}
          <button
            onClick={() => setToast(null)}
            className="ml-2 text-neutral-500 hover:text-neutral-700"
            aria-label="Schließen"
          >
            ✕
          </button>
        </div>
      )}

      <style>{`
        @keyframes slide-up {
          from { transform: translateY(20px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        .animate-slide-up { animation: slide-up 200ms ease-out; }
      `}</style>
    </>
  );
}

function isoToLocal(iso: string): string {
  // datetime-local input wants "yyyy-MM-ddTHH:mm" in local browser tz, but
  // we want to display Europe/Zurich. We render server-side so we format
  // using Intl with that tz.
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Zurich',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}
