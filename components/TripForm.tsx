// components/TripForm.tsx
import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Platform,
  Modal,
  Pressable,
  Keyboard,
} from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import PrimaryButton from './PrimaryButton';
import DatePicker from './DatePicker';
import { countries, countryNameFromCode } from '../app/lib/countries';
import { router } from 'expo-router';
import type { Audience } from '../app/lib/db';
import { TRIP_TYPES, TripType } from '../app/lib/db';

export type TripFormValues = {
  destination_city?: string;
  destination_country_code: string;
  start_date: string;
  end_date: string;
  tentative?: boolean;
  trip_type?: TripType;
  audiences?: Audience[];
};

const AUDIENCE_OPTIONS: Audience[] = ['Only Me', 'Close Friends', 'Family', 'Colleagues', 'All Connections'];

export default function TripForm(props: {
  mode: 'add' | 'edit';
  initial?: TripFormValues & { audiences?: Audience[] };
  submitting?: boolean;
  onSubmit: (values: TripFormValues) => void;
}) {
  const { mode, submitting, onSubmit } = props;

  const [destinationCity, setDestinationCity] = useState(props.initial?.destination_city ?? '');
  const [countryCode, setCountryCode] = useState(props.initial?.destination_country_code ?? '');
  const [countryQuery, setCountryQuery] = useState(
    props.initial?.destination_country_code ? countryNameFromCode(props.initial.destination_country_code) : ''
  );
  const [countryModal, setCountryModal] = useState(false);

  const [startDate, setStartDate] = useState(props.initial?.start_date ?? '');
  const [endDate, setEndDate] = useState(props.initial?.end_date ?? '');
  const [tentative, setTentative] = useState(Boolean(props.initial?.tentative));

  const [tripType, setTripType] = useState<TripFormValues['trip_type']>(props.initial?.trip_type ?? undefined);
  const [tripTypeModal, setTripTypeModal] = useState(false);

  const [audiences, setAudiences] = useState<Set<Audience>>(new Set(props.initial?.audiences ?? ['Only Me']));

  const [dateMode, setDateMode] = useState<'start' | 'end' | null>(null);
  const [tempDate, setTempDate] = useState<Date>(new Date());

  // ---- focus/keyboard control ----
  const cityRef = useRef<TextInput>(null);
  const countrySearchRef = useRef<TextInput>(null);
  const blurCityAndDismiss = () => {
    cityRef.current?.blur();
    Keyboard.dismiss();
  };

  const filteredCountries = useMemo(() => {
    const q = countryQuery.trim().toLowerCase();
    if (!q) return countries;
    return countries.filter(c => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q));
  }, [countryQuery]);

  useEffect(() => {
    const exact = countries.find(c => c.name.toLowerCase() === countryQuery.trim().toLowerCase());
    if (exact) setCountryCode(exact.code);
  }, [countryQuery]);

  const rangeValid =
    Boolean(startDate && endDate) &&
    fromISO(endDate) >= fromISO(startDate); // allow same-day or later

  const valid = Boolean(countryCode && rangeValid);

  const openDate = (which: 'start' | 'end') => {
    blurCityAndDismiss();
    setDateMode(which);

    if (which === 'start') {
      const seed = startDate ? fromISO(startDate) : new Date();
      setTempDate(seed);
      return;
    }

    // which === 'end'
    const minEnd = startDate ? fromISO(startDate) : new Date();
    const candidate = endDate ? fromISO(endDate) : minEnd;
    setTempDate(candidate < minEnd ? minEnd : candidate);
  };

  const closeDate = () => {
    setDateMode(null);
    Keyboard.dismiss();
  };

  const onConfirmNative = (d: Date) => {
    const iso = toISO(d);

    if (dateMode === 'start') {
      setStartDate(iso);
      if (!endDate || fromISO(endDate) < fromISO(iso)) {
        setEndDate(iso); // allow same-day; bump only if End < Start
      }
    } else if (dateMode === 'end') {
      setEndDate(iso);
    }

    closeDate();
  };

  const onSelectWeb = (iso: string) => {
    if (!iso) return;

    if (dateMode === 'start') {
      setStartDate(iso);
      if (!endDate || fromISO(endDate) < fromISO(iso)) {
        setEndDate(iso);
      }
    } else if (dateMode === 'end') {
      // enforce End >= Start
      if (startDate && fromISO(iso) < fromISO(startDate)) {
        setEndDate(startDate);
      } else {
        setEndDate(iso);
      }
    }

    closeDate();
  };

  const chooseCountry = (code: string) => {
    setCountryCode(code);
    setCountryQuery(countryNameFromCode(code));
    setCountryModal(false);
    Keyboard.dismiss();
  };

  const chooseTripType = (t: NonNullable<TripFormValues['trip_type']>) => {
    setTripType(t);
    setTripTypeModal(false);
    Keyboard.dismiss();
  };

  // “Only Me” and “All Connections” are exclusive
  const toggleAudience = (a: Audience) => {
    const next = new Set(audiences);
    const isExclusive = (x: Audience) => x === 'All Connections' || x === 'Only Me';

    if (isExclusive(a)) {
      if (next.has(a) && next.size === 1) {
        // tapping again unselects the only-selected exclusive option
        next.delete(a);
      } else {
        next.clear();
        next.add(a);
      }
      setAudiences(next);
      return;
    }

    // Non-exclusive: clear any active exclusive option first
    if (next.has('All Connections')) next.delete('All Connections');
    if (next.has('Only Me')) next.delete('Only Me');

    if (next.has(a)) next.delete(a);
    else next.add(a);

    setAudiences(next);
  };

  const submit = () => {
    if (!valid) return;
    blurCityAndDismiss();
    onSubmit({
      destination_city: destinationCity?.trim() || '',
      destination_country_code: countryCode,
      start_date: startDate,
      end_date: endDate,
      tentative,
      trip_type: tripType ?? undefined,
      audiences: Array.from(audiences),
    });
  };

  return (
    <View style={styles.wrap}>
      {/* Destination City FIRST */}
      <View style={styles.field}>
        <Text style={styles.label}>Destination City</Text>
        <TextInput
          ref={cityRef}
          style={styles.input}
          placeholder="e.g., Cairo"
          placeholderTextColor="rgba(255,255,255,0.5)"
          value={destinationCity}
          onChangeText={setDestinationCity}
          blurOnSubmit
          returnKeyType="done"
        />
      </View>

      {/* Destination Country (modal search) */}
      <View style={styles.field}>
        <Text style={styles.label}>Destination Country *</Text>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            blurCityAndDismiss();
            setCountryModal(true);
          }}
          style={styles.input}
        >
          <Text style={{ color: countryCode ? '#fff' : 'rgba(255,255,255,0.5)' }}>
            {countryCode ? countryNameFromCode(countryCode) : 'Select a country...'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Dates side-by-side */}
      <View style={styles.row}>
        <View style={[styles.field, styles.half]}>
          <Text style={styles.label}>Start Date *</Text>
          <TouchableOpacity style={styles.dateInput} onPress={() => openDate('start')} activeOpacity={0.85}>
            <Text style={styles.dateText}>{startDate ? displayDate(startDate) : 'YYYY-MM-DD'}</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.field, styles.half]}>
          <Text style={styles.label}>End Date *</Text>
          <TouchableOpacity
            style={[styles.dateInput, !startDate && { opacity: 0.6 }]}
            onPress={() => startDate && openDate('end')}
            activeOpacity={0.85}
            disabled={!startDate}
          >
            <Text style={styles.dateText}>
              {endDate ? displayDate(endDate) : startDate ? 'YYYY-MM-DD' : 'Pick start date'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Nature of The Trip */}
      <View style={styles.field}>
        <Text style={styles.label}>Nature of The Trip</Text>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => {
            blurCityAndDismiss();
            setTripTypeModal(true);
          }}
          style={styles.input}
        >
          <Text style={{ color: tripType ? '#fff' : 'rgba(255,255,255,0.5)' }}>
            {tripType ?? 'Select type…'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tentative */}
      <TouchableOpacity
        style={styles.checkboxRow}
        onPress={() => {
          blurCityAndDismiss();
          setTentative(!tentative);
        }}
      >
        <View style={[styles.checkbox, tentative && styles.checkboxOn]} />
        <Text style={styles.checkboxLabel}>This trip is tentative or unconfirmed.</Text>
      </TouchableOpacity>

      {/* Who can see this trip? */}
      <View style={[styles.field, { marginTop: 18 }]}>
        <Text style={styles.label}>Who can see this trip?</Text>
        <View style={styles.choicesWrap}>
          {AUDIENCE_OPTIONS.map((opt) => {
            const selected = audiences.has(opt);
            return (
              <TouchableOpacity
                key={opt}
                onPress={() => {
                  blurCityAndDismiss();
                  toggleAudience(opt);
                }}
                style={[styles.choice, selected && styles.choiceSelected]}
              >
                <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{opt}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <PrimaryButton
        title={submitting ? (mode === 'add' ? 'Saving…' : 'Updating…') : mode === 'add' ? 'Save Trip' : 'Save Changes'}
        onPress={submit}
        loading={submitting}
        style={{ marginTop: 8 }}
        disabled={!valid || !!submitting}
      />

      {/* glassy red Cancel */}
      <TouchableOpacity onPress={() => { blurCityAndDismiss(); router.replace('/my-trips'); }} style={styles.cancelBtn}>
        <Text style={styles.cancelText}>Cancel</Text>
      </TouchableOpacity>

      {/* ---------- DATE PICKER ---------- */}
      {Platform.OS === 'web' ? (
        <DatePicker
          visible={dateMode !== null}
          onClose={closeDate}
          onDateSelect={onSelectWeb}
          title={dateMode === 'start' ? 'Select start date' : 'Select end date'}
          initialDate={dateMode === 'start' ? startDate : endDate}
          minDate={dateMode === 'end' ? startDate || undefined : undefined}
          highlightDate={dateMode === 'start' ? startDate : endDate}
        />
      ) : (
        <DateTimePickerModal
          isVisible={dateMode !== null}
          mode="date"
          date={tempDate}
          onConfirm={onConfirmNative}
          onCancel={closeDate}
          themeVariant="dark"
          // iOS can show inline; Android will show its native dialog
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          minimumDate={dateMode === 'end' && startDate ? fromISO(startDate) : undefined}
        />
      )}

      {/* Country Modal */}
      <Modal
        visible={countryModal}
        transparent
        animationType="fade"
        onRequestClose={() => setCountryModal(false)}
        onShow={() => countrySearchRef.current?.focus()} // focus the search box when modal opens
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setCountryModal(false)}>
          <View />
        </Pressable>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Select country</Text>
          <TextInput
            ref={countrySearchRef}
            style={styles.modalSearch}
            placeholder="Type to filter…"
            placeholderTextColor="rgba(255,255,255,0.6)"
            value={countryQuery}
            onChangeText={(t) => { setCountryQuery(t); setCountryCode(''); }}
            autoFocus
          />
          <FlatList
            keyboardShouldPersistTaps="handled"
            data={filteredCountries}
            keyExtractor={(item) => item.code}
            style={{ maxHeight: 320 }}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.modalItem} onPress={() => chooseCountry(item.code)}>
                <Text style={styles.modalItemText}>{item.name}</Text>
              </TouchableOpacity>
            )}
          />
          <TouchableOpacity style={styles.modalClose} onPress={() => setCountryModal(false)}>
            <Text style={styles.modalCloseText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Trip Type Modal */}
      <Modal visible={tripTypeModal} transparent animationType="fade" onRequestClose={() => setTripTypeModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setTripTypeModal(false)}>
          <View />
        </Pressable>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Nature of the trip</Text>
          <FlatList
            keyboardShouldPersistTaps="handled"
            data={TRIP_TYPES}
            keyExtractor={(item) => item}
            style={{ maxHeight: 320 }}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.modalItem} onPress={() => chooseTripType(item as TripType)}>
                <Text style={styles.modalItemText}>{item}</Text>
              </TouchableOpacity>
            )}
          />
          <TouchableOpacity style={styles.modalClose} onPress={() => setTripTypeModal(false)}>
            <Text style={styles.modalCloseText}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

