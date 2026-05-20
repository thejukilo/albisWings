import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { TopNav } from '@/components/TopNav';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

export const dynamic = 'force-dynamic';

const QUICKLINKS = [
  'DABS Today',
  'Aktueller Tür Code: 9832',
  'Zollanmeldung',
  'Roundshot Cam LSZN',
  'AW Safety Policy',
  'Occurrence Report',
  'AirManager Trainingsvideo',
  'Informationen zum Schliesssystem TRAKA21',
  'Karte MWST-befreite Flüge',
];

export default async function CheckInPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase
    .from('users')
    .select('id, first_name, last_name, display_name')
    .eq('id', user.id)
    .maybeSingle();

  // Currency: rolling 90-day SEP landings (delegates to the DB function which
  // counts PIC/PICUS/SOLO/DUAL landings on SEP aircraft).
  const { data: sepLandingsRpc } = await supabase.rpc('sep_landings_90d', { p_user_id: user.id });
  const sepLandings90d = (sepLandingsRpc ?? 0) as number;
  const currencyWarning = sepLandings90d < 3;

  const { data: opsNews } = await supabase
    .from('news_posts')
    .select('id, title, published_at')
    .eq('category', 'ops')
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false })
    .limit(6);

  const { data: generalNews } = await supabase
    .from('news_posts')
    .select('id, title, published_at')
    .eq('category', 'general')
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false })
    .limit(6);

  const { data: events } = await supabase
    .from('news_posts')
    .select('id, title, event_starts_at')
    .eq('category', 'event')
    .not('event_starts_at', 'is', null)
    .gte('event_starts_at', new Date().toISOString())
    .order('event_starts_at', { ascending: true })
    .limit(6);

  const { data: myReservations } = await supabase
    .from('v_reservation_grid')
    .select('id, registration, starts_at, ends_at, purpose, remarks, instructor_name')
    .eq('pilot_id', user.id)
    .gte('starts_at', new Date().toISOString())
    .order('starts_at', { ascending: true })
    .limit(5);

  // Check if current user is an instructor; if so, also fetch upcoming
  // Schulung flights where they're the assigned instructor.
  const { data: myRoles } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id);
  const isInstructor = (myRoles ?? []).some(r => r.role === 'instructor');
  // Only roles that can act on techlog entries see the open-defects banners.
  // Regular pilots and members can't reject/approve/sign-off, so it's just noise.
  const canSeeTechlogIssues = (myRoles ?? []).some(r =>
    ['admin', 'board', 'mechanic', 'cami', 'ops_manager'].includes(r.role)
  );

  const { data: myInstructorFlights } = isInstructor ? await supabase
    .from('v_reservation_grid')
    .select('id, registration, starts_at, ends_at, purpose, remarks, pilot_name')
    .eq('instructor_id', user.id)
    .neq('pilot_id', user.id)   // don't show their own private flights here
    .gte('starts_at', new Date().toISOString())
    .order('starts_at', { ascending: true })
    .limit(8) : { data: null };

  const { data: openDefects } = await supabase
    .from('v_open_techlog')
    .select('aircraft_id, registration, grounding_defects, open_defects')
    .gt('open_defects', 0);

  const { data: aogAircraft } = await supabase
    .from('v_open_techlog')
    .select('aircraft_id, registration, grounding_defects')
    .gt('grounding_defects', 0);

  const userName = me?.display_name ?? user.email ?? 'Member';

  return (
    <>
      <TopNav userName={userName} />

      <main className="max-w-7xl mx-auto px-6 py-10">
        {/* Page heading -- matches existing site's "Check-in / Hier findest Du..." */}
        <div className="mb-8">
          <h1 className="text-4xl font-semibold text-navy-800 mb-1">Check-in</h1>
          <p className="text-2xl text-feather font-light">
            Hier findest Du die wichtigsten Informationen
          </p>
        </div>

        {/* Currency warning -- matches the existing orange banner exactly */}
        {currencyWarning && (
          <div className="mb-3 bg-signal text-white py-2 px-4 text-sm">
            Weniger als 3 SEP Landungen in den letzten 90 Tagen.
            <span className="ml-2 opacity-80">({sepLandings90d} {sepLandings90d === 1 ? 'Landung' : 'Landungen'})</span>
          </div>
        )}

        {/* AOG aircraft — prominent red banner with link */}
        {aogAircraft && aogAircraft.length > 0 && (
          <div className="mb-4 border-l-4 border-red-600 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <span className="bg-red-600 text-white text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-sm flex-shrink-0">
                AOG
              </span>
              <div className="flex-1">
                <div className="text-sm font-semibold text-red-900 mb-1">
                  {aogAircraft.length === 1 ? 'Ein Flugzeug ist ausser Betrieb' : `${aogAircraft.length} Flugzeuge sind ausser Betrieb`}
                </div>
                <div className="text-sm text-red-800">
                  {aogAircraft.map((a, i) => (
                    <span key={a.aircraft_id}>
                      {i > 0 && ', '}
                      <Link href={`/techlog/${a.aircraft_id}`} className="reg-plate hover:underline">
                        {a.registration}
                      </Link>
                      <span className="ml-1 text-red-700 text-xs">
                        ({a.grounding_defects} Grounding-{a.grounding_defects === 1 ? 'Eintrag' : 'Einträge'})
                      </span>
                    </span>
                  ))}
                </div>
                <div className="text-[11px] text-red-700 mt-1">
                  Reservation gesperrt bis Eintrag durch Mechaniker geschlossen.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Open non-AOG defects — only relevant for staff who can act on them */}
        {canSeeTechlogIssues && openDefects && openDefects.length > 0 && (
          <div className="mb-8 border border-signal/40 bg-cream-50 py-2 px-4 text-sm">
            <span className="text-signal-600 font-medium">Offene Techlog-Einträge:</span>
            <span className="ml-2 text-neutral-700">
              {openDefects.map((d, i) => (
                <span key={d.aircraft_id}>
                  {i > 0 && ', '}
                  <Link href={`/techlog/${d.aircraft_id}`} className="reg-plate hover:underline">
                    {d.registration}
                  </Link>
                  <span className="ml-1 text-neutral-500">
                    {d.open_defects} offen{(d.grounding_defects ?? 0) > 0 && `, ${d.grounding_defects} AOG`}
                  </span>
                </span>
              ))}
            </span>
          </div>
        )}

        {/* Two-column news layout, like the existing site */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-10 mb-10">
          <NewsBlock title="OPS News" items={opsNews} type="news" />
          <NewsBlock title="Allgemeine News" items={generalNews} type="news" />
          <NewsBlock title="Events" items={events} type="event" />
          <QuicklinksBlock />
        </div>

        {/* Upcoming student flights (instructors only) */}
        {isInstructor && myInstructorFlights && myInstructorFlights.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xl text-feather mb-3">Bevorstehende Flüge mit Schülern</h2>
            <div className="border border-neutral-200 overflow-hidden">
              <div className="grid grid-cols-[max-content_max-content_max-content_max-content_1fr] text-sm">
                {/* Header */}
                <div className="contents text-navy-800 font-medium">
                  <div className="py-2 px-4 bg-cream">Flugzeug</div>
                  <div className="py-2 px-4 bg-cream">Beginn</div>
                  <div className="py-2 px-4 bg-cream">Schüler</div>
                  <div className="py-2 px-4 bg-cream">Zweck</div>
                  <div className="py-2 px-4 bg-cream">Bemerkung</div>
                </div>
                {/* Rows */}
                {myInstructorFlights.map((r, i) => {
                  const bg = i % 2 === 0 ? 'bg-white' : 'bg-neutral-50';
                  return (
                    <Link
                      key={r.id}
                      href={`/reservations/${r.id}`}
                      className="contents group"
                    >
                      <div className={`py-2 px-4 ${bg} group-hover:bg-cream-50 transition-colors`}>
                        <span className="reg-plate">{r.registration}</span>
                      </div>
                      <div className={`py-2 px-4 text-neutral-700 ${bg} group-hover:bg-cream-50 transition-colors`}>
                        {format(new Date(r.starts_at), 'dd.MM.yyyy HH:mm')}
                      </div>
                      <div className={`py-2 px-4 text-navy-800 ${bg} group-hover:bg-cream-50 transition-colors`}>
                        {r.pilot_name ?? '—'}
                      </div>
                      <div className={`py-2 px-4 ${bg} group-hover:bg-cream-50 transition-colors`}>
                        <PurposeBadge purpose={r.purpose as string} />
                      </div>
                      <div className={`py-2 px-4 text-neutral-700 ${bg} group-hover:bg-cream-50 transition-colors truncate`}>
                        {r.remarks ?? '—'}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* My reservations */}
        <section className="mb-10">
          <h2 className="text-xl text-feather mb-3">Meine Reservationen</h2>
          {myReservations && myReservations.length > 0 ? (
            <div className="border border-neutral-200 overflow-hidden">
              <div className="grid grid-cols-[max-content_max-content_max-content_max-content_max-content_1fr] text-sm">
                {/* Header */}
                <div className="contents text-navy-800 font-medium">
                  <div className="py-2 px-4 bg-cream">Flugzeug</div>
                  <div className="py-2 px-4 bg-cream">Beginn</div>
                  <div className="py-2 px-4 bg-cream">Ende</div>
                  <div className="py-2 px-4 bg-cream">Zweck</div>
                  <div className="py-2 px-4 bg-cream">Lehrer</div>
                  <div className="py-2 px-4 bg-cream">Bemerkung</div>
                </div>
                {/* Rows */}
                {myReservations.map((r, i) => {
                  const bg = i % 2 === 0 ? 'bg-white' : 'bg-neutral-50';
                  return (
                    <Link
                      key={r.id}
                      href={`/reservations/${r.id}`}
                      className="contents group"
                    >
                      <div className={`py-2 px-4 ${bg} group-hover:bg-cream-50 transition-colors`}>
                        <span className="reg-plate">{r.registration}</span>
                      </div>
                      <div className={`py-2 px-4 text-neutral-700 ${bg} group-hover:bg-cream-50 transition-colors`}>
                        {format(new Date(r.starts_at), 'dd.MM.yyyy HH:mm')}
                      </div>
                      <div className={`py-2 px-4 text-neutral-700 ${bg} group-hover:bg-cream-50 transition-colors`}>
                        {format(new Date(r.ends_at), 'dd.MM.yyyy HH:mm')}
                      </div>
                      <div className={`py-2 px-4 ${bg} group-hover:bg-cream-50 transition-colors`}>
                        <PurposeBadge purpose={r.purpose as string} />
                      </div>
                      <div className={`py-2 px-4 text-neutral-700 ${bg} group-hover:bg-cream-50 transition-colors`}>
                        {r.instructor_name ?? '—'}
                      </div>
                      <div className={`py-2 px-4 text-neutral-700 ${bg} group-hover:bg-cream-50 transition-colors truncate`}>
                        {r.remarks ?? '—'}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-500">
              Keine Einträge gefunden
            </div>
          )}
        </section>
      </main>
    </>
  );
}

function NewsBlock({
  title,
  items,
  type,
}: {
  title: string;
  items: { id: string; title: string; published_at?: string | null; event_starts_at?: string | null }[] | null;
  type: 'news' | 'event';
}) {
  return (
    <section>
      <h2 className="text-xl text-feather mb-3">{title}</h2>
      {items && items.length > 0 ? (
        <ul className="divide-y divide-neutral-200 border border-neutral-200">
          {items.map((item, i) => {
            const dateStr = type === 'event' ? item.event_starts_at : item.published_at;
            return (
              <li
                key={item.id}
                className={`px-4 py-2 text-sm ${i % 2 === 0 ? 'bg-white' : 'bg-neutral-50'} ${i === 0 ? 'font-medium text-navy-800' : 'text-neutral-700'}`}
              >
                {dateStr && (
                  <span className="text-neutral-500 mr-2">
                    {format(new Date(dateStr), 'dd.MM.yyyy', { locale: de })} -
                  </span>
                )}
                <span>{item.title}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-500">
          Keine Einträge gefunden
        </div>
      )}
    </section>
  );
}

function QuicklinksBlock() {
  return (
    <section>
      <h2 className="text-xl text-feather mb-3">Quicklinks</h2>
      <ul className="space-y-1">
        {QUICKLINKS.map((q) => (
          <li key={q}>
            <a
              href="#"
              className="text-sm text-feather-600 hover:text-signal-600 underline decoration-feather/40 underline-offset-2"
            >
              {q}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PurposeBadge({ purpose }: { purpose: string }) {
  const colors: Record<string, string> = {
    schulung:    'bg-feather/15 text-feather-600',
    privat:      'bg-emerald-100 text-emerald-800',
    kommerziell: 'bg-signal-50 text-signal-600',
    clubflug:    'bg-navy-100 text-navy-800',
    maintenance: 'bg-red-100 text-red-700',
    standby:     'bg-yellow-100 text-yellow-800',
  };
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-sm text-xs font-medium ${
        colors[purpose] ?? 'bg-neutral-100 text-neutral-700'
      }`}
    >
      {purpose}
    </span>
  );
}
