import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { Dashboard } from '@/components/Dashboard';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase
    .from('users')
    .select('id, display_name, first_name, last_name')
    .eq('id', user.id)
    .maybeSingle();

  const { data: myRoles } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id);
  const roles = (myRoles ?? []).map(r => r.role);
  const isStaff = roles.some(r => ['admin', 'board', 'mechanic', 'cami', 'ops_manager'].includes(r));
  const isInstructor = roles.includes('instructor');

  // Upcoming reservations (next 7 days)
  const now = new Date().toISOString();
  const nowPlus7 = new Date(Date.now() + 7 * 86400_000).toISOString();
  const { data: upcoming } = await supabase
    .from('v_reservation_grid')
    .select('id, registration, starts_at, ends_at, purpose, instructor_id, instructor_name')
    .eq('pilot_id', user.id)
    .gte('starts_at', now)
    .lte('starts_at', nowPlus7)
    .neq('status', 'cancelled')
    .order('starts_at')
    .limit(8);

  // SEP currency
  const { data: sepLandings } = await supabase.rpc('sep_landings_90d', { p_user_id: user.id });
  const sepLandings90d = (sepLandings ?? 0) as number;

  // Fleet
  const { data: aircraft } = await supabase
    .from('aircraft')
    .select('id, registration, manufacturer, model, current_ftc, current_hobbs, total_landings, last_position')
    .eq('active', true)
    .order('sort_order');

  // AOG
  const { data: aogRows } = await supabase
    .from('v_open_techlog')
    .select('aircraft_id, registration, grounding_defects')
    .gt('grounding_defects', 0);
  const aogSet = new Set((aogRows ?? []).map(r => r.aircraft_id));

  // Open techlog — staff only
  let openTechlog: { aircraft_id: string; registration: string; open_defects: number }[] = [];
  if (isStaff) {
    const { data: ot } = await supabase
      .from('v_open_techlog')
      .select('aircraft_id, registration, open_defects')
      .gt('open_defects', 0);
    openTechlog = (ot ?? []) as any;
  }

  // Recent activity
  const { data: recentFlights } = await supabase
    .from('flights')
    .select('id, flight_date, aircraft_id, origin_icao, destination_icao, block_off, landing')
    .order('block_off', { ascending: false })
    .limit(5);

  return (
    <AppShell
      user={{
        name: me?.display_name ?? user.email ?? 'Member',
        initials: initialsOf(me?.first_name, me?.last_name, me?.display_name ?? user.email ?? '?'),
      }}
      tenantName="Albis Wings"
    >
      <Dashboard
        userName={me?.first_name ?? me?.display_name ?? 'Pilot'}
        sepLandings90d={sepLandings90d}
        upcoming={upcoming ?? []}
        aircraft={(aircraft ?? []).map(a => ({
          id: a.id,
          registration: a.registration,
          manufacturer: a.manufacturer ?? '',
          model: a.model ?? '',
          currentFtc: a.current_ftc ?? null,
          currentHobbs: a.current_hobbs ?? null,
          totalLandings: a.total_landings ?? 0,
          lastPosition: a.last_position ?? null,
          isAog: aogSet.has(a.id),
        }))}
        aogList={(aogRows ?? []).map(r => ({ id: r.aircraft_id, registration: r.registration, count: r.grounding_defects }))}
        openTechlog={openTechlog}
        recentFlights={(recentFlights ?? []) as any}
        isStaff={isStaff}
        isInstructor={isInstructor}
      />
    </AppShell>
  );
}

function initialsOf(first: string | null | undefined, last: string | null | undefined, fallback: string): string {
  if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
  return fallback.slice(0, 2).toUpperCase();
}
