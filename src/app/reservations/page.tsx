import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { TopNav } from '@/components/TopNav';
import { CalendarSidebar } from '@/components/CalendarSidebar';
import { CalendarToolbar } from '@/components/CalendarToolbar';
import { ModeToggle, type CalendarMode } from '@/components/ModeToggle';
import { DayView } from '@/components/calendar/DayView';
import { WeekView } from '@/components/calendar/WeekView';
import { MonthView } from '@/components/calendar/MonthView';
import { InstructorView, type AvailabilityRow } from '@/components/calendar/InstructorView';
import { getRangeForView, type ViewMode } from '@/lib/calendar';
import type { Aircraft, Instructor, ReservationRow } from '@/lib/types';
import { parse, isValid } from 'date-fns';

export const dynamic = 'force-dynamic';

export default async function ReservationsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; date?: string; ac?: string; fi?: string; mode?: string }>;
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

  const mode: CalendarMode = sp.mode === 'fluglehrer' ? 'fluglehrer' : 'flugzeug';
  const view: ViewMode = sp.view === 'day' || sp.view === 'month' ? sp.view : 'week';
  let anchor = new Date();
  if (sp.date) {
    const parsed = parse(sp.date, 'yyyy-MM-dd', new Date());
    if (isValid(parsed)) anchor = parsed;
  }

  const { from, to } = getRangeForView(view, anchor);

  // Always load aircraft + instructors (sidebar needs them in both modes)
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

  const selectedAircraft = new Set<string>(sp.ac ? sp.ac.split(',') : aircraft.map(a => a.id));
  const selectedInstructorId = sp.fi || null;

  // Fetch reservations for the date range (used by both modes)
  const { data: rRows } = await supabase
    .from('v_reservation_grid')
    .select('*')
    .gte('starts_at', from.toISOString())
    .lte('starts_at', to.toISOString())
    .order('starts_at', { ascending: true });
  const reservations: ReservationRow[] = (rRows ?? []) as ReservationRow[];

  // Fetch instructor availability only in Fluglehrer mode
  let availability: AvailabilityRow[] = [];
  let selectedInstructor: Instructor | null = null;
  if (mode === 'fluglehrer' && selectedInstructorId) {
    selectedInstructor = instructors.find(i => i.id === selectedInstructorId) ?? null;
    const { data: avRows } = await supabase
      .from('instructor_availability')
      .select('id, instructor_id, period, available, note')
      .eq('instructor_id', selectedInstructorId)
      .order('period', { ascending: true });
    availability = (avRows ?? []).map((a: any) => {
      const periodStr: string = a.period as string;
      // Postgres serializes tstzrange as '["2026-05-18 17:00:00+02","2026-05-18 20:00:00+02")'
      const match = periodStr.match(/^[\[\(](.+?),(.+?)[\]\)]$/);
      const startStr = match?.[1].trim().replace(/^"|"$/g, '') ?? '';
      const endStr   = match?.[2].trim().replace(/^"|"$/g, '') ?? '';
      return {
        id: a.id,
        instructor_id: a.instructor_id,
        starts_at: new Date(startStr).toISOString(),
        ends_at:   new Date(endStr).toISOString(),
        available: a.available,
        note: a.note,
      };
    });
  }

  const aircraftForDay = aircraft.filter(a => selectedAircraft.has(a.id));

  return (
    <>
      <TopNav userName={me?.display_name ?? user.email ?? 'Member'} active="reservations" />
      <div className="max-w-[1600px] mx-auto px-4 py-6">
        <div className="mb-4 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-semibold text-navy-800">Reservationen</h1>
            <p className="text-feather">
              {mode === 'flugzeug'
                ? 'Wähle ein Flugzeug & klicke einen freien Slot.'
                : 'Wähle einen Lehrer & einen verfügbaren Slot für eine Schulung.'}
            </p>
          </div>
          <ModeToggle mode={mode} />
        </div>

        <div className="flex border border-neutral-200 rounded-sm overflow-hidden bg-white">
          <CalendarSidebar
            mode={mode}
            aircraft={aircraft}
            instructors={instructors}
            selectedAircraft={selectedAircraft}
            selectedInstructorId={selectedInstructorId}
            myUserId={user.id}
          />
          <div className="flex-1 min-w-0">
            <CalendarToolbar view={view} anchor={anchor} />
            {mode === 'flugzeug' ? (
              <>
                {view === 'day'   && <DayView   date={anchor} aircraft={aircraftForDay} reservations={reservations} myUserId={user.id} highlightedInstructors={new Set()} />}
                {view === 'week'  && <WeekView  anchor={anchor} aircraft={aircraft} selectedAircraftIds={selectedAircraft} reservations={reservations} myUserId={user.id} highlightedInstructors={new Set()} />}
                {view === 'month' && <MonthView anchor={anchor} reservations={reservations} myUserId={user.id} highlightedInstructors={new Set()} />}
              </>
            ) : (
              <InstructorView
                anchor={anchor}
                instructor={selectedInstructor}
                reservations={reservations}
                availability={availability}
                myUserId={user.id}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
