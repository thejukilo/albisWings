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
    return { ok: false, blockers: [{ code: 'insert_error', label: 'Speichern', detail: insErr.message }] };
  }

  revalidatePath('/reservations');
  revalidatePath('/');
  return { ok: true, id: inserted.id };
}
