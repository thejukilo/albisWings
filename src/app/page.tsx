import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
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

  // Currency: rolling 90-day SEP landings as PIC/PICUS/SOLO
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 10);
  const { data: myLandings } = await supabase
    .from('flight_pilots')
    .select('landings_logged, function, flight:flights!inner(flight_date, aircraft:aircraft!inner(aircraft_class))')
    .eq('user_id', user.id)
    .in('function', ['PIC', 'PICUS', 'SOLO'])
    .gte('flight.flight_date', ninetyDaysAgo);

  const sepLandings90d = (myLandings ?? [])
    // @ts-expect-error nested filter
    .filter((row) => row.flight?.aircraft?.aircraft_class === 'SEP')
    .reduce((sum, row) => sum + (row.landings_logged ?? 0), 0);

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
    .select('id, registration, starts_at, ends_at, purpose, remarks')
    .eq('pilot_id', user.id)
    .gte('starts_at', new Date().toISOString())
    .order('starts_at', { ascending: true })
    .limit(5);

  const { data: openDefects } = await supabase
    .from('v_open_techlog')
    .select('aircraft_id, registration, grounding_defects, open_defects')
    .gt('open_defects', 0);

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

        {/* Open techlog -- styled like the salmon alert box in the screenshot */}
        {openDefects && openDefects.length > 0 && (
          <div className="mb-8 border border-signal/40 bg-cream-50 py-2 px-4 text-sm">
            <span className="text-signal-600 font-medium">Offene Techlog-Einträge:</span>
            <span className="ml-2 text-neutral-700">
              {openDefects.map((d, i) => (
                <span key={d.aircraft_id}>
                  {i > 0 && ', '}
                  <span className="reg-plate">{d.registration}</span>
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

        {/* My reservations */}
        <section className="mb-10">
          <h2 className="text-xl text-feather mb-3">Meine Reservationen</h2>
          {myReservations && myReservations.length > 0 ? (
            <div className="border border-neutral-200 overflow-hidden">
              <table className="w-full text-sm tab-data">
                <thead>
                  <tr className="bg-cream text-navy-800 text-left">
                    <th className="py-2 px-4 font-medium">Flugzeug</th>
                    <th className="py-2 px-4 font-medium">Beginn</th>
                    <th className="py-2 px-4 font-medium">Ende</th>
                    <th className="py-2 px-4 font-medium">Zweck</th>
                    <th className="py-2 px-4 font-medium">Bemerkung</th>
                  </tr>
                </thead>
                <tbody>
                  {myReservations.map((r, i) => (
                    <tr
                      key={r.id}
                      className={i % 2 === 0 ? 'bg-white' : 'bg-neutral-50'}
                    >
                      <td className="py-2 px-4"><span className="reg-plate">{r.registration}</span></td>
                      <td className="py-2 px-4 text-neutral-700">{format(new Date(r.starts_at), 'dd.MM.yyyy HH:mm')}</td>
                      <td className="py-2 px-4 text-neutral-700">{format(new Date(r.ends_at), 'dd.MM.yyyy HH:mm')}</td>
                      <td className="py-2 px-4"><PurposeBadge purpose={r.purpose as string} /></td>
                      <td className="py-2 px-4 text-neutral-700">{r.remarks ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
