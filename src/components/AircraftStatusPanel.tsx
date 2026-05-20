import Link from 'next/link';
import { format } from 'date-fns';

type MaintEvent = {
  id: string;
  description: string;
  due_at_hours: number | null;
  due_at_date: string | null;
  difference_hours_text: string | null;
  difference_days: number | null;
  current_ftc: number | null;
};

type TechlogEntry = {
  id: string;
  entry_no: number;
  item: string;
  relevance: 'info' | 'not_flight_relevant' | 'flight_relevant_aog';
  state: string;
  raised_at: string;
  raised_by_user?: { display_name: string } | null;
};

type CrsRow = {
  id: string;
  crs_number: string;
  issued_at: string;
  mechanic_licence_no: string;
  work_performed: string;
  hobbs_at_issue: number;
  landings_at_issue: number;
  issued_by_user?: { display_name: string } | null;
} | null;

type LastFlight = {
  flight_date: string;
  destination_icao: string;
  ftc_end: number;
  hobbs_end: number;
} | null;

export function AircraftStatusPanel({
  aircraftId, registration,
  currentFtc, currentHobbs, totalLandings, lastPosition,
  maintenanceEvents, techlogTop, crsLast, lastFlight,
}: {
  aircraftId: string;
  registration: string;
  currentFtc: number | null;
  currentHobbs: number | null;
  totalLandings: number;
  lastPosition: string | null;
  maintenanceEvents: MaintEvent[];
  techlogTop: TechlogEntry[];
  crsLast: CrsRow;
  lastFlight: LastFlight;
}) {
  // Format FTC as decimal hours (1939.47) — could also show as HH:MM, but the
  // original screenshot used HH:MM format (5854:36). We'll keep decimal but
  // it's easy to swap.
  function fmtFtc(v: number | null): string {
    if (v == null) return '—';
    return Number(v).toFixed(2);
  }

  return (
    <section className="mb-6">
      <h2 className="text-2xl font-semibold text-navy-800 mb-3">Aircraft Status</h2>

      {/* Next Due Maintenance */}
      <div className="mb-5">
        <h3 className="text-lg text-navy-800 mb-2">Next Due Maintenance Events {registration}</h3>
        <div className="border border-neutral-200 rounded-sm overflow-hidden">
          <div className="grid grid-cols-[minmax(280px,2fr)_120px_120px_120px] text-sm">
            <div className="contents bg-cream text-navy-800 font-medium">
              <div className="py-2 px-4 bg-cream">Description</div>
              <div className="py-2 px-4 bg-cream text-right">Limite</div>
              <div className="py-2 px-4 bg-cream text-right">Aktuell</div>
              <div className="py-2 px-4 bg-cream text-right">Differenz</div>
            </div>
            {maintenanceEvents.length === 0 && (
              <div className="col-span-4 py-3 px-4 text-center text-neutral-500 text-sm">
                Keine bevorstehenden Wartungsereignisse.
              </div>
            )}
            {maintenanceEvents.map((m, i) => {
              const bg = i % 2 === 0 ? 'bg-white' : 'bg-neutral-50';
              const limit  = m.due_at_hours != null ? Number(m.due_at_hours).toFixed(2)
                            : m.due_at_date != null ? format(new Date(m.due_at_date), 'dd.MM.yyyy')
                            : '—';
              const current = m.due_at_hours != null ? fmtFtc(m.current_ftc)
                            : m.due_at_date != null ? format(new Date(), 'dd.MM.yyyy')
                            : '—';
              const diff = m.due_at_hours != null && m.current_ftc != null
                            ? `${(Number(m.due_at_hours) - Number(m.current_ftc)).toFixed(2)} h`
                            : m.difference_days != null
                              ? (m.difference_days >= 0 ? `${m.difference_days}d` : `${m.difference_days}d (überfällig)`)
                              : '—';
              const diffClass = m.due_at_hours != null && m.current_ftc != null
                                  ? ((Number(m.due_at_hours) - Number(m.current_ftc)) <= (m.due_at_hours > 100 ? 15 : 5) ? 'text-amber-700 font-semibold' : 'text-neutral-700')
                                  : m.difference_days != null && m.difference_days < 60
                                    ? (m.difference_days < 0 ? 'text-red-700 font-semibold' : 'text-amber-700 font-semibold')
                                    : 'text-neutral-700';
              return (
                <div key={m.id} className="contents">
                  <div className={`py-2 px-4 ${bg} text-navy-800`}>{m.description}</div>
                  <div className={`py-2 px-4 ${bg} font-mono text-right text-neutral-700`}>{limit}</div>
                  <div className={`py-2 px-4 ${bg} font-mono text-right text-neutral-700`}>{current}</div>
                  <div className={`py-2 px-4 ${bg} font-mono text-right ${diffClass}`}>{diff}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Techlog top entries */}
      <div className="mb-5">
        <div className="flex items-center justify-between gap-3 mb-2">
          <h3 className="text-lg text-navy-800">Techlog {registration}</h3>
          <Link href={`/techlog/${aircraftId}`} className="text-xs text-feather hover:text-navy-700 underline">
            Vollständiger Techlog →
          </Link>
        </div>
        <div className="border border-neutral-200 rounded-sm overflow-hidden">
          <div className="grid grid-cols-[60px_1fr_140px_140px] text-sm">
            <div className="contents bg-neutral-500 text-cream text-[11px] uppercase tracking-wider font-medium">
              <div className="py-2 px-4 bg-neutral-500">No.</div>
              <div className="py-2 px-4 bg-neutral-500">Item</div>
              <div className="py-2 px-4 bg-neutral-500">Action or Comment</div>
              <div className="py-2 px-4 bg-neutral-500">Status</div>
            </div>
            {techlogTop.length === 0 && (
              <div className="col-span-4 py-3 px-4 text-center text-neutral-500 text-sm">
                Keine offenen Techlog-Einträge.
              </div>
            )}
            {techlogTop.map((e, i) => {
              const bg = i % 2 === 0 ? 'bg-white' : 'bg-neutral-50';
              const isAog = e.relevance === 'flight_relevant_aog';
              const label = isAog ? 'Open – AOG'
                          : e.relevance === 'info' ? 'For information only'
                          : 'Open – Not Flight Relevant';
              const cls = isAog ? 'bg-red-100 text-red-900 border-red-200'
                        : e.relevance === 'info' ? 'bg-neutral-100 text-neutral-700 border-neutral-200'
                        : 'bg-amber-100 text-amber-900 border-amber-200';
              return (
                <Link key={e.id} href={`/techlog/${aircraftId}/${e.id}`} className="contents group">
                  <div className={`py-2 px-4 ${bg} group-hover:bg-cream-50 font-mono text-neutral-600`}>{e.entry_no}</div>
                  <div className={`py-2 px-4 ${bg} group-hover:bg-cream-50`}>
                    <div className="italic text-navy-800">{e.item}</div>
                    <div className="text-[11px] text-neutral-500 mt-0.5">
                      {e.raised_by_user?.display_name ?? '—'}, {format(new Date(e.raised_at), 'dd.MM.yyyy')}
                    </div>
                  </div>
                  <div className={`py-2 px-4 ${bg} group-hover:bg-cream-50 text-neutral-400`}>—</div>
                  <div className={`py-2 px-4 ${bg} group-hover:bg-cream-50`}>
                    <span className={`inline-block px-2 py-0.5 rounded-sm text-[11px] font-medium border ${cls}`}>
                      {label}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* CRS — last */}
      {crsLast && (
        <div className="mb-5">
          <div className="flex items-center justify-between gap-3 mb-2">
            <h3 className="text-lg text-navy-800">CRS — Check (last) {registration}</h3>
            <Link href={`/techlog/${aircraftId}?tab=crs`} className="text-xs text-feather hover:text-navy-700 underline">
              Vollständige CRS-Liste →
            </Link>
          </div>
          <div className="border border-neutral-200 rounded-sm overflow-hidden">
            <div className="grid grid-cols-[60px_minmax(220px,1fr)_minmax(300px,2fr)_120px] text-sm">
              <div className="contents bg-neutral-500 text-cream text-[11px] uppercase tracking-wider font-medium">
                <div className="py-2 px-4 bg-neutral-500">No.</div>
                <div className="py-2 px-4 bg-neutral-500">Item</div>
                <div className="py-2 px-4 bg-neutral-500">Action or Comment</div>
                <div className="py-2 px-4 bg-neutral-500">Status</div>
              </div>
              <div className="contents bg-white">
                <div className="py-2 px-4 font-mono text-neutral-600">{crsLast.crs_number}</div>
                <div className="py-2 px-4">
                  <div className="italic text-navy-800">{crsLast.work_performed.split('\n')[0]}</div>
                  <div className="text-[11px] text-neutral-500 mt-0.5">
                    {crsLast.issued_by_user?.display_name ?? '—'} ({crsLast.mechanic_licence_no}), {format(new Date(crsLast.issued_at), 'dd.MM.yyyy')}
                  </div>
                </div>
                <div className="py-2 px-4 text-navy-800 whitespace-pre-wrap text-[13px]">
                  {crsLast.work_performed}
                  <div className="mt-2 pt-2 border-t border-neutral-200 text-[11px] text-neutral-500">
                    Hobbs: {Number(crsLast.hobbs_at_issue).toFixed(2)} · Landings: {crsLast.landings_at_issue}
                  </div>
                </div>
                <div className="py-2 px-4">
                  <span className="inline-block px-2 py-0.5 rounded-sm text-[11px] font-medium border bg-emerald-100 text-emerald-900 border-emerald-200">
                    CRS – Check
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Flightlog summary */}
      <div className="mb-5">
        <div className="flex items-center justify-between gap-3 mb-2">
          <h3 className="text-lg text-navy-800">Flightlog {registration}</h3>
          <Link href={`/flightlog/${aircraftId}`} className="text-xs text-feather hover:text-navy-700 underline">
            Vollständiger Flightlog →
          </Link>
        </div>
        <div className="border border-neutral-200 rounded-sm overflow-hidden">
          <div className="grid grid-cols-5 text-sm">
            <div className="contents bg-cream text-navy-800 font-medium">
              <div className="py-2 px-4 bg-cream">Position</div>
              <div className="py-2 px-4 bg-cream">Last flight</div>
              <div className="py-2 px-4 bg-cream">Brought Forward</div>
              <div className="py-2 px-4 bg-cream">FTC</div>
              <div className="py-2 px-4 bg-cream">Landings (total)</div>
            </div>
            <div className="contents bg-white">
              <div className="py-3 px-4 font-mono text-navy-800">{lastPosition ?? '—'}</div>
              <div className="py-3 px-4 font-mono text-navy-800">
                {lastFlight ? format(new Date(lastFlight.flight_date), 'dd.MM.yyyy') : '—'}
              </div>
              <div className="py-3 px-4 font-mono text-navy-800">{fmtFtc(currentFtc)}</div>
              <div className="py-3 px-4 font-mono text-navy-800">{fmtFtc(currentFtc)}</div>
              <div className="py-3 px-4 font-mono text-navy-800">{totalLandings}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
