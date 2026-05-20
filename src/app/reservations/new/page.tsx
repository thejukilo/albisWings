import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { TopNav } from '@/components/TopNav';
import { BookingForm } from '@/components/BookingForm';
import type { Aircraft, Instructor } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function NewReservationPage({
  searchParams,
}: {
  searchParams: Promise<{ aircraft?: string; date?: string; hour?: string; purpose?: string; instructor?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase
    .from('users')
    .select('id, display_name')
    .eq('id', user.id)
    .maybeSingle();

  // What roles does the current user have? Drives whether maintenance/standby
  // options appear in the purpose dropdown.
  const { data: myRoles } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id);
  const roles = (myRoles ?? []).map(r => r.role);
  const canBlockAircraft = roles.some(r => ['admin','board','mechanic','cami'].includes(r));

  const sp = await searchParams;

  const { data: aircraftRows } = await supabase
    .from('aircraft')
    .select('id, registration, manufacturer, model, aircraft_class, sort_order')
    .eq('active', true)
    .order('sort_order');

  // Two-step: get instructor user IDs, then fetch their profiles.
  // More reliable than PostgREST embed-with-filter syntax.
  const { data: roleRows } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('role', 'instructor');

  const instructorIds = (roleRows ?? []).map((r) => r.user_id);

  const { data: instructorRows } = instructorIds.length === 0
    ? { data: [] }
    : await supabase
        .from('users')
        .select('id, first_name, last_name, display_name, initials')
        .in('id', instructorIds)
        .eq('active', true)
        .order('last_name');

  const aircraft: Aircraft[] = aircraftRows ?? [];
  const instructors: Instructor[] = (instructorRows ?? []).map((r) => ({
    id: r.id, first_name: r.first_name, last_name: r.last_name,
    display_name: r.display_name, initials: r.initials,
  }));

  let startsAt: string | undefined;
  let endsAt: string | undefined;
  if (sp.date) {
    const hour = sp.hour ? parseInt(sp.hour, 10) : 9;
    const date = sp.date;
    startsAt = `${date}T${hour.toString().padStart(2, '0')}:00`;
    endsAt   = `${date}T${(hour + 2).toString().padStart(2, '0')}:00`;
  }

  return (
    <>
      <TopNav userName={me?.display_name ?? user.email ?? 'Member'} active="reservations" />
      <main className="max-w-7xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-semibold text-navy-800 mb-1">Reservation</h1>
        <p className="text-xl text-feather font-light mb-8">Flugzeug reservieren</p>

        <BookingForm
          aircraft={aircraft}
          instructors={instructors}
          canBlockAircraft={canBlockAircraft}
          pilotName={me?.display_name ?? user.email ?? 'Member'}
          defaults={{
            aircraftId: sp.aircraft,
            startsAt,
            endsAt,
            purpose: sp.purpose,
            instructorId: sp.instructor,
          }}
        />
      </main>
    </>
  );
}
