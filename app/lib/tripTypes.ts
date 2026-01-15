// app/lib/tripTypes.ts
// Single source of truth for trip types used by UI and DB edge.

export const TRIP_TYPES = [
  'Leisure',
  'Business',
  'Leisure + Business',
  'Family Visit',
  'Friend(s) Visit',
  'Layover/Stopover',
  'Other',
] as const;

export type TripType = typeof TRIP_TYPES[number];

export function isTripType(x: unknown): x is TripType {
  return typeof x === 'string' && (TRIP_TYPES as readonly string[]).includes(x);
}
