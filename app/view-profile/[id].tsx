// app/view-profile/[id].tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  Image,
  Modal,
  Pressable,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import ScreenBackground from '../../components/ScreenBackground';
import PrimaryButton from '../../components/PrimaryButton';
import { supabase } from '../lib/supabase';
import { countryNameFromCode } from '../lib/countries';

type Profile = {
  user_id: string;
  nickname: string | null;
  home_base: string | null;
  photo_url: string | null;
};

type TripRow = {
  id: string;
  user_id: string;
  destination_city: string | null;
  destination_country_code: string | null;
  start_date: string;
  end_date: string;
  tentative: boolean | null;
  trip_type: string | null;
  audiences: string[] | null;
};

type AudienceCategory = 'Close Friends' | 'Family' | 'Colleagues' | 'General Public';

function isHttpUrl(s?: string | null) {
  return !!s && /^https?:\/\//i.test(s);
}

// 3-letter uppercase month
function formatDate(iso: string): string {
  try {
    const [y, m, d] = iso.split('-').map((v) => parseInt(v, 10));
    const date = new Date(y, m - 1, d);
    const dd = String(d).padStart(2, '0');
    const mon = date.toLocaleString('en-US', { month: 'short' }).toUpperCase().slice(0, 3);
    return `${dd} ${mon} ${y}`;
  } catch {
    return iso;
  }
}

function normalizeStoragePath(path: string): string {
  // Defensive: remove any leading slashes
  return path.replace(/^\/+/, '').trim();
}

function resolveAvatarUrlPublic(raw?: string | null): string | undefined {
  if (!raw) return undefined;

  // Full external URL
  if (isHttpUrl(raw)) {
    return raw + (raw.includes('?') ? '&' : '?') + 'v=' + Date.now();
  }

  // Supabase Storage path (public bucket): convert to public URL
  const clean = normalizeStoragePath(raw);
  const { data } = supabase.storage.from('avatars').getPublicUrl(clean);

  if (!data?.publicUrl) return undefined;
  return data.publicUrl + (data.publicUrl.includes('?') ? '&' : '?') + 'v=' + Date.now();
}

