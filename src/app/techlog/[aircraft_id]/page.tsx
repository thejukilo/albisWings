import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { format } from 'date-fns';

export const dynamic = 'force-dynamic';

type Tab = 'techlog' | 'crs' | 'ar';
type SP = { tab?: string; history?: string };

export default async function AircraftTechlogPage({
  params, searchParams,
}: {
  params: Promise<{ aircraft_id: string }>;
  searchParams: Promise<SP>;
}) {
  const { aircraft_id } = await params;
  const sp = await searchParams;
  const tab: Tab = (sp.tab === 'crs' || sp.tab === 'ar') ? sp.tab : 'techlog';
  const showHistory = sp.history === '1';

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase
    .from('users')
    .select('id, display_name, first_name, last_name')
    .eq('id', user.id)
    .maybeSingle();

  const { data: aircraft, error: acErr } = await supabase
    .from('aircraft')
    .select('id, registration, manufacturer, model')
    .eq('id', aircraft_id)
    .maybeSingle();
  if (acErr || !aircraft) notFound();

  const { count: aogCount } = await supabase
    .from('techlog_entries')
    .select('id', { count: 'exact', head: true })
    .eq('aircraft_id', aircraft_id)
    .eq('state', 'open')
    .eq('relevance', 'flight_relevant_aog');
  const isAog = (aogCount ?? 0) > 0;

  return (
    <AppShell
      user={{
        name: me?.display_name ?? user.email ?? 'Member',
        initials: initialsOf(me?.first_name, me?.last_name, me?.display_name ?? user.email ?? 'Member'),
      }}
      tenantName="Albis Wings"
    >
      <div className="max-w-7xl mx-auto px-4 py-6">
        <Link href="/techlog" className="text-feather hover:text-navy-700 text-sm inline-flex items-center gap-1 mb-3">
          ← Zurück zur Flottenübersicht
        </Link>

        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div>
            <h1 className="text-3xl font-semibold text-navy-800">
              Techlog <span className="font-mono">{aircraft.registration}</span>
            </h1>
            <p className="text-feather text-sm">{aircraft.manufacturer} {aircraft.model}</p>
          </div>
          {isAog && (
            <div className="bg-red-600 text-white px-4 py-2 rounded-sm">
              <div className="text-xs uppercase tracking-wider font-bold">Ausser Betrieb</div>
              <div className="text-[11px] opacity-90">Reservation gesperrt bis Eintrag geschlossen</div>
            </div>
          )}
        </div>

        <div className="border-b border-neutral-200 mb-4">
          <div className="flex gap-6">
            <TabLink href={`/techlog/${aircraft_id}`}             active={tab==='techlog'} label="Techlog" />
            <TabLink href={`/techlog/${aircraft_id}?tab=crs`}     active={tab==='crs'}     label="CRS" />
            <TabLink href={`/techlog/${aircraft_id}?tab=ar`}      active={tab==='ar'}      label="ARC" />
          </div>
        </div>

        {tab === 'techlog' && (
          <TechlogList aircraftId={aircraft_id} showHistory={showHistory} />
        )}
        {tab === 'crs' && (
          <CrsList aircraftId={aircraft_id} />
        )}
        {tab === 'ar' && (
          <ArList aircraftId={aircraft_id} />
        )}
      </div>
    </AppShell>
  );
}

function TabLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={`pb-2 text-sm border-b-2 -mb-px transition-colors ${
        active
          ? 'text-navy-800 border-navy-800 font-medium'
          : 'text-neutral-500 hover:text-navy-700 border-transparent'
      }`}
    >
      {label}
    </Link>
  );
}

