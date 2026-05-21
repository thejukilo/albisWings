import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { ReservationEditForm } from '@/components/ReservationEditForm';
import { ReservationLifecycleActions } from '@/components/ReservationLifecycleActions';
import { AircraftStatusPanel } from '@/components/AircraftStatusPanel';
import { ReservationHistoryPanel } from '@/components/ReservationHistoryPanel';
import { formatLocal } from '@/lib/calendar';
import type { Instructor } from '@/lib/types';
import Link from 'next/link';
import { format } from 'date-fns';

export const dynamic = 'force-dynamic';

const PURPOSE_LABEL: Record<string, string> = {
  privat: 'Privatflug',
  schulung: 'Schulungsflug',
  commercial: 'Kommerziell',
  club: 'Clubflug',
  maintenance: 'Wartung',
  standby: 'Standby',
};

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  tentative:  { label: 'Provisorisch',     cls: 'bg-amber-100 text-amber-900 border-amber-200' },
  confirmed:  { label: 'Bestätigt',        cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  completed:  { label: 'Abgeschlossen',    cls: 'bg-sky-100 text-sky-800 border-sky-200' },
  cancelled:  { label: 'Storniert',        cls: 'bg-neutral-200 text-neutral-700 border-neutral-300' },
  no_show:    { label: 'No-Show',          cls: 'bg-red-100 text-red-800 border-red-200' },
};

type SP = { edit?: string };