export default function ViewProfile() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const otherId = params.id;

  const [mine, setMine] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);

  const [connStatus, setConnStatus] = useState<'none' | 'pending_in' | 'pending_out' | 'accepted'>('none');
  const [trips, setTrips] = useState<TripRow[]>([]);

  const [currentCat, setCurrentCat] = useState<AudienceCategory>('General Public');
  const [catOpen, setCatOpen] = useState(false);
  const [selectedCat, setSelectedCat] = useState<AudienceCategory>('General Public');
  const categoryOptions: AudienceCategory[] = ['Close Friends', 'Family', 'Colleagues', 'General Public'];
  const [savingCat, setSavingCat] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        if (!otherId) return;
        setLoading(true);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not signed in');
        setMine(user.id);

        // Profile
        const { data: p, error: pErr } = await supabase
          .from('profiles')
          .select('user_id,nickname,home_base,photo_url')
          .eq('user_id', otherId)
          .maybeSingle();
        if (pErr) throw pErr;

        const uid = ((p as any)?.user_id ?? (p as any)?.id ?? otherId) as string;
        const prof: Profile | null = p
          ? {
              user_id: uid,
              nickname: (p as any).nickname ?? null,
              home_base: (p as any).home_base ?? null,
              photo_url: (p as any).photo_url ?? null,
            }
          : null;

        setProfile(prof);

        // ✅ PUBLIC BUCKET: always use getPublicUrl for storage paths
        const resolved = resolveAvatarUrlPublic(prof?.photo_url ?? null);
        setAvatarUrl(resolved);

        if (resolved) {
          console.log('ViewProfile avatar URL:', resolved);
        } else {
          console.log('ViewProfile avatar URL: (none)', prof?.photo_url);
        }

        // Connection status
        const { data: c, error: cErr } = await supabase
          .from('connections')
          .select('owner_id, member_id, status')
          .or(
            `and(owner_id.eq.${user.id},member_id.eq.${otherId}),and(owner_id.eq.${otherId},member_id.eq.${user.id})`
          )
          .maybeSingle();
        if (cErr) throw cErr;

        if (!c) setConnStatus('none');
        else if (c.status === 'accepted') setConnStatus('accepted');
        else if (c.status === 'pending' && c.owner_id === otherId) setConnStatus('pending_in');
        else if (c.status === 'pending' && c.owner_id === user.id) setConnStatus('pending_out');
        else setConnStatus('none');

        // Category (only if accepted)
        if (c?.status === 'accepted') {
          const { data: m, error: mErr } = await supabase
            .from('audience_memberships')
            .select('audience')
            .eq('owner_id', user.id)
            .eq('member_id', otherId)
            .maybeSingle();
          if (mErr) throw mErr;

          const cat = (m?.audience as AudienceCategory) || 'General Public';
          setCurrentCat(cat);
          setSelectedCat(cat);
        } else {
          setCurrentCat('General Public');
          setSelectedCat('General Public');
        }

        // Trips
        const { data: t, error: tErr } = await supabase
          .from('trips')
          .select(
            'id,user_id,destination_city,destination_country_code,start_date,end_date,tentative,trip_type,audiences'
          )
          .eq('user_id', otherId)
          .order('start_date', { ascending: true });
        if (tErr) throw tErr;

        setTrips((t || []) as TripRow[]);
      } catch (e: any) {
        console.error(e);
        Alert.alert('Error', e?.message ?? 'Could not load profile.');
      } finally {
        setLoading(false);
      }
    })();
  }, [otherId]);

  const saveCategory = async () => {
    if (!otherId) return;
    try {
      setSavingCat(true);

      if (selectedCat === 'General Public') {
        await supabase.from('audience_memberships').delete().eq('owner_id', mine).eq('member_id', otherId);
      } else {
        const { error } = await supabase
          .from('audience_memberships')
          .upsert({ owner_id: mine, member_id: otherId, audience: selectedCat }, { onConflict: 'owner_id,member_id' });
        if (error) throw error;
      }

      setCurrentCat(selectedCat);
      setCatOpen(false);
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', e?.message ?? 'Could not save category.');
    } finally {
      setSavingCat(false);
    }
  };

  const sendRequest = async () => {
    if (!otherId) return;
    try {
      const { error } = await supabase
        .from('connections')
        .insert({ owner_id: mine, member_id: otherId, status: 'pending' });
      if (error) throw error;
      setConnStatus('pending_out');
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', e?.message ?? 'Could not send request.');
    }
  };

  const cancelRequest = async () => {
    if (!otherId) return;
    try {
      const { error } = await supabase
        .from('connections')
        .delete()
        .eq('owner_id', mine)
        .eq('member_id', otherId)
        .eq('status', 'pending');
      if (error) throw error;
      setConnStatus('none');
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', e?.message ?? 'Could not cancel request.');
    }
  };

  const acceptRequest = async () => {
    if (!otherId) return;
    try {
      const { error } = await supabase
        .from('connections')
        .update({ status: 'accepted' })
        .eq('owner_id', otherId)
        .eq('member_id', mine)
        .eq('status', 'pending');
      if (error) throw error;

      setConnStatus('accepted');
      setCurrentCat('General Public');
      setSelectedCat('General Public');
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', e?.message ?? 'Could not accept request.');
    }
  };

  const declineRequest = async () => {
    if (!otherId) return;
    try {
      const { error } = await supabase
        .from('connections')
        .delete()
        .eq('owner_id', otherId)
        .eq('member_id', mine)
        .eq('status', 'pending');
      if (error) throw error;
      setConnStatus('none');
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', e?.message ?? 'Could not decline request.');
    }
  };

  const placeLine = (t: TripRow): string => {
    const country = countryNameFromCode(String(t.destination_country_code || '')).trim();
    const city = (t.destination_city || '').trim();
    return [city, country].filter(Boolean).join(', ');
  };

  const renderTrip = ({ item }: { item: TripRow }) => (
    <View style={styles.tripCard}>
      <Text style={styles.placeText}>
        {placeLine(item)}
        {item.tentative ? <Text style={styles.tentative}> (tentative)</Text> : null}
      </Text>

      <Text style={styles.datesText}>
        {formatDate(item.start_date)}  →  {formatDate(item.end_date)}
      </Text>

      {item.trip_type ? <Text style={styles.typeText}>Trip Type: {item.trip_type}</Text> : null}
    </View>
  );

  if (loading) {
    return (
      <ScreenBackground>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="#fff" />
        </View>
      </ScreenBackground>
    );
  }

  const canEditCategory = connStatus === 'accepted';

  return (
    <ScreenBackground>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.titleText}>Connection</Text>
        </View>

        <View style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={styles.avatarWrap}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Text style={{ color: '#222' }}>👤</Text>
                </View>
              )}
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{profile?.nickname || 'Unknown user'}</Text>
              {!!profile?.home_base && <Text style={styles.sub}>{profile.home_base}</Text>}
              <Text style={[styles.sub, { marginTop: 6 }]}>
                Category: <Text style={{ fontWeight: '700', color: '#fff' }}>{currentCat}</Text>
              </Text>
            </View>
          </View>

          <View style={{ marginTop: 14 }}>
            {connStatus === 'none' && <PrimaryButton title="Add Connection" onPress={sendRequest} />}
            {connStatus === 'pending_out' && <PrimaryButton title="Cancel Request" onPress={cancelRequest} />}
            {connStatus === 'pending_in' && (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <PrimaryButton title="Accept" onPress={acceptRequest} />
                </View>
                <View style={{ flex: 1 }}>
                  <PrimaryButton title="Decline" onPress={declineRequest} />
                </View>
              </View>
            )}
            {connStatus === 'accepted' && <PrimaryButton title="Edit Category" onPress={() => setCatOpen(true)} />}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Upcoming Trips</Text>

        {trips.length === 0 ? (
          <View style={{ paddingHorizontal: 20, marginTop: 6 }}>
            <Text style={{ color: 'rgba(255,255,255,0.85)' }}>No trips to display.</Text>
          </View>
        ) : (
          <FlatList
            data={trips}
            keyExtractor={(t) => t.id}
            renderItem={renderTrip}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
            style={{ flex: 1 }}
          />
        )}

        <View style={styles.footer}>
          <TouchableOpacity onPress={() => router.back()} style={styles.homeChip}>
            <Text style={styles.homeChipText}>Back</Text>
          </TouchableOpacity>
        </View>

        <Modal visible={catOpen} transparent animationType="fade" onRequestClose={() => setCatOpen(false)}>
          <Pressable style={styles.modalBackdrop} onPress={() => setCatOpen(false)}>
            <View />
          </Pressable>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Choose a category</Text>
            <Text style={{ color: '#fff', opacity: 0.8, marginBottom: 8 }}>
              This controls what trips you can see from this connection.
            </Text>

            <View style={{ gap: 8, marginBottom: 8 }}>
              {categoryOptions.map((opt) => {
                const on = selectedCat === opt;
                return (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => setSelectedCat(opt)}
                    style={[styles.choiceRow, on && styles.choiceRowOn]}
                    activeOpacity={0.8}
                    disabled={!canEditCategory}
                  >
                    <View style={[styles.radio, on && styles.radioOn]} />
                    <Text style={styles.choiceText}>{opt}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={saveCategory}
                style={[styles.modalActionBtn, styles.modalPrimary]}
                disabled={!canEditCategory || savingCat}
              >
                <Text style={styles.modalPrimaryText}>{savingCat ? 'Saving…' : 'Save'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setCatOpen(false)} style={styles.modalActionBtn}>
                <Text style={styles.modalCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: { paddingHorizontal: 20, paddingTop: 72, paddingBottom: 10, alignItems: 'center' },
  titleText: { color: '#fff', fontSize: 34, fontWeight: '800' },

  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  card: {
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },

  avatarWrap: { width: 62, height: 62, borderRadius: 31, overflow: 'hidden' },
  avatar: { width: 62, height: 62, borderRadius: 31, backgroundColor: 'rgba(255,255,255,0.12)' },
  avatarPlaceholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.6)' },

  name: { color: '#fff', fontSize: 20, fontWeight: '800' },
  sub: { color: 'rgba(255,255,255,0.75)', marginTop: 2 },

  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 16,
    marginBottom: 10,
    paddingHorizontal: 20,
  },

  tripCard: {
    marginBottom: 14,
    padding: 16,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    opacity: 0.95,
  },
  placeText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  tentative: { color: 'rgba(255,255,255,0.85)', fontStyle: 'italic', fontWeight: '600' },

  datesText: { color: 'rgba(255,255,255,0.92)', fontSize: 14, marginTop: 6 },
  typeText: { color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 8 },

  footer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
    backgroundColor: 'rgba(10,10,18,0.55)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
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

  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  modalCard: {
    position: 'absolute',
    left: 20,
    right: 20,
    top: 160,
    borderRadius: 16,
    padding: 12,
    backgroundColor: 'rgba(10,10,18,0.98)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  modalTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 8 },

  modalActions: { marginTop: 10, gap: 8 },

  modalActionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  modalPrimary: { backgroundColor: 'rgba(70,125,255,0.9)', borderColor: 'rgba(255,255,255,0.35)' },
  modalPrimaryText: { color: '#fff', fontWeight: '800' },
  modalCloseText: { color: '#fff', fontWeight: '700' },

  choiceRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  choiceRowOn: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderColor: 'rgba(255,255,255,0.55)',
  },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: 'rgba(255,255,255,0.65)' },
  radioOn: { backgroundColor: 'rgba(70,125,255,0.9)', borderColor: 'rgba(255,255,255,0.85)' },
  choiceText: { color: '#fff' },
});