import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { TopNav } from '@/components/TopNav';
import { ReservationDetail } from '@/components/ReservationDetail';
import { ReservationEditForm } from '@/components/ReservationEditForm';
import type { Instructor } from '@/lib/types';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function ReservationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase
    .from('users')
    .select('id, display_name')
    .eq('id', user.id)
    .maybeSingle();

  // Fetch the reservation from the view (gives us joined pilot_name + instructor_name + registration)
  const { data: row, error } = await supabase
    .from('v_reservation_grid')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error || !row) notFound();

  // Check if current user can edit
  const isOwner = row.pilot_id === user.id;
  const { data: roleRows } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id);
  const myRoles = (roleRows ?? []).map(r => r.role);
  const isAdmin = myRoles.includes('admin') || myRoles.includes('board') || myRoles.includes('ops_manager');
  const canEdit = (isOwner || isAdmin) && row.status !== 'cancelled' && row.status !== 'completed';

  // For edit form, we need the list of instructors
  let instructors: Instructor[] = [];
  if (canEdit) {
    const { data: instructorIdRows } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'instructor');
    const ids = (instructorIdRows ?? []).map(r => r.user_id);
    if (ids.length > 0) {
      const { data: iRows } = await supabase
        .from('users')
        .select('id, first_name, last_name, display_name, initials')
        .in('id', ids)
        .eq('active', true)
        .order('last_name');
      instructors = (iRows ?? []).map(r => ({
        id: r.id, first_name: r.first_name, last_name: r.last_name,
        display_name: r.display_name, initials: r.initials,
      }));
    }
  }

  return (
    <>
      <TopNav userName={me?.display_name ?? user.email ?? 'Member'} active="reservations" />
      <div className="max-w-3xl mx-auto px-4 py-6">
        <Link
          href="/reservations"
          className="text-feather hover:text-navy-700 text-sm inline-flex items-center gap-1 mb-4"
        >
          ← Zurück zum Kalender
        </Link>

        <div className="mb-4">
          <h1 className="text-3xl font-semibold text-navy-800">Reservation</h1>
          <p className="text-feather text-sm">
            {canEdit
              ? 'Sie können diese Reservation bearbeiten oder stornieren.'
              : isOwner
                ? 'Diese Reservation ist nicht mehr veränderbar.'
                : 'Diese Reservation gehört einem anderen Mitglied.'}
          </p>
        </div>

        <div className="bg-white border border-neutral-200 rounded-sm p-6">
          {canEdit ? (
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
          ) : (
            <ReservationDetail
              reservation={{
                id: row.id,
                registration: row.registration,
                pilot_name: row.pilot_name,
                instructor_name: row.instructor_name,
                starts_at: row.starts_at,
                ends_at: row.ends_at,
                purpose: row.purpose,
                status: row.status,
                remarks: row.remarks,
              }}
            />
          )}
        </div>
      </div>
    </>
  );
}
