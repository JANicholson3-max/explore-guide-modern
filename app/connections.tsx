// app/connections.tsx
import React, { useEffect, useMemo, useState } from 'react';
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
  TextInput,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import ScreenBackground from '../components/ScreenBackground';
import PrimaryButton from '../components/PrimaryButton';
import { supabase } from './lib/supabase';

type Profile = {
  user_id: string;
  nickname: string | null;
  home_base: string | null;
  photo_url: string | null;
};

type ConnRow = { owner_id: string; member_id: string; status: 'pending' | 'accepted' | 'blocked' };

type Item =
  | { otherId: string; profile?: Profile; role: 'accepted' }
  | { otherId: string; profile?: Profile; role: 'incoming' | 'outgoing' };

type AudienceCategory = 'Close Friends' | 'Family' | 'Colleagues' | 'General Public';

function isHttpUrl(s?: string | null) {
  return !!s && /^https?:\/\//i.test(s);
}

async function resolveAvatarUrl(raw?: string | null): Promise<string | undefined> {
  if (!raw) return undefined;

  // If already a full URL, use it (cache-bust to show latest)
  if (isHttpUrl(raw)) {
    return raw + (raw.includes('?') ? '&' : '?') + 'v=' + Date.now();
  }

  // Prefer signed URL (works for private buckets if Storage policies allow authenticated reads)
  const { data: signed, error: sErr } = await supabase.storage.from('avatars').createSignedUrl(raw, 60 * 60);
  if (!sErr && signed?.signedUrl) {
    return signed.signedUrl + (signed.signedUrl.includes('?') ? '&' : '?') + 'v=' + Date.now();
  }

  // Fallback to public URL (works only if bucket/object is public)
  try {
    const { data } = supabase.storage.from('avatars').getPublicUrl(raw);
    if (data?.publicUrl) {
      return data.publicUrl + (data.publicUrl.includes('?') ? '&' : '?') + 'v=' + Date.now();
    }
  } catch {
    // ignore
  }

  return undefined;
}

