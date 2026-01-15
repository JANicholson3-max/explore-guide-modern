// app/lib/supabase.ts
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import appConfig from '../../app.json';

/**
 * Read from app.json -> expo.extra (already populated with your real values).
 * We also keep a hardcoded fallback to guarantee availability even if extra
 * is somehow not visible in this build context.
 */
const EXTRA: any = (appConfig as any)?.expo?.extra ?? {};

const SUPABASE_URL: string =
  EXTRA.supabaseUrl ||
  'https://xsipeygwjfqseyvpgudy.supabase.co';

const SUPABASE_ANON_KEY: string =
  EXTRA.supabaseAnonKey ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhzaXBleWd3amZxc2V5dnBndWR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0MTA0NjksImV4cCI6MjA2Nzk4NjQ2OX0.ho39dVU6F4lNO1_sLEhVjJcTfpm_3jpaTqQUQGpQz5s';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Supabase config missing: URL or anon key is empty.');
}

/**
 * SSR-safe storage adapter:
 * - In SSR/Node (no window): no-op (prevents "window is not defined").
 * - On web runtime: wrap localStorage with async interface.
 * - On native: use AsyncStorage.
 */
const isSSR = typeof window === 'undefined';

type AsyncKV = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

const noopStorage: AsyncKV = {
  async getItem() { return null; },
  async setItem() {},
  async removeItem() {},
};

const webLocalStorageAdapter: AsyncKV = {
  async getItem(key) { return window.localStorage.getItem(key); },
  async setItem(key, value) { window.localStorage.setItem(key, value); },
  async removeItem(key) { window.localStorage.removeItem(key); },
};

const storage: AsyncKV =
  isSSR
    ? noopStorage
    : (Platform.OS === 'web' ? webLocalStorageAdapter : (AsyncStorage as unknown as AsyncKV));

/**
 * For SSR, avoid background auth timers.
 * On device/web runtime, enable normal behavior.
 */
const authOptions = {
  persistSession: !isSSR,          // don't try to persist during SSR
  autoRefreshToken: !isSSR,        // no timers in SSR
  detectSessionInUrl: false,       // Expo Router/web static export doesn't need URL parsing
  storage,
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: authOptions,
});