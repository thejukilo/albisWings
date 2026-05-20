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

  // Normalize URL params
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

  // Parse filter sets
  const selectedAircraft = new Set<string>(sp.ac ? sp.ac.split(',') : aircraft.map(a => a.id));
  const selectedInstructors = new Set<string>(sp.fi ? sp.fi.split(',') : []);

  // Fetch reservations for the range, applying filters
  let q = supabase
    .from('v_reservation_grid')
    .select('*')
    .gte('starts_at', from.toISOString())
    .lte('starts_at', to.toISOString())
    .order('starts_at', { ascending: true });
  if (selectedAircraft.size > 0 && selectedAircraft.size < aircraft.length) {
    q = q.in('aircraft_id', Array.from(selectedAircraft));
  }
  if (selectedInstructors.size > 0) {
    q = q.in('instructor_id', Array.from(selectedInstructors));
  }
  const { data: rRows } = await q;
  const reservations: ReservationRow[] = (rRows ?? []) as ReservationRow[];

  // For Day view we may want to filter aircraft list to selected ones for cleaner UI
  const aircraftForGrid = view === 'day'
    ? aircraft.filter(a => selectedAircraft.has(a.id))
    : aircraft;

  return (
    <>
      <TopNav userName={me?.display_name ?? user.email ?? 'Member'} active="reservations" />
      <div className="max-w-[1400px] mx-auto px-4 py-6">
        <div className="mb-5">
          <h1 className="text-3xl font-semibold text-navy-800">Reservationen</h1>
          <p className="text-feather">Klicke einen freien Slot um zu reservieren.</p>
        </div>

        <div className="flex border border-neutral-200 rounded-sm overflow-hidden bg-white">
          <CalendarSidebar
            aircraft={aircraft}
            instructors={instructors}
            selectedAircraft={selectedAircraft}
            selectedInstructors={selectedInstructors}
            myUserId={user.id}
          />
          <div className="flex-1 min-w-0">
            <CalendarToolbar view={view} anchor={anchor} />
            {view === 'day'   && <DayView   date={anchor} aircraft={aircraftForGrid} reservations={reservations} myUserId={user.id} />}
            {view === 'week'  && <WeekView  anchor={anchor} reservations={reservations} myUserId={user.id} />}
            {view === 'month' && <MonthView anchor={anchor} reservations={reservations} myUserId={user.id} />}
          </div>
        </div>
      </div>
    </>
  );
}
