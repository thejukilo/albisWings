import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { CalendarSidebar } from '@/components/CalendarSidebar';
import { CalendarToolbar } from '@/components/CalendarToolbar';
import { SchulungModeToggle } from '@/components/ModeToggle';
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
    .select('id, display_name, first_name, last_name')
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
  const isInstructor = instructorIds.includes(user.id);

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
  const schulungInstructorId = sp.fi || null;

  const { data: rRows } = await supabase
    .from('v_reservation_grid')
    .select('*')
    .gte('starts_at', from.toISOString())
    .lte('starts_at', to.toISOString())
    .order('starts_at', { ascending: true });
  const reservations: ReservationRow[] = (rRows ?? []) as ReservationRow[];

  // AOG aircraft: any with open Flight Relevant techlog entries
  const { data: aogRows } = await supabase
    .from('v_open_techlog')
    .select('aircraft_id, grounding_defects')
    .gt('grounding_defects', 0);
  const aogAircraftIds = new Set<string>((aogRows ?? []).map(r => r.aircraft_id));

  const aircraftForDay = aircraft.filter(a => selectedAircraft.has(a.id));

  return (
    <AppShell
      user={{
        name: me?.display_name ?? user.email ?? 'Member',
        initials: initialsOf(me?.first_name, me?.last_name, me?.display_name ?? user.email ?? 'Member'),
      }}
      tenantName="Albis Wings"
    >
      <div className="max-w-[1600px] mx-auto px-4 py-6">
        <div className="mb-4 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-semibold text-navy-800">Reservationen</h1>
            <p className="text-feather">
              {schulungInstructorId
                ? 'Rot markierte Stunden sind bereits mit dem Lehrer belegt.'
                : 'Klicke einen freien Slot um zu reservieren.'}
            </p>
          </div>
          <SchulungModeToggle instructors={instructors} selectedInstructorId={schulungInstructorId} />
        </div>

        <div className="flex border border-neutral-200 rounded-sm overflow-hidden bg-white">
          <CalendarSidebar
            aircraft={aircraft}
            instructors={instructors}
            selectedAircraft={selectedAircraft}
            schulungInstructorId={schulungInstructorId}
            myUserId={user.id}
            isInstructor={isInstructor}
          />
          <div className="flex-1 min-w-0">
            <CalendarToolbar view={view} anchor={anchor} />
            {view === 'day'   && <DayView   date={anchor} aircraft={aircraftForDay} reservations={reservations} myUserId={user.id} schulungInstructorId={schulungInstructorId} aogAircraftIds={aogAircraftIds} />}
            {view === 'week'  && <WeekView  anchor={anchor} aircraft={aircraft} selectedAircraftIds={selectedAircraft} reservations={reservations} myUserId={user.id} schulungInstructorId={schulungInstructorId} aogAircraftIds={aogAircraftIds} />}
            {view === 'month' && <MonthView anchor={anchor} reservations={reservations} myUserId={user.id} />}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function initialsOf(first?: string | null, last?: string | null, fallback?: string): string {
  if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
  return (fallback ?? '?').slice(0, 2).toUpperCase();
}