/* utils */
function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function fromISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map((v) => parseInt(v, 10));
  return new Date(y, m - 1, d);
}
function displayDate(iso: string): string {
  try {
    const [y, m, d] = iso.split('-').map((v) => parseInt(v, 10));
    const date = new Date(y, m - 1, d);
    const dd = String(d).padStart(2, '0');
    const Month = date.toLocaleString('en-US', { month: 'long' });
    return `${dd} ${Month} ${y}`;
  } catch {
    return iso;
  }
}

/* styles */
const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingTop: 16, flex: 1 },
  field: { marginBottom: 14 },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  label: { color: '#fff', opacity: 0.9, marginBottom: 8, fontSize: 14 },

  input: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },

  dateInput: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  dateText: { color: '#fff' },

  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  modalCard: {
    position: 'absolute',
    left: 20,
    right: 20,
    top: 120,
    borderRadius: 16,
    padding: 12,
    backgroundColor: 'rgba(10,10,18,0.98)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  modalTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  modalSearch: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginBottom: 8,
  },
  modalItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  modalItemText: { color: '#fff' },

  modalClose: {
    marginTop: 10,
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  modalCloseText: { color: '#fff' },

  choicesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  choice: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  choiceSelected: { backgroundColor: 'rgba(255,255,255,0.18)', borderColor: 'rgba(255,255,255,0.55)' },
  choiceText: { color: '#fff', opacity: 0.9, fontSize: 12 },
  choiceTextSelected: { color: '#fff', fontWeight: '700' },

  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, marginBottom: 6 },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    marginRight: 10,
    backgroundColor: 'transparent',
  },
  checkboxOn: { backgroundColor: 'rgba(255,255,255,0.7)' },
  checkboxLabel: { color: '#fff', opacity: 0.9 },

  cancelBtn: {
    marginTop: 14,
    paddingVertical: 8,
    paddingHorizontal: 20,
    alignSelf: 'center',
    backgroundColor: 'rgba(155, 30, 53, 0.16)',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.28)',
  },
  cancelText: { color: '#fff', fontSize: 12, textAlign: 'center' },
});