import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import ScreenBackground from '../components/ScreenBackground';
import PrimaryButton from '../components/PrimaryButton';
import { loadTripsFromCache, refreshAndCacheTrips, TripRow } from './lib/db';
import { countryNameFromCode } from './lib/countries';

const todayISO = () => new Date().toISOString().slice(0, 10);

function formatDate(iso: string): string {
  try {
    const [y, m, d] = iso.split('-').map((v) => parseInt(v, 10));
    const date = new Date(y, m - 1, d);
    const dd = String(d).padStart(2, '0');
    // Three-letter, uppercase month abbreviations (e.g. DEC, NOV)
    const monthAbbrev = date
      .toLocaleString('en-US', { month: 'short' })
      .toUpperCase()
      .slice(0, 3);
    return `${dd} ${monthAbbrev} ${y}`;
  } catch {
    return iso;
  }
}

function placeLine(t: TripRow): string {
  const country = countryNameFromCode(String(t.destination_country_code || '')).trim();
  const city = (t.destination_city || '').trim();
  return [city, country].filter(Boolean).join(', ');
}

export default function MyTrips() {
  const router = useRouter();
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        const cached = await loadTripsFromCache();
        if (cached) setTrips(filterUpcoming(cached));
        const fresh = await refreshAndCacheTrips();
        setTrips(filterUpcoming(fresh));
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  const openEdit = (id?: string) => {
    if (!id) return;
    router.push({ pathname: '/edit-trip/[id]', params: { id } });
  };

  return (
    <ScreenBackground>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.titleText}>My Trips</Text>
        </View>

        {/* List */}
        {loading ? (
          <ActivityIndicator color="#fff" style={{ marginTop: 20 }} />
        ) : trips.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.noTrips}>No upcoming trips. Plan your next adventure!</Text>
          </View>
        ) : null}

        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {trips.map((t) => (
            <TouchableOpacity
              key={t.id}
              onPress={() => openEdit(t.id)}
              activeOpacity={0.9}
              style={styles.tripCard}
            >
              <Text style={styles.placeText}>
                {placeLine(t)}
                {t.tentative ? <Text style={styles.tentative}> (tentative)</Text> : null}
              </Text>

              <View style={{ marginTop: 6 }}>
                <Text style={styles.datesText}>
                  {formatDate(t.start_date)}  →  {formatDate(t.end_date)}
                </Text>
              </View>

              {t.trip_type ? <Text style={styles.typeText}>Trip Type: {t.trip_type}</Text> : null}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Sticky footer (buttons) */}
        <View style={styles.footer}>
          <PrimaryButton
            title="+ Add Trip"
            onPress={() => router.push('/add-trip')}
            style={styles.footerBtn}
          />
          <PrimaryButton
            title="Past Trips"
            onPress={() => router.push('/past-trips')}
            style={styles.footerBtn}
          />
          {/* NEW: Connections button */}
          <PrimaryButton
            title="Connections"
            onPress={() => router.push('/connections')}
            style={styles.footerBtn}
          />

          <TouchableOpacity onPress={() => router.replace('/home')} style={styles.homeChip}>
            <Text style={styles.homeChipText}>Home</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScreenBackground>
  );
}

function filterUpcoming(rows: TripRow[]): TripRow[] {
  const today = todayISO();
  return rows
    .filter(r => (r.end_date || r.start_date) >= today)
    .sort((a, b) => (a.start_date > b.start_date ? 1 : -1));
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 72,
    paddingBottom: 10,
    alignItems: 'center',
  },
  titleText: { color: '#ffffff', fontSize: 36, fontWeight: '800', textAlign: 'center' },

  list: { flex: 1 },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 140, // space so last card isn't under footer
  },

  emptyWrap: { paddingHorizontal: 20, marginTop: 24 },
  noTrips: { color: '#ffffff', opacity: 0.9, marginBottom: 12 },

  tripCard: {
    marginBottom: 14,
    padding: 16,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  placeText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  tentative: { color: 'rgba(255,255,255,0.85)', fontStyle: 'italic', fontWeight: '600' },
  datesText: { color: 'rgba(255,255,255,0.92)', fontSize: 14, marginTop: 2 },
  typeText: { color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 8 },

  /* Sticky footer */
  footer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
    backgroundColor: 'rgba(10,10,18,0.55)', // subtle glass
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  footerBtn: { marginBottom: 10 },
  homeChip: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  homeChipText: { color: '#ffffff', fontSize: 12, textAlign: 'center' },
});