'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { acceptReservation, returnReservation } from '@/app/reservations/actions';

export function ReservationLifecycleActions({
  reservationId,
  aircraftId,
  isInvolved,
  isCancelled,
  isAccepted,
  isReturned,
}: {
  reservationId: string;
  aircraftId: string;
  isInvolved: boolean;
  isCancelled: boolean;
  isAccepted: boolean;
  isReturned: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isCancelled) return null;
  if (!isInvolved) return null;

  async function onAccept() {
    setError(null);
    setBusy(true);
    const res = await acceptReservation(reservationId);
    setBusy(false);
    if (!res.ok) { setError(res.error ?? 'Fehler'); return; }
    startTransition(() => router.refresh());
  }

  async function onReturn() {
    setError(null);
    // Send the user to the flightlog new-entry form pre-filled with this reservation.
    // The actual returnReservation call happens on form submit (next turn).
    // For now, do a direct state transition and route to /flightlog/<aircraft>/new
    router.push(`/flightlog/${aircraftId}/new?reservationId=${reservationId}`);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {!isAccepted && !isReturned && (
          <button
            type="button"
            onClick={onAccept}
            disabled={busy}
            className="px-3 py-1.5 bg-emerald-700 text-white rounded-sm hover:bg-emerald-800 disabled:opacity-50 text-sm"
          >
            {busy ? 'Akzeptiere…' : 'Flugzeug akzeptieren'}
          </button>
        )}

        {isAccepted && !isReturned && (
          <>
            <span className="inline-block px-2 py-1 rounded-sm bg-emerald-100 text-emerald-900 text-xs border border-emerald-200">
              ✓ Akzeptiert
            </span>
            <button
              type="button"
              onClick={onReturn}
              disabled={busy}
              className="px-3 py-1.5 bg-sky-700 text-white rounded-sm hover:bg-sky-800 disabled:opacity-50 text-sm"
            >
              Flugzeug zurückbringen
            </button>
          </>
        )}

        {isReturned && (
          <span className="inline-block px-2 py-1 rounded-sm bg-sky-100 text-sky-900 text-xs border border-sky-200">
            ✓ Zurückgebracht
          </span>
        )}
      </div>
      {error && <div className="text-xs text-red-700">{error}</div>}
    </div>
  );
}
