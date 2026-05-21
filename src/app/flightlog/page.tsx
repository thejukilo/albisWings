import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
export const dynamic = 'force-dynamic';

export default async function FlightlogIndexPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase
    .from('users')
    .select('id, display_name, first_name, last_name')
    .eq('id', user.id)
    .maybeSingle();

  const { data: aircraft } = await supabase
    .from('aircraft')
    .select('id, registration, manufacturer, model, current_ftc, current_hobbs, total_landings, last_position')
    .eq('active', true)
    .order('sort_order');

  // Per-aircraft flight count (last 30 days) for the "Aktivität" badge
  const since = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
  const { data: recent } = await supabase
    .from('flights')
    .select('aircraft_id')
    .gte('flight_date', since);
  const recentCount = new Map<string, number>();
  for (const r of recent ?? []) {
    recentCount.set(r.aircraft_id, (recentCount.get(r.aircraft_id) ?? 0) + 1);
  }

  return (
    <AppShell
      user={{
        name: me?.display_name ?? user.email ?? 'Member',
        initials: initialsOf(me?.first_name, me?.last_name, me?.display_name ?? user.email ?? 'Member'),
      }}
      tenantName="Albis Wings"
    >
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-navy-800">Flightlog</h1>
          <p className="text-feather text-sm">
            Wählen Sie ein Flugzeug, um den vollständigen Flightlog einzusehen.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(aircraft ?? []).map((a) => {
            const n30 = recentCount.get(a.id) ?? 0;
            return (
              <Link
                key={a.id}
                href={`/flightlog/${a.id}`}
                className="block border-2 border-neutral-200 hover:border-neutral-400 bg-white rounded-sm p-5 transition-all hover:shadow-md hover:-translate-y-px"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="text-2xl font-mono font-semibold text-navy-800">{a.registration}</div>
                    <div className="text-xs text-neutral-500">{a.manufacturer} {a.model}</div>
                  </div>
                  <span className="bg-neutral-100 text-neutral-700 text-[10px] uppercase tracking-wider px-2 py-1 rounded-sm">
                    {n30} {n30 === 1 ? 'Flug' : 'Flüge'} · 30d
                  </span>
                </div>

                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                  <dt className="text-neutral-500">Position</dt>
                  <dd className="font-mono text-navy-800 text-right">{a.last_position ?? '—'}</dd>
                  <dt className="text-neutral-500">FTC</dt>
                  <dd className="font-mono text-navy-800 text-right">{a.current_ftc != null ? Number(a.current_ftc).toFixed(2) : '—'}</dd>
                  <dt className="text-neutral-500">Hobbs</dt>
                  <dd className="font-mono text-navy-800 text-right">{a.current_hobbs != null ? Number(a.current_hobbs).toFixed(2) : '—'}</dd>
                  <dt className="text-neutral-500">Landings (total)</dt>
                  <dd className="font-mono text-navy-800 text-right">{a.total_landings}</dd>
                </dl>
              </Link>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}

function initialsOf(first?: string | null, last?: string | null, fallback?: string): string {
  if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
  return (fallback ?? '?').slice(0, 2).toUpperCase();
}
