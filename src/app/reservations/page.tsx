import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { TopNav } from '@/components/TopNav';
import { CalendarSidebar } from '@/components/CalendarSidebar';
import { CalendarToolbar } from '@/components/CalendarToolbar';
import { DayView } from '@/components/calendar/DayView';
import { WeekView } from '@/components/calendar/WeekView';
import { MonthView } from '@/components/calendar/MonthView';
import { getRangeForView, type ViewMode } from '@/lib/calendar';
import type { Aircraft, Instructor, ReservationRow } from '@/lib/types';
import { parse, isValid } from 'date-fns';

export const dynamic = 'force-dynamic';

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string; ac?: string; fi?: string }>;
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

  const view: ViewMode = sp.view === 'day' || sp.view === 'month' ? sp.view : 'week';
  let anchor = new Date();
  if (sp.date) {
    const parsed = parse(sp.date, 'yyyy-MM-dd', new Date());
    if (isValid(parsed)) anchor = parsed;
  }

  const { from, to } = getRangeForView(view, anchor);

  // Fetch aircraft + instructors for sidebar
  const { data: aircraftRows } = await supabase
    .from('aircraft')
    .select('id, registration, manufacturer, model, aircraft_class, sort_order')
    .eq('active', true)
    .order('sort_order', { ascending: true })
    .order('registration', { ascending: true });

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

  // Aircraft filter still hides aircraft columns. Instructor "filter" now only
  // highlights -- it never removes events from the SQL query.
  const selectedAircraft = new Set<string>(sp.ac ? sp.ac.split(',') : aircraft.map(a => a.id));
  const highlightedInstructors = new Set<string>(sp.fi ? sp.fi.split(',') : []);

  // Fetch reservations for the range. We always fetch all aircraft because
  // the highlight feature needs to show instructor bookings even on hidden
  // aircraft columns. The view itself decides what to render.
  const { data: rRows } = await supabase
    .from('v_reservation_grid')
    .select('*')
    .gte('starts_at', from.toISOString())
    .lte('starts_at', to.toISOString())
    .order('starts_at', { ascending: true });
  const reservations: ReservationRow[] = (rRows ?? []) as ReservationRow[];

  // For Day view, the aircraft list passed down is filtered to selected ones
  // (column count drops). Week view keeps all 5 lanes per day, but applies
  // a hidden style to unselected ones inside the view.
  const aircraftForDay = aircraft.filter(a => selectedAircraft.has(a.id));

  return (
    <>
      <TopNav userName={me?.display_name ?? user.email ?? 'Member'} active="reservations" />
      <div className="max-w-[1600px] mx-auto px-4 py-6">
        <div className="mb-5">
          <h1 className="text-3xl font-semibold text-navy-800">Reservationen</h1>
          <p className="text-feather">Klicke einen freien Slot um zu reservieren.</p>
        </div>

        <div className="flex border border-neutral-200 rounded-sm overflow-hidden bg-white">
          <CalendarSidebar
            aircraft={aircraft}
            instructors={instructors}
            selectedAircraft={selectedAircraft}
            highlightedInstructors={highlightedInstructors}
            myUserId={user.id}
          />
          <div className="flex-1 min-w-0">
            <CalendarToolbar view={view} anchor={anchor} />
            {view === 'day'   && <DayView   date={anchor} aircraft={aircraftForDay} reservations={reservations} myUserId={user.id} highlightedInstructors={highlightedInstructors} />}
            {view === 'week'  && <WeekView  anchor={anchor} aircraft={aircraft} selectedAircraftIds={selectedAircraft} reservations={reservations} myUserId={user.id} highlightedInstructors={highlightedInstructors} />}
            {view === 'month' && <MonthView anchor={anchor} reservations={reservations} myUserId={user.id} highlightedInstructors={highlightedInstructors} />}
          </div>
        </div>
      </div>
    </>
  );
}
