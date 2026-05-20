import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { TopNav } from '@/components/TopNav';
import { NewFlightForm } from '@/components/NewFlightForm';

export const dynamic = 'force-dynamic';

export default async function NewFlightPage({
  params, searchParams,
}: {
  params: Promise<{ aircraft_id: string }>;
  searchParams: Promise<{ reservationId?: string }>;
}) {
  const { aircraft_id } = await params;
  const sp = await searchParams;
  const reservationId = sp.reservationId || null;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase
    .from('users')
    .select('id, display_name, last_name, first_name')
    .eq('id', user.id)
    .maybeSingle();

  const { data: aircraft } = await supabase
    .from('aircraft')
    .select('id, registration, manufacturer, model, current_ftc, current_hobbs, last_position')
    .eq('id', aircraft_id)
    .maybeSingle();
  if (!aircraft) notFound();

  // Pre-fill from a reservation if linked
  let resPrefill: any = null;
  if (reservationId) {
    const { data: r } = await supabase
      .from('reservations')
      .select('id, pilot_id, instructor_id, purpose, period, accepted_at, returned_at')
      .eq('id', reservationId)
      .maybeSingle();
    if (r) resPrefill = r;
  }

  // Instructors list for the dropdown
  const { data: iidRows } = await supabase.from('user_roles').select('user_id').eq('role', 'instructor');
  const iids = (iidRows ?? []).map(r => r.user_id);
  const { data: instructors } = iids.length > 0
    ? await supabase.from('users').select('id, display_name, last_name, first_name').in('id', iids).eq('active', true).order('last_name')
    : { data: [] };

  // Pilots list (for admin who is logging on someone else's behalf — usually it's just the current user)
  const { data: roleRows } = await supabase.from('user_roles').select('role').eq('user_id', user.id);
  const myRoles = (roleRows ?? []).map(r => r.role);
  const isAdmin = myRoles.some(r => ['admin','board','ops_manager'].includes(r));

  // For non-admin, pilot is locked to themselves. Admin can pick any active user.
  let pilots: any[] = [];
  if (isAdmin) {
    const { data: allPilotRows } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'pilot');
    const pilotIds = (allPilotRows ?? []).map(r => r.user_id);
    const { data: pilotUsers } = pilotIds.length > 0
      ? await supabase.from('users').select('id, display_name, last_name, first_name').in('id', pilotIds).eq('active', true).order('last_name')
      : { data: [] };
    pilots = pilotUsers ?? [];
  }

  return (
    <>
      <TopNav userName={me?.display_name ?? user.email ?? 'Member'} active="flightlog" />
      <div className="max-w-3xl mx-auto px-4 py-6">
        <Link
          href={reservationId ? `/reservations/${reservationId}` : `/flightlog/${aircraft_id}`}
          className="text-feather hover:text-navy-700 text-sm inline-flex items-center gap-1 mb-3"
        >
          ← Zurück
        </Link>

        <div className="mb-5">
          <h1 className="text-3xl font-semibold text-navy-800">Flightlog</h1>
          <p className="text-feather">
            Erfassung eines Flightlogeintrags des Flugzeugs <span className="font-mono">{aircraft.registration}</span>
          </p>
        </div>

        <div className="bg-white border border-neutral-200 rounded-sm p-6">
          <NewFlightForm
            aircraftId={aircraft_id}
            registration={aircraft.registration}
            currentFtc={Number(aircraft.current_ftc ?? 0)}
            currentHobbs={Number(aircraft.current_hobbs ?? 0)}
            lastPosition={aircraft.last_position ?? 'LSZN'}
            me={{ id: user.id, displayName: me?.display_name ?? user.email ?? 'Member' }}
            isAdmin={isAdmin}
            pilots={pilots.map(p => ({ id: p.id, name: p.display_name }))}
            instructors={(instructors ?? []).map(i => ({ id: i.id, name: i.display_name }))}
            reservationId={reservationId}
            reservation={resPrefill ? {
              pilotId: resPrefill.pilot_id,
              instructorId: resPrefill.instructor_id,
              purpose: resPrefill.purpose,
              startsAt: resPrefill.period ? extractStart(resPrefill.period) : null,
              endsAt:   resPrefill.period ? extractEnd(resPrefill.period)   : null,
            } : null}
          />
        </div>
      </div>
    </>
  );
}

// Postgres tstzrange comes back as a string like "[\"2026-06-02 14:00:00+00\",\"2026-06-02 16:00:00+00\")"
function extractStart(periodStr: string): string | null {
  const m = periodStr.match(/\["([^"]+)"/);
  return m ? m[1] : null;
}
function extractEnd(periodStr: string): string | null {
  const m = periodStr.match(/,\s*"([^"]+)"\)/);
  return m ? m[1] : null;
}
