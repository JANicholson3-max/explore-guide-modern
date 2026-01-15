// app/lib/avatarUpload.ts
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from './supabase';

const MAX_BYTES = 1_048_576; // 1 MiB

async function compressToUnder(uri: string) {
  // First pass (what you already had)
  let ops = [{ resize: { width: 800 } }] as ImageManipulator.Action[];
  let quality = 0.7;

  // Try up to 3 attempts shrinking a bit each time
  for (let i = 0; i < 3; i++) {
    const out = await ImageManipulator.manipulateAsync(uri, ops, {
      compress: quality,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    const blob = await (await fetch(out.uri)).blob();
    if (blob.size <= MAX_BYTES) return { uri: out.uri, blob };

    // tighten for next round
    quality = Math.max(0.5, quality - 0.1);
    ops = [{ resize: { width: Math.max(500, Math.round((ops[0] as any).resize.width * 0.85)) } }];
    uri = out.uri;
  }

  // Return the smallest we got
  const finalOut = await ImageManipulator.manipulateAsync(uri, ops, {
    compress: quality,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  const finalBlob = await (await fetch(finalOut.uri)).blob();
  return { uri: finalOut.uri, blob: finalBlob };
}

type PickSource = 'camera' | 'library';

export async function pickCompressAndUploadAvatar(source: PickSource) {
  // Permissions + pick
  if (source === 'camera') {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') throw new Error('Camera permission denied');
  } else {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') throw new Error('Media library permission denied');
  }

  const result = await (source === 'camera'
    ? ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 1 })
    : ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], quality: 1, mediaTypes: ImagePicker.MediaTypeOptions.Images })
  );
  if (result.canceled) throw new Error('User cancelled');
  const asset = result.assets[0];

  // Compress until under MAX_BYTES
  const { blob } = await compressToUnder(asset.uri);

  // Upload
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;
  if (!user) throw new Error('Not signed in');

  const filename = `avatar_${Date.now()}.jpg`;
  const storagePath = `${user.id}/${filename}`;
  const { error: upErr } = await supabase.storage.from('avatars').upload(storagePath, blob, {
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (upErr) throw upErr;

  const { data: pub } = supabase.storage.from('avatars').getPublicUrl(storagePath);
  return { publicUrl: pub.publicUrl, storagePath };
}