async function TechlogList({
  aircraftId, showHistory,
}: {
  aircraftId: string;
  showHistory: boolean;
}) {
  const supabase = await createClient();
  let q = supabase
    .from('techlog_entries')
    .select(`
      id, entry_no, item, relevance, state, mel_cdl_ref, mel_category,
      raised_at, raised_by, hobbs_at_raise,
      rectified_at, rectified_by, rectification_text, rectified_hobbs,
      raised_by_user:users!techlog_entries_raised_by_fkey(display_name),
      rectified_by_user:users!techlog_entries_rectified_by_fkey(display_name)
    `)
    .eq('aircraft_id', aircraftId)
    .order('entry_no', { ascending: false });

  if (!showHistory) q = q.eq('state', 'open');

  const { data: entries } = await q;

  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <Link
            href={`/techlog/${aircraftId}/new`}
            className="bg-navy-800 text-cream px-4 py-2 rounded-sm hover:bg-navy-900 text-sm"
          >
            + Neuer Eintrag
          </Link>
          <Link
            href={showHistory ? `/techlog/${aircraftId}` : `/techlog/${aircraftId}?history=1`}
            className="text-sm text-feather hover:text-navy-700 underline"
          >
            {showHistory ? 'Nur offene Einträge' : 'History einblenden'}
          </Link>
        </div>
      </div>

      <div className="border border-neutral-200 rounded-sm overflow-hidden">
        <div className="grid grid-cols-[60px_minmax(300px,1fr)_minmax(280px,1fr)_140px] text-sm">
          <div className="contents text-cream bg-neutral-500 text-[11px] uppercase tracking-wider font-medium">
            <div className="py-2 px-4 bg-neutral-500">No.</div>
            <div className="py-2 px-4 bg-neutral-500">Item</div>
            <div className="py-2 px-4 bg-neutral-500">Action or Comment</div>
            <div className="py-2 px-4 bg-neutral-500">Status</div>
          </div>

          {(entries ?? []).length === 0 && (
            <div className="col-span-4 text-center py-8 text-sm text-neutral-500">
              {showHistory ? 'Keine Einträge.' : 'Keine offenen Einträge — alles in Ordnung.'}
            </div>
          )}

          {(entries ?? []).map((e: any, i: number) => {
            const bg = i % 2 === 0 ? 'bg-white' : 'bg-neutral-50';
            const isClosed = e.state === 'closed';
            const isAog    = e.relevance === 'flight_relevant_aog';
            const isInfo   = e.relevance === 'info';

            const statusLabel = isClosed
              ? (isInfo ? 'For information only' : 'Close')
              : (isAog
                  ? 'Flight Relevant (AOG)'
                  : isInfo
                    ? 'For information only'
                    : 'Not Flight Relevant');

            const statusBg = isClosed
              ? 'bg-emerald-100 text-emerald-900 border-emerald-200'
              : isAog
                ? 'bg-red-100 text-red-900 border-red-200'
                : isInfo
                  ? 'bg-neutral-100 text-neutral-700 border-neutral-200'
                  : 'bg-amber-100 text-amber-900 border-amber-200';

            return (
              <Link
                key={e.id}
                href={`/techlog/${aircraftId}/${e.id}`}
                className="contents group"
              >
                <div className={`py-3 px-4 ${bg} group-hover:bg-cream-50 transition-colors font-mono text-neutral-600`}>
                  {e.entry_no}
                </div>
                <div className={`py-3 px-4 ${bg} group-hover:bg-cream-50 transition-colors`}>
                  <div className="italic text-navy-800">{e.item}</div>
                  <div className="text-[11px] text-neutral-500 mt-1">
                    {e.raised_by_user?.display_name ?? '—'}, {format(new Date(e.raised_at), 'dd.MM.yyyy')}
                    {e.hobbs_at_raise != null && ` · Hobbs ${Number(e.hobbs_at_raise).toFixed(1)}`}
                    {e.mel_cdl_ref && (
                      <> · <span className="font-medium">MEL {e.mel_category && `${e.mel_category} `}{e.mel_cdl_ref}</span></>
                    )}
                  </div>
                </div>
                <div className={`py-3 px-4 ${bg} group-hover:bg-cream-50 transition-colors`}>
                  {e.rectification_text ? (
                    <>
                      <div className="text-navy-800 whitespace-pre-wrap">{e.rectification_text}</div>
                      <div className="text-[11px] text-neutral-500 mt-1">
                        {e.rectified_by_user?.display_name ?? '—'},
                        {e.rectified_at ? ` ${format(new Date(e.rectified_at), 'dd.MM.yyyy')}` : ''}
                        {e.rectified_hobbs != null && ` · Hobbs ${Number(e.rectified_hobbs).toFixed(1)}`}
                      </div>
                    </>
                  ) : (
                    <span className="text-neutral-400">—</span>
                  )}
                </div>
                <div className={`py-3 px-4 ${bg} group-hover:bg-cream-50 transition-colors`}>
                  <span className={`inline-block px-2 py-1 rounded-sm text-[11px] font-medium border ${statusBg}`}>
                    {statusLabel}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}

async function CrsList({ aircraftId }: { aircraftId: string }) {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from('certificates_of_release')
    .select(`
      id, crs_number, issued_at, mechanic_licence_no, work_performed, parts_used,
      hobbs_at_issue, landings_at_issue,
      issued_by_user:users!certificates_of_release_issued_by_fkey(display_name)
    `)
    .eq('aircraft_id', aircraftId)
    .order('issued_at', { ascending: false });

  return (
    <div className="border border-neutral-200 rounded-sm overflow-hidden">
      <div className="grid grid-cols-[120px_minmax(260px,1fr)_minmax(300px,2fr)_120px] text-sm">
        <div className="contents text-cream bg-neutral-500 text-[11px] uppercase tracking-wider font-medium">
          <div className="py-2 px-4 bg-neutral-500">CRS Nr.</div>
          <div className="py-2 px-4 bg-neutral-500">Item</div>
          <div className="py-2 px-4 bg-neutral-500">Action or Comment</div>
          <div className="py-2 px-4 bg-neutral-500">Status</div>
        </div>

        {(rows ?? []).length === 0 && (
          <div className="col-span-4 text-center py-8 text-sm text-neutral-500">
            Keine CRS-Einträge vorhanden.
          </div>
        )}

        {(rows ?? []).map((c: any, i: number) => {
          const bg = i % 2 === 0 ? 'bg-white' : 'bg-neutral-50';
          return (
            <div key={c.id} className="contents">
              <div className={`py-3 px-4 ${bg} font-mono text-neutral-600`}>{c.crs_number}</div>
              <div className={`py-3 px-4 ${bg}`}>
                <div className="text-navy-800 italic">{c.work_performed.split('\n')[0]}</div>
                <div className="text-[11px] text-neutral-500 mt-1">
                  {c.issued_by_user?.display_name ?? '—'} ({c.mechanic_licence_no}), {format(new Date(c.issued_at), 'dd.MM.yyyy')}
                </div>
              </div>
              <div className={`py-3 px-4 ${bg} text-navy-800 whitespace-pre-wrap text-[13px]`}>
                {c.work_performed}
                {c.parts_used && (
                  <div className="mt-2 pt-2 border-t border-neutral-200 text-[12px]">
                    <span className="font-medium text-neutral-600">Parts used:</span>
                    <div className="whitespace-pre-wrap text-neutral-700">{c.parts_used}</div>
                  </div>
                )}
                <div className="mt-2 pt-2 border-t border-neutral-200 text-[11px] text-neutral-500">
                  I certify that the work specified, except as otherwise specified, was carried out i.a.w. Part-ML and in respect to that work, the aircraft is considered ready for release to service.
                  <div className="mt-1">Signed by {c.issued_by_user?.display_name ?? '—'} ({c.mechanic_licence_no}), {format(new Date(c.issued_at), 'dd.MM.yyyy HH:mm')}</div>
                  <div>Hobbs: {Number(c.hobbs_at_issue).toFixed(1)} · Landings: {c.landings_at_issue}</div>
                </div>
              </div>
              <div className={`py-3 px-4 ${bg}`}>
                <span className="inline-block px-2 py-1 rounded-sm text-[11px] font-medium border bg-emerald-100 text-emerald-900 border-emerald-200">
                  CRS – Check
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

async function ArList({ aircraftId }: { aircraftId: string }) {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from('airworthiness_reviews')
    .select(`
      id, arc_number, review_date, arc_valid_until, reviewer_licence_no, findings,
      reviewer:users!airworthiness_reviews_reviewed_by_fkey(display_name)
    `)
    .eq('aircraft_id', aircraftId)
    .order('review_date', { ascending: false });

  const today = new Date();

  return (
    <div className="border border-neutral-200 rounded-sm overflow-hidden">
      <div className="grid grid-cols-[140px_140px_140px_minmax(300px,2fr)_140px] text-sm">
        <div className="contents text-cream bg-neutral-500 text-[11px] uppercase tracking-wider font-medium">
          <div className="py-2 px-4 bg-neutral-500">ARC Nr.</div>
          <div className="py-2 px-4 bg-neutral-500">Datum</div>
          <div className="py-2 px-4 bg-neutral-500">Gültig bis</div>
          <div className="py-2 px-4 bg-neutral-500">Findings</div>
          <div className="py-2 px-4 bg-neutral-500">Status</div>
        </div>

        {(rows ?? []).length === 0 && (
          <div className="col-span-5 text-center py-8 text-sm text-neutral-500">
            Keine Airworthiness Reviews vorhanden.
          </div>
        )}

        {(rows ?? []).map((a: any, i: number) => {
          const bg = i % 2 === 0 ? 'bg-white' : 'bg-neutral-50';
          const valid = new Date(a.arc_valid_until);
          const days  = Math.ceil((valid.getTime() - today.getTime()) / 86400_000);
          const expired = days < 0;
          const soon    = days >= 0 && days <= 60;
          return (
            <div key={a.id} className="contents">
              <div className={`py-3 px-4 ${bg} font-mono text-neutral-600`}>{a.arc_number}</div>
              <div className={`py-3 px-4 ${bg} text-neutral-700`}>{format(new Date(a.review_date), 'dd.MM.yyyy')}</div>
              <div className={`py-3 px-4 ${bg} font-mono ${expired ? 'text-red-700' : soon ? 'text-amber-700' : 'text-neutral-700'}`}>
                {format(valid, 'dd.MM.yyyy')}
                {expired && <div className="text-[10px] uppercase tracking-wider font-semibold">Abgelaufen</div>}
                {soon && !expired && <div className="text-[10px]">in {days}d</div>}
              </div>
              <div className={`py-3 px-4 ${bg}`}>
                <div className="text-navy-800 whitespace-pre-wrap">{a.findings ?? '—'}</div>
                <div className="text-[11px] text-neutral-500 mt-1">
                  Reviewer: {a.reviewer?.display_name ?? '—'} ({a.reviewer_licence_no})
                </div>
              </div>
              <div className={`py-3 px-4 ${bg}`}>
                <span className={`inline-block px-2 py-1 rounded-sm text-[11px] font-medium border ${
                  expired ? 'bg-red-100 text-red-900 border-red-200'
                  : soon ? 'bg-amber-100 text-amber-900 border-amber-200'
                  : 'bg-emerald-100 text-emerald-900 border-emerald-200'
                }`}>
                  {expired ? 'Expired' : soon ? 'Renewal due' : 'Valid'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function initialsOf(first?: string | null, last?: string | null, fallback?: string): string {
  if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
  return (fallback ?? '?').slice(0, 2).toUpperCase();
}