export default function Connections() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [mine, setMine] = useState<string>('');
  const [rows, setRows] = useState<ConnRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});

  // Resolved avatar URLs for rendering
  const [avatarUrls, setAvatarUrls] = useState<Record<string, string>>({});

  // Add-connection modal state
  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [searching, setSearching] = useState(false);
  const [found, setFound] = useState<Profile | null>(null);
  const [foundAvatarUrl, setFoundAvatarUrl] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Accept-with-category modal state
  const [catOpen, setCatOpen] = useState(false);
  const [choosingFor, setChoosingFor] = useState<string | null>(null);
  const [selectedCat, setSelectedCat] = useState<AudienceCategory>('General Public');
  const categoryOptions: AudienceCategory[] = ['Close Friends', 'Family', 'Colleagues', 'General Public'];
  const [accepting, setAccepting] = useState(false);

  const load = async () => {
    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');
      setMine(user.id);

      const { data: conns, error } = await supabase
        .from('connections')
        .select('owner_id,member_id,status')
        .or(`owner_id.eq.${user.id},member_id.eq.${user.id}`)
        .in('status', ['accepted', 'pending']);

      if (error) throw error;
      setRows(conns || []);

      // gather all "other" ids to fetch profiles in one go
      const otherIds = new Set<string>();
      (conns || []).forEach((c) => {
        otherIds.add(c.owner_id === user.id ? c.member_id : c.owner_id);
      });

      if (otherIds.size) {
        const { data: profs, error: pErr } = await supabase
          .from('profiles')
          .select('user_id,nickname,home_base,photo_url')
          .in('user_id', Array.from(otherIds));

        if (pErr) throw pErr;

        const map: Record<string, Profile> = {};
        (profs || []).forEach((p: any) => {
          // IMPORTANT: normalize in case profiles table returns `id` instead of `user_id`
          const uid = (p.user_id ?? p.id) as string;
          map[uid] = { ...(p as Profile), user_id: uid };
        });

        setProfiles(map);
      } else {
        setProfiles({});
      }
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', e?.message ?? 'Could not load connections.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Resolve avatars whenever profiles load/change
  useEffect(() => {
    const run = async () => {
      const entries = Object.entries(profiles);
      for (const [uid, p] of entries) {
        if (!p?.photo_url) continue;
        if (avatarUrls[uid]) continue;

        const url = await resolveAvatarUrl(p.photo_url);
        if (url) {
          setAvatarUrls((prev) => ({ ...prev, [uid]: url }));
        }
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profiles]);

  // Merge accepted first, then pending (incoming/outgoing)
  const items: Item[] = useMemo(() => {
    const all: Item[] = rows
      .filter((r) => r.status !== 'blocked')
      .map((r) => {
        const otherId = r.owner_id === mine ? r.member_id : r.owner_id;
        if (r.status === 'accepted') return { otherId, profile: profiles[otherId], role: 'accepted' as const };
        const role = r.member_id === mine ? ('incoming' as const) : ('outgoing' as const);
        return { otherId, profile: profiles[otherId], role };
      });

    return all.sort((a, b) => {
      const rank = (x: Item) => (x.role === 'accepted' ? 0 : 1);
      return rank(a) - rank(b);
    });
  }, [rows, profiles, mine]);

  // Actions for pending
  const openCategoryFor = (otherId: string) => {
    setChoosingFor(otherId);
    setSelectedCat('General Public');
    setCatOpen(true);
  };

  const acceptWithCategory = async () => {
    if (!choosingFor) return;
    try {
      setAccepting(true);

      // Accept the request (other invited me)
      const { error: uErr } = await supabase
        .from('connections')
        .update({ status: 'accepted' })
        .eq('owner_id', choosingFor)
        .eq('member_id', mine)
        .eq('status', 'pending');
      if (uErr) throw uErr;

      // Save category selection
      if (selectedCat === 'General Public') {
        await supabase.from('audience_memberships').delete().eq('owner_id', mine).eq('member_id', choosingFor);
      } else {
        const { error: iErr } = await supabase
          .from('audience_memberships')
          .upsert({ owner_id: mine, member_id: choosingFor, audience: selectedCat }, { onConflict: 'owner_id,member_id' });
        if (iErr) throw iErr;
      }

      setCatOpen(false);
      setChoosingFor(null);
      await load();
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', e?.message ?? 'Could not accept.');
    } finally {
      setAccepting(false);
    }
  };

  const declineIncoming = async (otherId: string) => {
    try {
      const { error } = await supabase
        .from('connections')
        .delete()
        .eq('owner_id', otherId)
        .eq('member_id', mine)
        .eq('status', 'pending');
      if (error) throw error;
      await load();
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', e?.message ?? 'Could not decline.');
    }
  };

  const cancelOutgoing = async (otherId: string) => {
    try {
      const { error } = await supabase
        .from('connections')
        .delete()
        .eq('owner_id', mine)
        .eq('member_id', otherId)
        .eq('status', 'pending');
      if (error) throw error;
      await load();
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', e?.message ?? 'Could not cancel.');
    }
  };

  // Add connection modal
  const openAdd = () => {
    setEmail('');
    setFound(null);
    setFoundAvatarUrl(null);
    setSearchError(null);
    setEmailOpen(true);
  };

  const searchByEmail = async () => {
    const e = email.trim().toLowerCase();
    if (!e) {
      setSearchError('Enter an email.');
      return;
    }

    setSearchError(null);
    setSearching(true);
    setFound(null);
    setFoundAvatarUrl(null);

    try {
      const { data, error } = await supabase.rpc('find_user_by_email', { p_email: e });
      if (error) throw error;
      if (!data) {
        setSearchError('No user with that email.');
        return;
      }

      const uid = (data.user_id ?? data.id) as string;
      if (uid === mine) {
        setSearchError('That email is you 🙂');
        return;
      }

      const prof: Profile = {
        user_id: uid,
        nickname: data.nickname ?? null,
        home_base: data.home_base ?? null,
        photo_url: data.photo_url ?? null,
      };

      setFound(prof);

      const url = await resolveAvatarUrl(prof.photo_url);
      setFoundAvatarUrl(url ?? null);
    } catch (err: any) {
      console.error(err);
      setSearchError(err?.message ?? 'Lookup failed.');
    } finally {
      setSearching(false);
    }
  };

  const requestConnection = async () => {
    if (!found) return;
    try {
      setRequesting(true);
      const { error } = await supabase.from('connections').insert({
        owner_id: mine,
        member_id: found.user_id,
        status: 'pending',
      });
      if (error) throw error;

      Alert.alert('Request sent', 'They will see your request in Connections.');
      setEmailOpen(false);
      await load();
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', e?.message ?? 'Could not send request.');
    } finally {
      setRequesting(false);
    }
  };

  const renderItem = ({ item }: { item: Item }) => {
    const p = item.profile;
    const title = p?.nickname || 'Unknown user';
    const subtitle = p?.home_base || '';

    const uri = avatarUrls[item.otherId] || '';

    const pending = item.role !== 'accepted';
    const incoming = item.role === 'incoming';
    const outgoing = item.role === 'outgoing';

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        style={[styles.card, pending && styles.cardPending]}
        onPress={() => router.push({ pathname: '/view-profile/[id]', params: { id: item.otherId } })}
      >
        <View style={styles.avatarWrap}>
          {uri ? (
            <Image source={{ uri }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={{ color: '#222' }}>👤</Text>
            </View>
          )}
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{title}</Text>
          {!!subtitle && <Text style={styles.sub}>{subtitle}</Text>}

          {pending && (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              {incoming && (
                <>
                  <View style={styles.badgeIncoming}>
                    <Text style={styles.badgeText}>Incoming request</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => openCategoryFor(item.otherId)}
                    style={[styles.smallBtn, styles.smallBtnPrimary]}
                  >
                    <Text style={styles.smallBtnText}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => declineIncoming(item.otherId)} style={styles.smallBtn}>
                    <Text style={styles.smallBtnText}>Decline</Text>
                  </TouchableOpacity>
                </>
              )}
              {outgoing && (
                <>
                  <View style={styles.badgeOutgoing}>
                    <Text style={styles.badgeText}>Pending</Text>
                  </View>
                  <TouchableOpacity onPress={() => cancelOutgoing(item.otherId)} style={styles.smallBtn}>
                    <Text style={styles.smallBtnText}>Cancel</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScreenBackground>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Panterix Connections</Text>
        </View>

        <View style={styles.body}>
          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color="#fff" />
            </View>
          ) : items.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Text style={{ color: '#fff', opacity: 0.9 }}>No connections yet.</Text>
              <Text style={{ color: '#fff', opacity: 0.7, marginTop: 8 }}>Tap “Add Connection” to get started.</Text>
            </View>
          ) : (
            <FlatList
              style={styles.list}
              contentContainerStyle={styles.listContent}
              data={items}
              keyExtractor={(it) => it.otherId + ':' + it.role}
              renderItem={renderItem}
            />
          )}
        </View>

        <View style={styles.footer}>
          <PrimaryButton title="Add Connection" onPress={openAdd} style={styles.footerBtn} />
          <PrimaryButton title="My Profile" onPress={() => router.push('/my-profile')} style={styles.footerBtn} />

          <View style={styles.footerRow}>
            <TouchableOpacity onPress={() => router.back()} style={styles.chip}>
              <Text style={styles.chipText}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.replace('/home')} style={styles.chip}>
              <Text style={styles.chipText}>Home</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Add Connection modal */}
      <Modal visible={emailOpen} transparent animationType="fade" onRequestClose={() => setEmailOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setEmailOpen(false)}>
          <View />
        </Pressable>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Add Connection</Text>

          <TextInput
            style={styles.modalSearch}
            placeholder="Friend’s email address"
            placeholderTextColor="rgba(255,255,255,0.6)"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />

          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
            <TouchableOpacity
              onPress={searchByEmail}
              style={[styles.modalActionBtn, styles.modalPrimary]}
              disabled={searching}
            >
              <Text style={styles.modalPrimaryText}>{searching ? 'Searching…' : 'Search'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setFound(null);
                setFoundAvatarUrl(null);
                setSearchError(null);
                setEmail('');
              }}
              style={styles.modalActionBtn}
            >
              <Text style={styles.modalCloseText}>Clear</Text>
            </TouchableOpacity>
          </View>

          {searchError && <Text style={{ color: '#ff9aa2', marginBottom: 8 }}>{searchError}</Text>}

          {found && (
            <View style={[styles.card, styles.previewCard]}>
              <View style={styles.avatarWrap}>
                {foundAvatarUrl ? (
                  <Image source={{ uri: foundAvatarUrl }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <Text style={{ color: '#222' }}>👤</Text>
                  </View>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{found.nickname || 'Unknown user'}</Text>
                {!!found.home_base && <Text style={styles.sub}>{found.home_base}</Text>}
              </View>
            </View>
          )}

          <View style={styles.modalActions}>
            {found && (
              <TouchableOpacity
                onPress={requestConnection}
                style={[styles.modalActionBtn, styles.modalPrimary]}
                disabled={requesting}
              >
                <Text style={styles.modalPrimaryText}>{requesting ? 'Requesting…' : 'Request Connection'}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => setEmailOpen(false)} style={styles.modalActionBtn}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Accept with Category modal */}
      <Modal visible={catOpen} transparent animationType="fade" onRequestClose={() => setCatOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setCatOpen(false)}>
          <View />
        </Pressable>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Choose a category</Text>
          <Text style={{ color: '#fff', opacity: 0.8, marginBottom: 8 }}>
            How do you want to categorize this connection?
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
                >
                  <View style={[styles.radio, on && styles.radioOn]} />
                  <Text style={styles.choiceText}>{opt}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity
              onPress={acceptWithCategory}
              style={[styles.modalActionBtn, styles.modalPrimary]}
              disabled={accepting}
            >
              <Text style={styles.modalPrimaryText}>{accepting ? 'Accepting…' : 'Accept & Save'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setCatOpen(false)} style={styles.modalActionBtn}>
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 72, paddingBottom: 10, alignItems: 'center' },
  title: { color: '#fff', fontSize: 32, fontWeight: '800', textAlign: 'center' },

  body: { flex: 1 },
  list: { flex: 1 },
  listContent: { padding: 20, paddingBottom: 140 },
  emptyWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 20 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  card: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    marginBottom: 14,
    padding: 16,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  previewCard: { marginTop: 8, marginBottom: 10 },
  cardPending: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.28)',
  },

  avatarWrap: { width: 56, height: 56, borderRadius: 28, overflow: 'hidden' },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarPlaceholder: { justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.6)' },

  name: { color: '#fff', fontSize: 18, fontWeight: '800' },
  sub: { color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 2 },

  badgeIncoming: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(70,125,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(70,125,255,0.55)',
  },
  badgeOutgoing: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  badgeText: { color: '#fff', fontSize: 11 },

  smallBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  smallBtnPrimary: { backgroundColor: 'rgba(70,125,255,0.9)', borderColor: 'rgba(255,255,255,0.35)' },
  smallBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  footer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
    backgroundColor: 'rgba(10,10,18,0.55)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  footerBtn: { marginBottom: 10 },

  footerRow: { flexDirection: 'row', gap: 12, justifyContent: 'space-between', marginTop: 4 },
  chip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  chipText: { color: '#ffffff', fontSize: 12 },

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