export default async function ReservationDetailPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SP>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const editMode = sp.edit === '1';

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase
    .from('users')
    .select('id, display_name, first_name, last_name')
    .eq('id', user.id)
    .maybeSingle();

  const { data: row, error } = await supabase
    .from('v_reservation_grid')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error || !row) notFound();

  // Reservation row from the base table to get accepted_at / returned_at
  const { data: resState } = await supabase
    .from('reservations')
    .select('id, accepted_at, accepted_by, returned_at, returned_by, created_at')
    .eq('id', id)
    .maybeSingle();

  // Pilot + instructor contact info (phone/email)
  const { data: pilotInfo } = row.pilot_id ? await supabase
    .from('users')
    .select('display_name, email, phone')
    .eq('id', row.pilot_id)
    .maybeSingle() : { data: null };

  const { data: instructorInfo } = row.instructor_id ? await supabase
    .from('users')
    .select('display_name, email, phone')
    .eq('id', row.instructor_id)
    .maybeSingle() : { data: null };

  // Permissions
  const isOwner = row.pilot_id === user.id;
  const isAssignedInstructor = row.instructor_id === user.id;
  const { data: roleRows } = await supabase
    .from('user_roles').select('role').eq('user_id', user.id);
  const myRoles = (roleRows ?? []).map(r => r.role);
  const isAdmin = myRoles.includes('admin') || myRoles.includes('board') || myRoles.includes('ops_manager');
  const canEdit = (isOwner || isAssignedInstructor || isAdmin)
    && row.status !== 'cancelled' && row.status !== 'completed';
  const isInvolved = isOwner || isAssignedInstructor || isAdmin;

  // For edit form
  let instructors: Instructor[] = [];
  if (canEdit && editMode) {
    const { data: iidRows } = await supabase
      .from('user_roles').select('user_id').eq('role', 'instructor');
    const ids = (iidRows ?? []).map(r => r.user_id);
    if (ids.length > 0) {
      const { data: iRows } = await supabase
        .from('users')
        .select('id, first_name, last_name, display_name, initials')
        .in('id', ids).eq('active', true).order('last_name');
      instructors = (iRows ?? []).map(r => ({
        id: r.id, first_name: r.first_name, last_name: r.last_name,
        display_name: r.display_name, initials: r.initials,
      }));
    }
  }

  // Aircraft current state
  const { data: aircraft } = await supabase
    .from('aircraft')
    .select('id, registration, manufacturer, model, current_ftc, current_hobbs, total_landings, last_position')
    .eq('id', row.aircraft_id)
    .maybeSingle();

  // Maintenance events for this aircraft
  const { data: maintEvents } = await supabase
    .from('v_next_maintenance')
    .select('id, description, due_at_hours, due_at_date, difference_hours_text, difference_days, current_ftc')
    .eq('aircraft_id', row.aircraft_id);

  // Top 5 open techlog entries
  const { data: techlogTop } = await supabase
    .from('techlog_entries')
    .select(`
      id, entry_no, item, relevance, state, raised_at,
      raised_by_user:users!techlog_entries_raised_by_fkey(display_name)
    `)
    .eq('aircraft_id', row.aircraft_id)
    .eq('state', 'open')
    .order('entry_no', { ascending: false })
    .limit(5);

  // Most recent CRS
  const { data: crsLast } = await supabase
    .from('certificates_of_release')
    .select(`
      id, crs_number, issued_at, mechanic_licence_no, work_performed,
      hobbs_at_issue, landings_at_issue,
      issued_by_user:users!certificates_of_release_issued_by_fkey(display_name)
    `)
    .eq('aircraft_id', row.aircraft_id)
    .order('issued_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Brought forward = sum of last flight's FTC end (= current_ftc)
  // Last flight for the aircraft
  const { data: lastFlight } = await supabase
    .from('flights')
    .select('flight_date, destination_icao, ftc_end, hobbs_end')
    .eq('aircraft_id', row.aircraft_id)
    .order('block_off', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Reservation history events
  const { data: events } = await supabase
    .from('reservation_events')
    .select(`
      id, event_type, details, occurred_at,
      actor:users!reservation_events_actor_id_fkey(display_name)
    `)
    .eq('reservation_id', id)
    .order('occurred_at', { ascending: false });

  const purposeLabel = PURPOSE_LABEL[row.purpose] ?? row.purpose;
  const statusBadge  = STATUS_BADGE[row.status] ?? { label: row.status, cls: 'bg-neutral-100 text-neutral-700 border-neutral-200' };

  return (
    <AppShell
      user={{
        name: me?.display_name ?? user.email ?? 'Member',
        initials: initialsOf(me?.first_name, me?.last_name, me?.display_name ?? user.email ?? 'Member'),
      }}
      tenantName="Albis Wings"
    >
      <div className="max-w-5xl mx-auto px-4 py-6">
        <Link
          href="/reservations"
          className="text-feather hover:text-navy-700 text-sm inline-flex items-center gap-1 mb-4"
        >
          ← Zurück zum Kalender
        </Link>

        <div className="mb-5">
          <h1 className="text-3xl font-semibold text-navy-800">Reservation</h1>
          <p className="text-feather">Hier können Reservationen verwaltet werden.</p>
        </div>

        {/* EDIT MODE */}
        {editMode && canEdit ? (
          <div className="bg-white border border-neutral-200 rounded-sm p-6 mb-6">
            <h2 className="text-xl text-navy-800 mb-4">Reservation bearbeiten</h2>
            <ReservationEditForm
              reservation={{
                id: row.id,
                aircraft_id: row.aircraft_id,
                registration: row.registration,
                starts_at: row.starts_at,
                ends_at: row.ends_at,
                purpose: row.purpose,
                instructor_id: row.instructor_id,
                remarks: row.remarks,
                status: row.status,
              }}
              instructors={instructors}
            />
            <div className="mt-3">
              <Link href={`/reservations/${id}`} className="text-sm text-feather hover:text-navy-700 underline">
                Bearbeitung abbrechen
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* RESERVATIONSDETAILS */}
            <section className="mb-6">
              <h2 className="text-xl text-feather mb-3">Reservationsdetails</h2>
              <div className="bg-white border border-neutral-200 rounded-sm p-5">
                <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-3 text-sm">
                  <DLRow label="Reservationstyp" value={purposeLabel} />
                  <DLRow label="Flugzeug" value={<span className="font-mono">{row.registration}</span>} />
                  <DLRow label="Pilot" value={
                    pilotInfo ? (
                      <div>
                        <div className="font-medium text-navy-800">{pilotInfo.display_name}</div>
                        {pilotInfo.phone && <div className="text-[12px]">Telefon: <a href={`tel:${pilotInfo.phone}`} className="text-feather hover:underline">{pilotInfo.phone}</a></div>}
                        {pilotInfo.email && <div className="text-[12px]">E-Mail: <a href={`mailto:${pilotInfo.email}`} className="text-feather hover:underline">{pilotInfo.email}</a></div>}
                      </div>
                    ) : '—'
                  } />
                  {row.instructor_id && (
                    <DLRow label="Fluglehrer" value={
                      instructorInfo ? (
                        <div>
                          <div className="font-medium text-navy-800">{instructorInfo.display_name}</div>
                          {instructorInfo.phone && <div className="text-[12px]">Telefon: <a href={`tel:${instructorInfo.phone}`} className="text-feather hover:underline">{instructorInfo.phone}</a></div>}
                          {instructorInfo.email && <div className="text-[12px]">E-Mail: <a href={`mailto:${instructorInfo.email}`} className="text-feather hover:underline">{instructorInfo.email}</a></div>}
                        </div>
                      ) : '—'
                    } />
                  )}
                  <DLRow label="Von" value={<span className="font-mono">{formatLocal(row.starts_at, 'dd.MM.yyyy')} {formatLocal(row.starts_at, 'HH:mm')}</span>} />
                  <DLRow label="Bis" value={<span className="font-mono">{formatLocal(row.ends_at, 'dd.MM.yyyy')} {formatLocal(row.ends_at, 'HH:mm')}</span>} />
                  <DLRow label="Status" value={
                    <span className={`inline-block px-2 py-0.5 rounded-sm text-xs font-medium border ${statusBadge.cls}`}>
                      {statusBadge.label}
                    </span>
                  } />
                  {row.remarks && <DLRow label="Bemerkungen" value={<span className="whitespace-pre-wrap">{row.remarks}</span>} />}
                  {resState?.accepted_at && (
                    <DLRow label="Akzeptiert" value={<span className="text-emerald-700">{format(new Date(resState.accepted_at), 'dd.MM.yyyy HH:mm')}</span>} />
                  )}
                  {resState?.returned_at && (
                    <DLRow label="Zurückgebracht" value={<span className="text-sky-700">{format(new Date(resState.returned_at), 'dd.MM.yyyy HH:mm')}</span>} />
                  )}
                </dl>

                {/* Action row */}
                <div className="mt-5 pt-4 border-t border-neutral-200 flex flex-wrap items-center gap-2">
                  <ReservationLifecycleActions
                    reservationId={id}
                    aircraftId={row.aircraft_id}
                    isInvolved={isInvolved}
                    isCancelled={row.status === 'cancelled'}
                    isAccepted={!!resState?.accepted_at}
                    isReturned={!!resState?.returned_at}
                  />
                  {canEdit && (
                    <Link
                      href={`/reservations/${id}?edit=1`}
                      className="px-3 py-1.5 border border-neutral-300 text-navy-800 rounded-sm hover:bg-neutral-50 text-sm"
                    >
                      Editieren
                    </Link>
                  )}
                </div>
              </div>
            </section>

            {/* AIRCRAFT STATUS */}
            <AircraftStatusPanel
              aircraftId={row.aircraft_id}
              registration={row.registration}
              currentFtc={aircraft?.current_ftc ?? null}
              currentHobbs={aircraft?.current_hobbs ?? null}
              totalLandings={aircraft?.total_landings ?? 0}
              lastPosition={aircraft?.last_position ?? null}
              maintenanceEvents={(maintEvents ?? []) as any}
              techlogTop={(techlogTop ?? []) as any}
              crsLast={crsLast as any}
              lastFlight={lastFlight as any}
            />

            {/* HISTORY */}
            <ReservationHistoryPanel events={(events ?? []) as any} />
          </>
        )}
      </div>
    </AppShell>
  );
}

function DLRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <dt className="text-neutral-500 font-medium">{label}</dt>
      <dd className="text-navy-800">{value}</dd>
    </>
  );
}

function initialsOf(first?: string | null, last?: string | null, fallback?: string): string {
  if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
  return (fallback ?? '?').slice(0, 2).toUpperCase();
}
