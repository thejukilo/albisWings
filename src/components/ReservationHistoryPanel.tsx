import { format } from 'date-fns';

type EventRow = {
  id: string;
  event_type: 'created' | 'updated' | 'accepted' | 'returned' | 'cancelled' | 'restored';
  details: string | null;
  occurred_at: string;
  actor?: { display_name: string } | null;
};

const EVENT_LABEL: Record<string, string> = {
  created:   'Reservation wurde erstellt!',
  updated:   'Reservation wurde aktualisiert!',
  accepted:  'Flugzeug wurde erfolgreich akzeptiert!',
  returned:  'Reservation wurde zurückgebracht!',
  cancelled: 'Reservation wurde storniert.',
  restored:  'Reservation wurde wiederhergestellt.',
};

export function ReservationHistoryPanel({ events }: { events: EventRow[] }) {
  return (
    <section className="mb-6">
      <h2 className="text-2xl font-semibold text-navy-800 mb-3">History</h2>
      <div className="bg-white border border-neutral-200 rounded-sm p-5">
        {events.length === 0 ? (
          <div className="text-sm text-neutral-500">Keine Einträge.</div>
        ) : (
          <ul className="space-y-3 text-sm">
            {events.map((e) => (
              <li key={e.id} className="border-l-2 border-neutral-200 pl-3">
                <div className="font-medium text-navy-800">
                  {e.actor?.display_name ?? '—'} – {format(new Date(e.occurred_at), 'dd.MM.yyyy HH:mm')}
                </div>
                <div className="text-neutral-700">
                  {EVENT_LABEL[e.event_type] ?? e.event_type}
                  {e.details && <span className="text-neutral-500"> · {e.details}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
