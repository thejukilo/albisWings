'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export type FlightCategory =
  | 'schulung_vfr' | 'schulung_ifr'
  | 'charter_vfr'  | 'charter_ifr'
  | 'privat_vfr'   | 'privat_ifr'
  | 'rundflug'     | 'wartung' | 'ueberflug';

export type CreateFlightInput = {
  reservationId?:    string | null;
  aircraftId:        string;
  flightCategory:    FlightCategory;
  mwstBefreit:       boolean;
  flightDate:        string;       // YYYY-MM-DD
  pilotId:           string;       // Usually current user, but admin can pick anyone
  instructorId?:     string | null;

  originIcao:        string;       // 4 chars
  destinationIcao:   string;

  // Counters
  ftcStart:          number;
  ftcEnd:            number;
  hobbsStart:        number;
  hobbsEnd:          number;

  // Times — HH:MM strings local
  blockOff:          string;       // chocks-out
  takeoff:           string;
  landing:           string;
  blockOn:           string;       // chocks-in

  landingsDay:       number;
  landingsNight:     number;
  goArounds:         number;

  passengerCount:    number;
  fuelType?:         string | null;
  fuelUpliftL?:      number | null;
  oilAddedQt?:       number | null;
  oxygenUsed:        boolean;
  remarks?:          string | null;
  machineOk:         boolean;
};

export type CreateFlightResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function createFlight(input: CreateFlightInput): Promise<CreateFlightResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Nicht angemeldet' };

  // Sanity
  if (input.ftcEnd < input.ftcStart)     return { ok: false, error: 'FTC Ende muss grösser/gleich FTC Start sein.' };
  if (input.hobbsEnd < input.hobbsStart) return { ok: false, error: 'Hobbs Ende muss grösser/gleich Hobbs Start sein.' };
  if ((input.landingsDay + input.landingsNight) < 1) {
    return { ok: false, error: 'Mindestens eine Landung muss eingetragen werden.' };
  }
  if (input.originIcao.length !== 4)      return { ok: false, error: 'Startort muss exakt 4 Zeichen sein (ICAO).' };
  if (input.destinationIcao.length !== 4) return { ok: false, error: 'Zielort muss exakt 4 Zeichen sein (ICAO).' };

  const day = input.flightDate;
  const toIso = (hhmm: string) => `${day}T${hhmm}:00`;

  const { data: inserted, error: insErr } = await supabase
    .from('flights')
    .insert({
      reservation_id:   input.reservationId || null,
      aircraft_id:      input.aircraftId,
      flight_date:      input.flightDate,
      flight_category:  input.flightCategory,
      mwst_befreit:     input.mwstBefreit,
      origin_icao:      input.originIcao.toUpperCase(),
      destination_icao: input.destinationIcao.toUpperCase(),
      block_off:        toIso(input.blockOff),
      takeoff:          toIso(input.takeoff),
      landing:          toIso(input.landing),
      block_on:         toIso(input.blockOn),
      ftc_start:        input.ftcStart,
      ftc_end:          input.ftcEnd,
      hobbs_start:      input.hobbsStart,
      hobbs_end:        input.hobbsEnd,
      landings_day:     input.landingsDay,
      landings_night:   input.landingsNight,
      go_arounds:       input.goArounds,
      passenger_count:  input.passengerCount,
      fuel_type:        input.fuelType || null,
      fuel_uplift_liters: input.fuelUpliftL ?? null,
      oil_added_quarts: input.oilAddedQt ?? null,
      oxygen_used:      input.oxygenUsed,
      remarks:          input.remarks?.trim() || null,
      machine_ok:       input.machineOk,
      created_by:       user.id,
    })
    .select('id')
    .single();

  if (insErr) return { ok: false, error: insErr.message };

  // Compute flight time in minutes from takeoff to landing
  const tkoff = new Date(toIso(input.takeoff)).getTime();
  const land  = new Date(toIso(input.landing)).getTime();
  const flightMinutes = Math.max(1, Math.round((land - tkoff) / 60000));
  const totalLandings = input.landingsDay + input.landingsNight;

  // Pilot row (PIC if solo, DUAL if FI present)
  const pilotFunc = input.instructorId ? 'DUAL' : 'PIC';
  const { error: fpErr1 } = await supabase
    .from('flight_pilots')
    .insert({
      flight_id:      inserted.id,
      user_id:        input.pilotId,
      function:       pilotFunc,
      time_logged:    `${flightMinutes} minutes`,
      landings_logged: totalLandings,
    });
  if (fpErr1) {
    // Best-effort cleanup
    await supabase.from('flights').delete().eq('id', inserted.id);
    return { ok: false, error: `Pilot-Zuordnung fehlgeschlagen: ${fpErr1.message}` };
  }

  // Instructor row (if any) — INSTR function, no landings
  if (input.instructorId) {
    const { error: fpErr2 } = await supabase
      .from('flight_pilots')
      .insert({
        flight_id:      inserted.id,
        user_id:        input.instructorId,
        function:       'INSTR',
        time_logged:    `${flightMinutes} minutes`,
        landings_logged: 0,
      });
    if (fpErr2) {
      // Don't fail the whole flight; just warn server-side
      console.warn('instructor flight_pilots insert failed', fpErr2);
    }
  }

  // If tied to a reservation, mark it returned + completed
  if (input.reservationId) {
    const { error: updErr } = await supabase
      .from('reservations')
      .update({
        returned_at: new Date().toISOString(),
        returned_by: user.id,
        status: 'completed',
      })
      .eq('id', input.reservationId);
    if (!updErr) {
      await supabase.from('reservation_events').insert({
        reservation_id: input.reservationId,
        actor_id: user.id,
        event_type: 'returned',
        details: 'Flugzeug zurückgebracht und Flugzeit erfasst',
      });
    }
  }

  // If the pilot reported machine_ok=false, create an open techlog "Not Flight Relevant" entry
  if (!input.machineOk) {
    await supabase.from('techlog_entries').insert({
      aircraft_id: input.aircraftId,
      raised_by:   user.id,
      item:        '⚠ Maschine NICHT in Ordnung nach Flug — Pilot hat "Maschine OK" verneint. Bitte prüfen.',
      relevance:   'not_flight_relevant',
      state:       'open',
      hobbs_at_raise: input.hobbsEnd,
    });
  }

  revalidatePath('/flightlog');
  revalidatePath(`/flightlog/${input.aircraftId}`);
  revalidatePath('/reservations');
  if (input.reservationId) revalidatePath(`/reservations/${input.reservationId}`);
  revalidatePath('/'); // dashboard currency tile
  return { ok: true, id: inserted.id };
}
