'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

export type CreateReservationInput = {
  aircraftId:    string;
  startsAt:      string;   // ISO
  endsAt:        string;   // ISO
  purpose:       string;
  instructorId?: string | null;
  remarks?:      string;
  originIcao?:   string;
  destinationIcao?: string;
};

export type CreateReservationResult =
  | { ok: true; id: string }
  | { ok: false; blockers: { code: string; label: string; detail: string }[] };

export async function createReservation(input: CreateReservationInput): Promise<CreateReservationResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, blockers: [{ code: 'auth', label: 'Auth', detail: 'Nicht angemeldet' }] };

  // 1. Run pre-flight checks on the database (server-side, can't be bypassed)
  const period = `[${input.startsAt},${input.endsAt})`;
  const { data: findings, error: checkErr } = await supabase.rpc('preflight_check', {
    p_pilot_id: user.id,
    p_aircraft_id: input.aircraftId,
    p_period: period,
    p_purpose: input.purpose,
    p_instructor_id: input.instructorId ?? null,
  });

  if (checkErr) {
    return { ok: false, blockers: [{ code: 'rpc_error', label: 'System', detail: checkErr.message }] };
  }

  const blockers = (findings ?? []).filter((f: any) => f.severity === 'block');
  if (blockers.length > 0) {
    return { ok: false, blockers: blockers.map((b: any) => ({ code: b.code, label: b.label, detail: b.detail })) };
  }

  // 2. Insert. RLS still enforces pilot_id == auth.uid().
  const { data: inserted, error: insErr } = await supabase
    .from('reservations')
    .insert({
      aircraft_id: input.aircraftId,
      pilot_id: user.id,
      instructor_id: input.instructorId || null,
      period,
      purpose: input.purpose,
      status: 'confirmed',
      origin_icao: input.originIcao || null,
      destination_icao: input.destinationIcao || null,
      remarks: input.remarks || null,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (insErr) {
    // Friendly German messages for known Postgres errors
    let detail = insErr.message;
    if (insErr.code === '23P01' || insErr.message.includes('reservations_aircraft_id_period_excl')) {
      detail = 'Es existiert bereits eine Reservation für dieses Flugzeug im gewählten Zeitfenster.';
    } else if (insErr.code === '23503') {
      detail = 'Referenz-Fehler: Flugzeug oder Pilot wurde nicht gefunden.';
    } else if (insErr.code === '23514') {
      detail = 'Die eingegebenen Werte erfüllen nicht alle Anforderungen.';
    }
    return { ok: false, blockers: [{ code: 'insert_error', label: 'Speichern', detail }] };
  }

  revalidatePath('/reservations');
  revalidatePath('/');
  return { ok: true, id: inserted.id };
}

// =============================================================================
// Update
// =============================================================================

export type UpdateReservationInput = {
  id:            string;
  startsAt:      string;
  endsAt:        string;
  purpose:       string;
  instructorId?: string | null;
  remarks?:      string;
};

export async function updateReservation(input: UpdateReservationInput): Promise<CreateReservationResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, blockers: [{ code: 'auth', label: 'Auth', detail: 'Nicht angemeldet' }] };

  // Load existing reservation to learn aircraft + pilot (needed for the preflight check)
  const { data: existing, error: loadErr } = await supabase
    .from('reservations')
    .select('id, pilot_id, aircraft_id, status')
    .eq('id', input.id)
    .maybeSingle();
  if (loadErr || !existing) {
    return { ok: false, blockers: [{ code: 'not_found', label: 'Reservation', detail: 'Reservation nicht gefunden.' }] };
  }
  if (existing.status === 'cancelled') {
    return { ok: false, blockers: [{ code: 'cancelled', label: 'Reservation', detail: 'Diese Reservation ist storniert und kann nicht mehr bearbeitet werden.' }] };
  }

  const pilotId = existing.pilot_id; // for maintenance/standby this can be null
  const period = `[${input.startsAt},${input.endsAt})`;

  // For non-system reservations, run preflight against the OWNER's credentials.
  // The PG function ignores rules for maintenance/standby; we still run it for
  // slot-conflict detection.
  if (pilotId) {
    const { data: findings, error: checkErr } = await supabase.rpc('preflight_check', {
      p_pilot_id: pilotId,
      p_aircraft_id: existing.aircraft_id,
      p_period: period,
      p_purpose: input.purpose,
      p_instructor_id: input.instructorId ?? null,
    });
    if (checkErr) return { ok: false, blockers: [{ code: 'rpc_error', label: 'System', detail: checkErr.message }] };
    // The slot-conflict check will fire for *this* reservation's own period
    // because preflight doesn't know to exclude us. Filter that out.
    const realBlockers = (findings ?? []).filter((f: any) =>
      f.severity === 'block' && f.code !== 'slot_taken'
    );
    if (realBlockers.length > 0) {
      return { ok: false, blockers: realBlockers.map((b: any) => ({ code: b.code, label: b.label, detail: b.detail })) };
    }
  }

  // Perform the update. RLS enforces that pilot_id === auth.uid() OR caller is admin/board.
  const { error: updErr } = await supabase
    .from('reservations')
    .update({
      period,
      purpose: input.purpose,
      instructor_id: input.instructorId || null,
      remarks: input.remarks || null,
    })
    .eq('id', input.id);

  if (updErr) {
    let detail = updErr.message;
    if (updErr.code === '23P01' || updErr.message.includes('reservations_aircraft_id_period_excl')) {
      detail = 'Das neue Zeitfenster überschneidet sich mit einer anderen Reservation.';
    } else if (updErr.code === '23514') {
      detail = 'Die eingegebenen Werte erfüllen nicht alle Anforderungen.';
    } else if (updErr.code === '42501' || updErr.message.includes('row-level security')) {
      detail = 'Sie haben keine Berechtigung, diese Reservation zu bearbeiten.';
    }
    return { ok: false, blockers: [{ code: 'update_error', label: 'Speichern', detail }] };
  }

  revalidatePath('/reservations');
  revalidatePath(`/reservations/${input.id}`);
  revalidatePath('/');
  return { ok: true, id: input.id };
}

// =============================================================================
// Cancel (sets status='cancelled' rather than deleting, to preserve audit trail)
// =============================================================================

export async function cancelReservation(id: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Nicht angemeldet' };

  const { error } = await supabase
    .from('reservations')
    .update({ status: 'cancelled' })
    .eq('id', id);

  if (error) {
    if (error.code === '42501' || error.message.includes('row-level security')) {
      return { ok: false, error: 'Sie haben keine Berechtigung, diese Reservation zu stornieren.' };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath('/reservations');
  revalidatePath('/');
  return { ok: true };
}
