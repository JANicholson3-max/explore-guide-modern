// components/DatePicker.tsx
import React, { useMemo, useState, useEffect } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { ACCENT, ACCENT_TEXT } from '../app/lib/theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  onDateSelect: (isoYYYYMMDD: string) => void;
  title?: string;
  initialDate?: string;       // YYYY-MM-DD
  initialMonth?: number;      // 1-12
  initialYear?: number;       // YYYY
  minDate?: string | undefined;
  highlightDate?: string | undefined;
};

function daysInMonth(y: number, m1to12: number) {
  return new Date(y, m1to12, 0).getDate();
}

export default function DatePicker({
  visible,
  onClose,
  onDateSelect,
  title = 'Select date',
  initialDate,
  initialMonth,
  initialYear,
  minDate,
  highlightDate,
}: Props) {
  const now = new Date();
  const initY = initialYear ?? now.getFullYear();
  const initM = initialMonth ?? (now.getMonth() + 1);

  const [viewYear, setViewYear] = useState(initY);
  const [viewMonth, setViewMonth] = useState(initM); // 1-12

  // if initial props change (rare), sync view
  useEffect(() => {
    setViewYear(initY);
    setViewMonth(initM);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialYear, initialMonth]);

  const min = useMemo(() => (minDate ? new Date(minDate) : undefined), [minDate]);
  const count = daysInMonth(viewYear, viewMonth);

  const days = useMemo(() => {
    return Array.from({ length: count }, (_, i) => {
      const d = i + 1;
      const iso = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const disabled = !!min && new Date(iso) < min;
      const highlighted = highlightDate === iso || initialDate === iso;
      return { d, iso, disabled, highlighted };
    });
  }, [count, viewYear, viewMonth, min, highlightDate, initialDate]);

  const goMonth = (delta: number) => {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m > 12) { m = 1; y += 1; }
    if (m < 1)  { m = 12; y -= 1; }
    setViewYear(y);
    setViewMonth(m);
  };

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => goMonth(-1)} style={styles.navBtn} accessibilityLabel="Previous month">
              <Text style={styles.navBtnText}>‹</Text>
            </TouchableOpacity>

            <View style={{ alignItems: 'center' }}>
              <Text style={styles.titleText}>{title}</Text>
              <Text style={styles.monthText}>
                {new Date(viewYear, viewMonth - 1, 1).toLocaleString('en-US', { month: 'long' }).toUpperCase()} • {viewYear}
              </Text>
            </View>

            <TouchableOpacity onPress={() => goMonth(1)} style={styles.navBtn} accessibilityLabel="Next month">
              <Text style={styles.navBtnText}>›</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={days}
            keyExtractor={(item) => item.iso}
            numColumns={7}
            contentContainerStyle={{ paddingVertical: 6 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                disabled={item.disabled}
                onPress={() => onDateSelect(item.iso)}
                style={[
                  styles.dayCell,
                  item.disabled && styles.dayDisabled,
                  item.highlighted && styles.dayHighlighted,
                ]}
                accessibilityLabel={`Select ${item.iso}`}
              >
                <Text style={[styles.dayText, item.disabled && { opacity: 0.4 }]}>{item.d}</Text>
              </TouchableOpacity>
            )}
          />

          <TouchableOpacity onPress={onClose} style={styles.primary} activeOpacity={0.9}>
            <Text style={styles.primaryText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '90%',
    maxWidth: 420,
    backgroundColor: 'rgba(15,20,30,0.9)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  navBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  navBtnText: { color: '#fff', fontSize: 22, fontWeight: '900', marginTop: -2 },
  titleText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  monthText: {
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
    marginBottom: 6,
    fontSize: 12,
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    marginVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  dayHighlighted: {
    backgroundColor: 'rgba(59,130,246,0.30)',
    borderColor: 'rgba(59,130,246,0.55)',
  },
  dayDisabled: {
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  dayText: {
    color: '#fff',
    fontWeight: '700',
  },
  primary: {
    marginTop: 10,
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryText: { color: ACCENT_TEXT, fontWeight: '800' },
});
