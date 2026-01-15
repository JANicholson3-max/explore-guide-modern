// app/lib/db.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

/** Audience visibility buckets kept in the trips table as a string[] column (RLS-enforced server-side). */
export type Audience = 'Only Me' | 'Close Friends' | 'Family' | 'Colleagues' | 'All Connections';

/* === Trip types (single source of truth for UI + DB) === */
export const TRIP_TYPES = [
  'Leisure',
  'Business',
  'Leisure + Business',
  'Family Visit',
  'Friend(s) Visit',
  'Layover/Stopover',
  'At Home',        // 👈 moved ABOVE Other
  'Other',
] as const;

export type TripType = typeof TRIP_TYPES[number];

export function isTripType(x: unknown): x is TripType {
  return typeof x === 'string' && (TRIP_TYPES as readonly string[]).includes(x);
}

/** Row shape for trips (aligns with your Supabase schema). */
export type TripRow = {
  id: string;
  user_id: string | null;
  destination_city: string | null;
  destination_country_code: string | null;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  tentative: boolean | null;
  trip_type: TripType | null;
  audiences: Audience[] | null;
  created_at: string;
  updated_at: string;
};

const TRIPS_CACHE_KEY = 'panterix_trips_cache_v2';

/* ----------------------------- CREATE ------------------------------ */
export async function insertTrip(input: {
  destination_city?: string;
  destination_country_code: string;
  start_date: string;
  end_date: string;
  tentative?: boolean;
  trip_type?: TripType | null;
  audiences?: Audience[];
}) {
  const { data: auth } = await supabase.auth.getUser();
  const user_id = auth.user?.id ?? null;

  if (typeof input.trip_type !== 'undefined' && input.trip_type !== null && !isTripType(input.trip_type)) {
    throw new Error(`Invalid trip_type: ${String(input.trip_type)}. Allowed: ${TRIP_TYPES.join(', ')}`);
  }

  const payload = {
    user_id,
    destination_city: input.destination_city?.trim() || null,
    destination_country_code: input.destination_country_code,
    start_date: input.start_date,
    end_date: input.end_date,
    tentative: Boolean(input.tentative ?? false),
    trip_type: input.trip_type ?? null,
    audiences: (input.audiences && input.audiences.length > 0 ? input.audiences : ['Only Me']) as Audience[],
  };

  const { error } = await supabase.from('trips').insert(payload);
  if (error) throw error;
}

/* ----------------------------- UPDATE ------------------------------ */
export async function updateTrip(
  id: string,
  patch: Partial<Omit<TripRow, 'id' | 'created_at' | 'updated_at' | 'user_id'>>
) {
  if (Object.prototype.hasOwnProperty.call(patch, 'trip_type')) {
    const val = (patch as { trip_type?: TripType | null }).trip_type;
    if (typeof val !== 'undefined' && val !== null && !isTripType(val)) {
      throw new Error(`Invalid trip_type: ${String(val)}. Allowed: ${TRIP_TYPES.join(', ')}`);
    }
  }

  const upd = { ...patch, updated_at: new Date().toISOString() };
  const { error } = await supabase.from('trips').update(upd).eq('id', id);
  if (error) throw error;
}

/* ----------------------------- DELETE ------------------------------ */
export async function deleteTrip(id: string) {
  const { error } = await supabase.from('trips').delete().eq('id', id);
  if (error) throw error;
}

/* ------------------------------ READ ------------------------------- */
export async function getTripById(id: string): Promise<TripRow> {
  const { data, error } = await supabase.from('trips').select('*').eq('id', id).single();
  if (error) throw error;
  return data as TripRow;
}

export async function refreshAndCacheTrips(): Promise<TripRow[]> {
  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .order('start_date', { ascending: true });

  if (error) throw error;

  const rows = (data ?? []) as TripRow[];
  await AsyncStorage.setItem(TRIPS_CACHE_KEY, JSON.stringify(rows));
  return rows;
}

export async function loadTripsFromCache(): Promise<TripRow[] | null> {
  const raw = await AsyncStorage.getItem(TRIPS_CACHE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TripRow[];
  } catch {
    return null;
  }
}