// app/my-profile.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';
import ScreenBackground from '../components/ScreenBackground';
import PrimaryButton from '../components/PrimaryButton';
import { useRouter } from 'expo-router';
import { supabase } from './lib/supabase';
import * as FileSystem from 'expo-file-system';

// Build a public URL for an avatar path. Optionally add a cache-buster.
function publicAvatarUrl(raw?: string | null, opts?: { bust?: boolean }): string | undefined {
  if (!raw) return undefined;
  let url: string;
  if (/^https?:\/\//i.test(raw)) {
    url = raw;
  } else {
    try {
      const { data } = supabase.storage.from('avatars').getPublicUrl(raw);
      url = data.publicUrl;
    } catch {
      return undefined;
    }
  }
  if (opts?.bust) {
    url += (url.includes('?') ? '&' : '?') + 'v=' + Date.now();
  }
  return url;
}

type ProfileRow = {
  user_id: string;
  nickname: string | null;
  home_base: string | null;
  photo_url: string | null;
};

async function fileUriToBlob(uri: string): Promise<Blob> {
  try {
    const r = await fetch(uri);
    return await r.blob();
  } catch {
    const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    const r2 = await fetch(`data:image/jpeg;base64,${b64}`);
    return await r2.blob();
  }
}

export default function MyProfile() {
  const router = useRouter();
  const [mine, setMine] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [nickname, setNickname] = useState('');
  const [homeBase, setHomeBase] = useState('');
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not signed in');
        setMine(user.id);

        const { data, error } = await supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle();
        if (error) throw error;
        if (data) {
          const p = data as ProfileRow;
          setNickname(p.nickname || '');
          setHomeBase(p.home_base || '');
          setPhotoPath(p.photo_url || null);
          setPreviewUrl(publicAvatarUrl(p.photo_url)); // initial (no bust)
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Robust picker/uploader with UID guard + signed-upload fallback + verify
  const pickImage = async (source: 'camera' | 'library') => {
    try {
      if (!mine) { Alert.alert('Please wait', 'Your account is still loading.'); return; }

      const ImagePicker = await import('expo-image-picker');

      // Permissions
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') { Alert.alert('Permission needed', 'Camera access is required.'); return; }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') { Alert.alert('Permission needed', 'Photo library access is required.'); return; }
      }

      // Launch picker
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: true, aspect: [1, 1], mediaTypes: ImagePicker.MediaTypeOptions.Images })
          : await ImagePicker.launchImageLibraryAsync({ quality: 0.8, allowsEditing: true, aspect: [1, 1], mediaTypes: ImagePicker.MediaTypeOptions.Images });

      // @ts-ignore
      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset?.uri) { Alert.alert('Error', 'No image returned from picker.'); return; }

      // Resize & compress
      const ImageManipulator = await import('expo-image-manipulator');
      const manipulated = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 900 } }],
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
      );

      const blob = await fileUriToBlob(manipulated.uri);
      const path = `${mine}/${Date.now()}.jpg`;
      console.log('Uploading to:', path);

      // Try normal upload first
      let uploaded = false;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, blob, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: true,
      });

      if (!upErr) {
        uploaded = true;
      } else {
        console.warn('upload() failed; attempting signed upload:', upErr?.message);

        // Fallback: signed upload URL
        const { data: signed, error: signErr } = await supabase
          .storage
          .from('avatars')
          .createSignedUploadUrl(path);

        if (signErr || !signed?.signedUrl) {
          console.error('createSignedUploadUrl failed:', signErr);
          Alert.alert('Upload failed', signErr?.message ?? upErr.message ?? 'Could not upload photo.');
          return;
        }

        const putRes = await fetch(signed.signedUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'image/jpeg' },
          body: blob,
        });
        if (!putRes.ok) {
          const body = await putRes.text().catch(() => '');
          console.error('PUT to signed url failed:', putRes.status, body);
          Alert.alert('Upload failed', `HTTP ${putRes.status}: ${body || 'Could not upload photo.'}`);
          return;
        }
        uploaded = true;
      }

      // Verify presence (non-fatal if list fails)
      if (uploaded) {
        const { data: list, error: listErr } = await supabase.storage.from('avatars')
          .list(mine, { sortBy: { column: 'created_at', order: 'desc' }, limit: 5 });
        if (listErr) console.warn('list() error (non-fatal):', listErr?.message);

        setPhotoPath(path);
        // Bust CDN cache so <Image> refreshes immediately
        setPreviewUrl(publicAvatarUrl(path, { bust: true }));
        Alert.alert('Photo updated', 'Looks great!');
      }
    } catch (e: any) {
      console.error('pickImage error:', e);
      Alert.alert('Upload failed', e?.message ?? 'Could not upload photo.');
    }
  };

  const save = async () => {
    try {
      setSaving(true);
      const payload: ProfileRow = {
        user_id: mine,
        nickname: nickname.trim() || null,
        home_base: homeBase.trim() || null,
        photo_url: photoPath,
      };
      const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'user_id' });
      if (error) throw error;
      Alert.alert('Saved', 'Your profile has been updated.');
      router.back();
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', e?.message ?? 'Could not save profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ScreenBackground>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color="#fff" />
        </View>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>My Profile</Text>
        </View>

        <View style={styles.body}>
          <View style={styles.card}>
            <View style={styles.avatarWrap}>
              {previewUrl ? (
                <Image source={{ uri: previewUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Text style={{ color: '#222' }}>👤</Text>
                </View>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Nickname</Text>
              <TouchableOpacity
                activeOpacity={1}
                style={styles.input}
                onPress={() => Alert.prompt?.('Nickname', 'Enter your nickname', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'OK', onPress: (t) => t != null && setNickname(String(t)) }
                ], 'plain-text', nickname)}
              >
                <Text style={styles.inputText}>{nickname || 'Tap to set…'}</Text>
              </TouchableOpacity>

              <Text style={[styles.label, { marginTop: 10 }]}>Home Base</Text>
              <TouchableOpacity
                activeOpacity={1}
                style={styles.input}
                onPress={() => Alert.prompt?.('Home Base', 'City / Place', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'OK', onPress: (t) => t != null && setHomeBase(String(t)) }
                ], 'plain-text', homeBase)}
              >
                <Text style={styles.inputText}>{homeBase || 'Tap to set…'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 20 }}>
            <PrimaryButton
              title="Take Photo"
              onPress={() => pickImage('camera')}
              style={{ flex: 1 }}
              disabled={!mine || loading}
            />
            <PrimaryButton
              title="Choose Photo"
              onPress={() => pickImage('library')}
              style={{ flex: 1 }}
              disabled={!mine || loading}
            />
          </View>
        </View>

        <View style={styles.footer}>
          <PrimaryButton title={saving ? 'Saving…' : 'Save'} onPress={save} loading={saving} style={styles.footerBtn} />

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
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 72, paddingBottom: 10, alignItems: 'center' },
  title: { color: '#fff', fontSize: 32, fontWeight: '800', textAlign: 'center' },

  body: { flex: 1, gap: 16, paddingVertical: 8 },
  card: {
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },

  label: { color: '#fff', opacity: 0.9, fontSize: 12, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12, backgroundColor: 'rgba(255,255,255,0.06)',
  },
  inputText: { color: '#fff' },

  avatarWrap: { width: 80, height: 80, borderRadius: 40, overflow: 'hidden' },
  avatar: { width: 80, height: 80, borderRadius: 40 },
  avatarPlaceholder: { justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.6)' },

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

  footerRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    marginTop: 4,
  },
  chip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  chipText: { color: '#ffffff', fontSize: 12, textAlign: 'center' },
});
