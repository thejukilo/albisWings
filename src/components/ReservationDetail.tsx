import { formatLocal } from '@/lib/calendar';

export type DetailReservation = {
  id: string;
  registration: string;
  pilot_name: string | null;
  instructor_name: string | null;
  starts_at: string;
  ends_at: string;
  purpose: string;
  status: string;
  remarks: string | null;
};

const PURPOSE_LABEL: Record<string, string> = {
  privat: 'Privatflug',
  schulung: 'Schulungsflug',
  commercial: 'Kommerziell',
  club: 'Clubflug',
  maintenance: 'Wartung',
  standby: 'Standby',
};

const STATUS_LABEL: Record<string, string> = {
  tentative: 'Provisorisch',
  confirmed: 'Bestätigt',
  completed: 'Abgeschlossen',
  cancelled: 'Storniert',
  no_show: 'No-Show',
};

export function ReservationDetail({ reservation }: { reservation: DetailReservation }) {
  const r = reservation;
  const isCancelled = r.status === 'cancelled';
  const isMaintenance = r.purpose === 'maintenance';
  const isStandby = r.purpose === 'standby';

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
        <Row label="Flugzeug">
          <span className="font-mono text-navy-800">{r.registration}</span>
        </Row>

        <Row label="Typ">
          <span className="text-navy-800">{PURPOSE_LABEL[r.purpose] ?? r.purpose}</span>
        </Row>

        <Row label="Pilot">
          {isMaintenance || isStandby
            ? <span className="text-neutral-500 italic">{isMaintenance ? 'Wartung' : 'Standby'}</span>
            : <span className="text-navy-800">{r.pilot_name ?? '—'}</span>}
        </Row>

        <Row label="Fluglehrer">
          <span className="text-navy-800">{r.instructor_name ?? '—'}</span>
        </Row>

        <Row label="Von">
          <span className="font-mono text-navy-800">
            {formatLocal(r.starts_at, 'EEEE, dd.MM.yyyy')} {formatLocal(r.starts_at, 'HH:mm')}
          </span>
        </Row>

        <Row label="Bis">
          <span className="font-mono text-navy-800">
            {formatLocal(r.ends_at, 'EEEE, dd.MM.yyyy')} {formatLocal(r.ends_at, 'HH:mm')}
          </span>
        </Row>

        <Row label="Status">
          <span className={`inline-block px-2 py-0.5 rounded-sm text-xs font-medium ${
            isCancelled ? 'bg-neutral-200 text-neutral-700' :
            r.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' :
            r.status === 'completed' ? 'bg-sky-100 text-sky-800' :
            'bg-amber-100 text-amber-800'
          }`}>
            {STATUS_LABEL[r.status] ?? r.status}
          </span>
        </Row>

        {r.remarks && (
          <Row label="Bemerkungen" wide>
            <span className="text-navy-800 whitespace-pre-wrap">{r.remarks}</span>
          </Row>
        )}
      </dl>
    </div>
  );
}

function Row({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <dt className="text-[11px] uppercase tracking-wider text-neutral-500 font-medium">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}
