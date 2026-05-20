import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { TopNav } from '@/components/TopNav';
import { BookingForm } from '@/components/BookingForm';
import type { Aircraft, Instructor } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function NewReservationPage({
  searchParams,
}: {
  searchParams: Promise<{ aircraft?: string; date?: string; hour?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase
    .from('users')
    .select('id, display_name')
    .eq('id', user.id)
    .maybeSingle();

  const sp = await searchParams;

  const { data: aircraftRows } = await supabase
    .from('aircraft')
    .select('id, registration, manufacturer, model, aircraft_class, sort_order')
    .eq('active', true)
    .order('sort_order');

  const { data: instructorRows } = await supabase
    .from('users')
    .select('id, first_name, last_name, display_name, initials, user_roles!inner(role)')
    .eq('user_roles.role', 'instructor')
    .eq('active', true)
    .order('last_name');

  const aircraft: Aircraft[] = aircraftRows ?? [];
  const instructors: Instructor[] = (instructorRows ?? []).map((r) => ({
    id: r.id, first_name: r.first_name, last_name: r.last_name,
    display_name: r.display_name, initials: r.initials,
  }));

  // Build defaults from URL parameters
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
        <div className="text-sm text-neutral-500 mb-3">
          <Link href="/reservations" className="text-feather-600 underline decoration-feather/40 underline-offset-2">
            Reservationen
          </Link>
          <span className="mx-2">·</span>
          <span>Neue Reservation</span>
        </div>

        <h1 className="text-3xl font-semibold text-navy-800 mb-1">Neue Reservation</h1>
        <p className="text-feather mb-8">Bitte fülle die Angaben unten aus.</p>

        <BookingForm
          aircraft={aircraft}
          instructors={instructors}
          defaults={{
            aircraftId: sp.aircraft,
            startsAt,
            endsAt,
          }}
        />
      </main>
    </>
  );
}
