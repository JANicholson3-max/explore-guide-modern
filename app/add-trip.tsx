import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import ScreenBackground from '../components/ScreenBackground';
import TripForm, { TripFormValues } from '../components/TripForm';
import { insertTrip, refreshAndCacheTrips } from './lib/db';

export default function AddTrip() {
  const [saving, setSaving] = useState(false);

  const onSubmit = async (values: TripFormValues) => {
    try {
      setSaving(true);
      await insertTrip({
        destination_city: values.destination_city ?? '',
        destination_country_code: values.destination_country_code,
        start_date: values.start_date,
        end_date: values.end_date,
        tentative: values.tentative ?? false,
        trip_type: values.trip_type ?? null,
        audiences: values.audiences ?? ['Only Me'],
      });
      await refreshAndCacheTrips();

      // navigate back to list
      const { router } = require('expo-router');
      router.replace('/my-trips');
    } catch (e: any) {
      console.error('save trip error:', e);
      Alert.alert('Error', e?.message ?? 'Failed to save trip.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenBackground>
      <View style={styles.header}>
        <Text style={styles.title}>Add New Trip</Text>
      </View>
      <TripForm mode="add" submitting={saving} onSubmit={onSubmit} />
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 72, paddingBottom: 10, alignItems: 'center' },
  title: { color: '#fff', fontSize: 36, fontWeight: '800', textAlign: 'center' },
});