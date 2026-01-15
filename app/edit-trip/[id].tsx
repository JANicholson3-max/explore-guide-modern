import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import ScreenBackground from '../../components/ScreenBackground';
import TripForm, { TripFormValues } from '../../components/TripForm';
import { getTripById, refreshAndCacheTrips, updateTrip, deleteTrip, TripRow } from '../lib/db';
import PrimaryButton from '../../components/PrimaryButton';

export default function EditTrip() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [trip, setTrip] = useState<TripRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!id) {
        Alert.alert('Missing ID', 'No trip id provided.');
        router.back();
        return;
      }
      try {
        const t = await getTripById(String(id));
        if (!cancelled) setTrip(t);
      } catch (e: any) {
        Alert.alert('Error', e?.message ?? 'Failed to load trip.');
        router.back();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const onSubmit = async (values: TripFormValues) => {
    if (!trip) return;
    try {
      setSaving(true);
      await updateTrip(trip.id, {
        destination_city: values.destination_city ?? '',
        destination_country_code: values.destination_country_code,
        start_date: values.start_date,
        end_date: values.end_date,
        tentative: values.tentative ?? false,
        trip_type: values.trip_type,
        audiences: values.audiences ?? ['Only Me'],
      });
      await refreshAndCacheTrips();
      router.replace('/my-trips');
    } catch (e: any) {
      console.error('edit save error:', e);
      Alert.alert('Error', e?.message ?? 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    let confirmed = true;
    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-alert
      confirmed = (window as any).confirm?.('Delete this trip permanently?') ?? true;
    } else {
      await new Promise<void>((resolve) => {
        Alert.alert(
          'Delete Trip',
          'Are you sure you want to permanently delete this trip?',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => { confirmed = false; resolve(); } },
            { text: 'Delete', style: 'destructive', onPress: () => { confirmed = true; resolve(); } },
          ],
          { cancelable: true }
        );
      });
    }

    if (!confirmed || !trip) return;

    try {
      setDeleting(true);
      await deleteTrip(trip.id);
      await refreshAndCacheTrips();
      router.replace('/my-trips');
    } catch (e: any) {
      console.error('delete error:', e);
      Alert.alert('Error', e?.message ?? 'Failed to delete trip.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <ScreenBackground>
      <View style={styles.header}>
        <Text style={styles.title}>Edit Trip</Text>
      </View>

      {loading || !trip ? (
        <View style={{ paddingTop: 40 }}>
          <ActivityIndicator color="#fff" />
        </View>
      ) : (
        <>
          <TripForm
            mode="edit"
            submitting={saving}
            onSubmit={onSubmit}
            initial={{
              destination_city: trip.destination_city ?? '',
              destination_country_code: trip.destination_country_code ?? '',
              start_date: trip.start_date,
              end_date: trip.end_date,
              tentative: Boolean(trip.tentative),
              trip_type: (trip.trip_type as any) ?? undefined,
              audiences: (trip.audiences as any) ?? ['Only Me'],
            }}
          />

          <View style={styles.deleteWrap}>
            <PrimaryButton
              title={deleting ? 'Deleting…' : 'Delete Trip'}
              onPress={onDelete}
              style={styles.deleteBtn}
            />
          </View>
        </>
      )}
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 72, paddingBottom: 10, alignItems: 'center' },
  title: { color: '#fff', fontSize: 36, fontWeight: '800', textAlign: 'center' },

  deleteWrap: {
    marginHorizontal: 20,
    marginTop: 24,
    marginBottom: 48, // extra breathing room at the bottom
  },

  // Ruby/Garnet-ish, less loud than bright red
  deleteBtn: {
    backgroundColor: 'rgba(155, 30, 53, 0.75)',
    borderColor: 'rgba(255, 255, 255, 0.28)',
  },
});