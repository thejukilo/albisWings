export type AvailabilityRow = {
  id: string;
  instructor_id: string;
  starts_at: string;
  ends_at: string;
  available: boolean;
  note: string | null;
};
