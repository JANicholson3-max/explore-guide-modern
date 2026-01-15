import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import ScreenBackground from '../components/ScreenBackground';
import PrimaryButton from '../components/PrimaryButton';
import { loadTripsFromCache, refreshAndCacheTrips, TripRow } from './lib/db';
import { countryNameFromCode } from './lib/countries';

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

export default function PastTrips() {
  const router = useRouter();
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        const cached = await loadTripsFromCache();
        if (cached) setTrips(filterPast(cached));
        const fresh = await refreshAndCacheTrips();
        setTrips(filterPast(fresh));
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  return (
    <ScreenBackground>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.titleText}>Past Trips</Text>
        </View>

        {/* List */}
        {loading ? (
          <ActivityIndicator color="#fff" style={{ marginTop: 20 }} />
        ) : trips.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.noTrips}>No completed trips yet.</Text>
          </View>
        ) : null}

        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {trips.map((t) => (
            <View key={t.id} style={styles.tripCard}>
              <Text style={styles.placeText}>
                {placeLine(t)}
                {t.tentative ? <Text style={styles.tentative}> (tentative)</Text> : null}
              </Text>
              <Text style={styles.datesText}>
                {formatDate(t.start_date)}  →  {formatDate(t.end_date)}
              </Text>
              {t.trip_type ? (
                <Text style={styles.typeText}>Trip Type: {t.trip_type}</Text>
              ) : null}
            </View>
          ))}
        </ScrollView>

        {/* Sticky footer */}
        <View style={styles.footer}>
          <PrimaryButton title="View Upcoming Trips" onPress={() => router.replace('/my-trips')} style={styles.footerBtn} />
          <TouchableOpacity onPress={() => router.replace('/home')} style={styles.homeChip}>
            <Text style={styles.homeChipText}>Home</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScreenBackground>
  );
}

function filterPast(rows: TripRow[]): TripRow[] {
  const today = new Date().toISOString().slice(0, 10);
  return rows
    .filter(r => (r.end_date || r.start_date) < today)
    .sort((a, b) => (a.start_date > b.start_date ? -1 : 1)); // newest past first
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
    paddingBottom: 120, // keep free space under last card
  },

  emptyWrap: { paddingHorizontal: 20, marginTop: 24 },
  noTrips: { color: '#ffffff', opacity: 0.9, marginBottom: 12 },

  tripCard: {
    marginBottom: 14,
    padding: 16,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    opacity: 0.9,
  },
  placeText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  tentative: { color: 'rgba(255,255,255,0.85)', fontStyle: 'italic', fontWeight: '600' },
  datesText: { color: 'rgba(255,255,255,0.9)', fontSize: 14, marginTop: 6 },
  typeText: { color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 8 },

  /* Sticky footer */
  footer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
    backgroundColor: 'rgba(10,10,18,0.55)',
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