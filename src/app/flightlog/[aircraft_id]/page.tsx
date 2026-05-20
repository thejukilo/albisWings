import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { TopNav } from '@/components/TopNav';
import { format } from 'date-fns';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 25;

export default async function AircraftFlightlogPage({
  params, searchParams,
}: {
  params: Promise<{ aircraft_id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { aircraft_id } = await params;
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase
    .from('users')
    .select('id, display_name')
    .eq('id', user.id)
    .maybeSingle();

  const { data: aircraft } = await supabase
    .from('aircraft')
    .select('id, registration, manufacturer, model, current_ftc, current_hobbs, total_landings, last_position')
    .eq('id', aircraft_id)
    .maybeSingle();
  if (!aircraft) notFound();

  // Count total flights for pagination
  const { count: totalCount } = await supabase
    .from('flights')
    .select('id', { count: 'exact', head: true })
    .eq('aircraft_id', aircraft_id);
  const total = totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * PAGE_SIZE;

  // Fetch this page of flights, most recent first. Embed the PIC pilot.
  const { data: flights } = await supabase
    .from('flights')
    .select(`
      id, flight_date,
      origin_icao, destination_icao,
      block_off, takeoff, landing, block_on,
      ftc_start, ftc_end, hobbs_start, hobbs_end,
      landings_day, landings_night, go_arounds,
      flight_category, mwst_befreit, passenger_count,
      remarks,
      pilots:flight_pilots(user_id, function, time_logged, user:users(display_name, last_name, first_name))
    `)
    .eq('aircraft_id', aircraft_id)
    .order('block_off', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  // Compute entry numbers for display (sequential from 1 at the oldest flight)
  // The simplest: total - (offset + idx)
  const rows = (flights ?? []).map((f: any, idx: number) => ({
    ...f,
    entry_no: total - offset - idx,
  }));

  // Pre-compute totals for current page bottom row
  const sums = rows.reduce((acc, r: any) => {
    const flightMin = r.takeoff && r.landing
      ? Math.max(0, Math.round((new Date(r.landing).getTime() - new Date(r.takeoff).getTime()) / 60000))
      : 0;
    const blockMin = r.block_off && r.block_on
      ? Math.max(0, Math.round((new Date(r.block_on).getTime() - new Date(r.block_off).getTime()) / 60000))
      : 0;
    acc.flightMin += flightMin;
    acc.blockMin  += blockMin;
    acc.landings  += (r.landings_day ?? 0) + (r.landings_night ?? 0);
    return acc;
  }, { flightMin: 0, blockMin: 0, landings: 0 });

  return (
    <>
      <TopNav userName={me?.display_name ?? user.email ?? 'Member'} active="flightlog" />
      <div className="max-w-[1500px] mx-auto px-4 py-6">
        <Link href="/flightlog" className="text-feather hover:text-navy-700 text-sm inline-flex items-center gap-1 mb-3">
          ← Zurück zur Flottenübersicht
        </Link>

        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div>
            <h1 className="text-3xl font-semibold text-navy-800">Flightlog</h1>
            <p className="text-feather text-sm">
              Hier können Flightlogeinträge des Flugzeugs <span className="font-mono">{aircraft.registration}</span> eingesehen werden.
            </p>
          </div>
          <div className="text-right text-sm">
            <div className="font-mono text-navy-800">
              FTC <strong>{aircraft.current_ftc != null ? Number(aircraft.current_ftc).toFixed(2) : '—'}</strong>
              {' · '}
              Hobbs <strong>{aircraft.current_hobbs != null ? Number(aircraft.current_hobbs).toFixed(2) : '—'}</strong>
            </div>
            <div className="text-[11px] text-neutral-500">Position: <span className="font-mono">{aircraft.last_position ?? '—'}</span> · Total Landings: {aircraft.total_landings}</div>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-3">
          <Link
            href={`/flightlog/${aircraft_id}/new`}
            className="bg-navy-800 text-cream px-4 py-2 rounded-sm hover:bg-navy-900 text-sm"
          >
            + Neuer Eintrag
          </Link>
          <Pager aircraftId={aircraft_id} page={safePage} totalPages={totalPages} />
        </div>

        <div className="border border-neutral-200 rounded-sm overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-neutral-500 text-cream uppercase tracking-wider text-[10px]">
                <th rowSpan={2} className="py-2 px-3 text-left border-b border-neutral-400">#</th>
                <th rowSpan={2} className="py-2 px-3 text-left border-b border-neutral-400">Datum</th>
                <th rowSpan={2} className="py-2 px-3 text-left border-b border-neutral-400">Pilot</th>
                <th colSpan={2} className="py-1 px-3 text-center border-b border-neutral-400 border-l border-neutral-400">Ort</th>
                <th colSpan={3} className="py-1 px-3 text-center border-b border-neutral-400 border-l border-neutral-400">Flugzeit</th>
                <th rowSpan={2} className="py-2 px-3 text-center border-b border-neutral-400 border-l border-neutral-400">Ldg</th>
                <th colSpan={3} className="py-1 px-3 text-center border-b border-neutral-400 border-l border-neutral-400">Blockzeit</th>
                <th colSpan={3} className="py-1 px-3 text-center border-b border-neutral-400 border-l border-neutral-400">FTC</th>
              </tr>
              <tr className="bg-neutral-500 text-cream text-[10px]">
                <th className="py-1 px-3 text-left border-l border-neutral-400">Start</th>
                <th className="py-1 px-3 text-left">Ziel</th>
                <th className="py-1 px-3 text-left border-l border-neutral-400">Start</th>
                <th className="py-1 px-3 text-left">Ziel</th>
                <th className="py-1 px-3 text-right">Dauer</th>
                <th className="py-1 px-3 text-left border-l border-neutral-400">Start</th>
                <th className="py-1 px-3 text-left">Ziel</th>
                <th className="py-1 px-3 text-right">Dauer</th>
                <th className="py-1 px-3 text-right border-l border-neutral-400">Start</th>
                <th className="py-1 px-3 text-right">Ende</th>
                <th className="py-1 px-3 text-right">Diff</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={14} className="py-8 text-center text-sm text-neutral-500">
                    Keine Flighlog-Einträge.
                  </td>
                </tr>
              )}
              {rows.map((r: any, i: number) => (
                <FlightRow key={r.id} row={r} striped={i % 2 === 1} />
              ))}
              {rows.length > 0 && (
                <tr className="bg-cream text-navy-800 font-semibold border-t-2 border-neutral-400">
                  <td colSpan={5} className="py-2 px-3 text-right">Summe (Seite):</td>
                  <td colSpan={3} className="py-2 px-3 text-right font-mono">{fmtMinutes(sums.flightMin)}</td>
                  <td className="py-2 px-3 text-center font-mono">{sums.landings}</td>
                  <td colSpan={3} className="py-2 px-3 text-right font-mono">{fmtMinutes(sums.blockMin)}</td>
                  <td colSpan={3} className="py-2 px-3 text-right font-mono">{(sums.flightMin / 60).toFixed(2)} h</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-neutral-500">
          <div>
            Insgesamt {total} {total === 1 ? 'Eintrag' : 'Einträge'} · Seite {safePage} von {totalPages}
          </div>
        </div>
      </div>
    </>
  );
}

function FlightRow({ row: r, striped }: { row: any; striped: boolean }) {
  const bg = striped ? 'bg-neutral-50' : 'bg-white';
  // Get the PIC/DUAL pilot name (first non-instructor pilot row)
  const pilots = (r.pilots ?? []).filter((p: any) => p.function !== 'INSTR');
  const pilot = pilots[0]?.user;
  const pilotName = pilot ? pilotInitials(pilot.first_name, pilot.last_name) : '—';

  const flightStart = formatHM(r.takeoff);
  const flightEnd   = formatHM(r.landing);
  const flightDur   = diffMinutes(r.takeoff, r.landing);

  const blockStart = formatHM(r.block_off);
  const blockEnd   = formatHM(r.block_on);
  const blockDur   = diffMinutes(r.block_off, r.block_on);

  const ftcDiff = r.ftc_end != null && r.ftc_start != null
    ? (Number(r.ftc_end) - Number(r.ftc_start)).toFixed(2)
    : '—';

  return (
    <tr className={`${bg} text-navy-800 hover:bg-cream-50`}>
      <td className="py-1.5 px-3 font-mono text-neutral-600">{r.entry_no}</td>
      <td className="py-1.5 px-3 text-neutral-700">{format(new Date(r.flight_date), 'dd.MM.yy')}</td>
      <td className="py-1.5 px-3">{pilotName}</td>
      <td className="py-1.5 px-3 border-l border-neutral-200 font-mono">{r.origin_icao}</td>
      <td className="py-1.5 px-3 font-mono">{r.destination_icao}</td>
      <td className="py-1.5 px-3 border-l border-neutral-200 font-mono">{flightStart}</td>
      <td className="py-1.5 px-3 font-mono">{flightEnd}</td>
      <td className="py-1.5 px-3 text-right font-mono">{flightDur ?? '—'}</td>
      <td className="py-1.5 px-3 text-center border-l border-neutral-200 font-mono">{(r.landings_day ?? 0) + (r.landings_night ?? 0)}</td>
      <td className="py-1.5 px-3 border-l border-neutral-200 font-mono">{blockStart}</td>
      <td className="py-1.5 px-3 font-mono">{blockEnd}</td>
      <td className="py-1.5 px-3 text-right font-mono">{blockDur ?? '—'}</td>
      <td className="py-1.5 px-3 text-right border-l border-neutral-200 font-mono">{r.ftc_start != null ? Number(r.ftc_start).toFixed(2) : '—'}</td>
      <td className="py-1.5 px-3 text-right font-mono">{r.ftc_end != null ? Number(r.ftc_end).toFixed(2) : '—'}</td>
      <td className="py-1.5 px-3 text-right font-mono">{ftcDiff}</td>
    </tr>
  );
}

function Pager({ aircraftId, page, totalPages }: { aircraftId: string; page: number; totalPages: number }) {
  function PageLink({ to, label, disabled }: { to: number; label: string; disabled?: boolean }) {
    if (disabled) {
      return <span className="px-2 py-1 text-neutral-300 select-none">{label}</span>;
    }
    return (
      <Link
        href={`/flightlog/${aircraftId}?page=${to}`}
        className="px-2 py-1 text-feather hover:text-navy-700"
      >
        {label}
      </Link>
    );
  }
  return (
    <div className="flex items-center gap-1 text-sm">
      <PageLink to={1}            label="«" disabled={page === 1} />
      <PageLink to={page - 1}     label="‹" disabled={page === 1} />
      <span className="px-3 py-1 text-navy-800 font-mono">{page} / {totalPages}</span>
      <PageLink to={page + 1}     label="›" disabled={page === totalPages} />
      <PageLink to={totalPages}   label="»" disabled={page === totalPages} />
    </div>
  );
}

function pilotInitials(first: string, last: string): string {
  if (!first || !last) return last || first || '—';
  return `${first[0]}. ${last}`;
}

function formatHM(iso: string | null): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Zurich',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso));
}

function diffMinutes(startIso: string | null, endIso: string | null): string | null {
  if (!startIso || !endIso) return null;
  const m = Math.max(0, Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000));
  return fmtMinutes(m);
}

function fmtMinutes(m: number): string {
  const h = Math.floor(m / 60);
  const r = m % 60;
  return `${h.toString().padStart(2,'0')}:${r.toString().padStart(2,'0')}`;
}
