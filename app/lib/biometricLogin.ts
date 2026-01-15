// app/lib/biometricLogin.ts
// Biometric login helper with web-safe fallbacks.
// iOS/Android: uses expo-local-authentication + expo-secure-store.
// Web: disables biometrics and uses localStorage so preview never crashes.

import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

const KEY_BIOMETRIC_PREF = 'biometric_enabled';
const KEY_SESSION = 'supabase_session';

// ---- Storage wrapper (web -> localStorage, native -> SecureStore) ----
const storage = {
  async setItem(key: string, value: string) {
    if (Platform.OS === 'web') {
      try { window.localStorage.setItem(key, value); } catch {}
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  async getItem(key: string) {
    if (Platform.OS === 'web') {
      try { return window.localStorage.getItem(key); } catch { return null; }
    }
    return SecureStore.getItemAsync(key);
  },
  async deleteItem(key: string) {
    if (Platform.OS === 'web') {
      try { window.localStorage.removeItem(key); } catch {}
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

// ---------- Preference helpers ----------
export async function getBiometricPreference(): Promise<boolean> {
  // Never attempt biometrics on web
  if (Platform.OS === 'web') return false;
  try {
    const v = await storage.getItem(KEY_BIOMETRIC_PREF);
    return v === '1';
  } catch {
    return false;
  }
}

export async function setBiometricPreference(enabled: boolean): Promise<void> {
  if (Platform.OS === 'web') return; // ignore on web
  if (enabled) {
    await storage.setItem(KEY_BIOMETRIC_PREF, '1');
  } else {
    await storage.deleteItem(KEY_BIOMETRIC_PREF);
  }
}

// ---------- Capability checks ----------
export async function isBiometricsAvailable(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const supported = await LocalAuthentication.supportedAuthenticationTypesAsync();
    return hasHardware && supported.length > 0;
  } catch {
    return false;
  }
}

// ---------- Session storage ----------
export async function saveSession(session: Session | null | undefined): Promise<void> {
  if (!session) return;
  await storage.setItem(KEY_SESSION, JSON.stringify(session));
}

export async function clearSavedSession(): Promise<void> {
  await storage.deleteItem(KEY_SESSION);
}

async function loadSavedSession(): Promise<Session | null> {
  try {
    const raw = await storage.getItem(KEY_SESSION);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

// ---------- Main flows ----------
export async function finalizePasswordLogin(session: Session, enrollBiometrics = true): Promise<void> {
  await saveSession(session);
  if (enrollBiometrics && (await isBiometricsAvailable())) {
    await setBiometricPreference(true);
  }
}

export async function tryBiometricLogin(promptMessage = 'Log in with Face ID'): Promise<boolean> {
  // Never try on web
  if (Platform.OS === 'web') return false;

  const pref = await getBiometricPreference();
  if (!pref) return false;

  if (!(await isBiometricsAvailable())) return false;

  const res = await LocalAuthentication.authenticateAsync({
    promptMessage,
    disableDeviceFallback: false,
  });
  if (!res.success) return false;

  const saved = await loadSavedSession();
  if (!saved) return false;

  const { data, error } = await supabase.auth.setSession({
    access_token: saved.access_token,
    refresh_token: saved.refresh_token,
  });

  return !!data?.session && !error;
}

// Optional helpers
export async function signInWithPasswordAndMaybeEnroll(
  email: string,
  password: string,
  enrollBiometrics = true
): Promise<Session> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw error ?? new Error('No session returned');
  await finalizePasswordLogin(data.session, enrollBiometrics);
  return data.session;
}

export async function signOutEverywhere(): Promise<void> {
  await clearSavedSession();
  await setBiometricPreference(false);
  await supabase.auth.signOut();
}
