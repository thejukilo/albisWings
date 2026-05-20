export type Aircraft = {
  id: string;
  registration: string;
  manufacturer: string;
  model: string;
  aircraft_class: string;
  sort_order: number;
};

export type Instructor = {
  id: string;
  display_name: string;
  first_name: string;
  last_name: string;
  initials: string | null;
};

export type ReservationRow = {
  id: string;
  aircraft_id: string;
  registration: string;
  pilot_id: string;
  pilot_name: string;
  instructor_id: string | null;
  instructor_name: string | null;
  starts_at: string;
  ends_at: string;
  purpose: string;
  status: string;
  origin_icao: string | null;
  destination_icao: string | null;
  remarks: string | null;
};

export type PreflightFinding = {
  code: string;
  severity: 'ok' | 'warn' | 'block';
  label: string;
  detail: string;
};
