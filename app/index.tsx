import { useEffect, useState } from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
import { router } from 'expo-router';
import { supabase } from './lib/supabase';
import { tryBiometricLogin, getBiometricPreference } from './lib/biometricLogin';

export default function Index() {
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const biometricsOn = Platform.OS !== 'web' && (await getBiometricPreference());

        if (biometricsOn) {
          // Small delay so the Face ID prompt isn’t jarring on cold start
          await new Promise((res) => setTimeout(res, 400));
          const ok = await tryBiometricLogin('Unlock with Face ID');
          if (!cancelled && ok) {
            router.replace('/home');
            return;
          }
        } else {
          // No biometrics enrolled → go straight to login quickly
          if (!cancelled) {
            router.replace('/login');
            return;
          }
        }

        // Fallback session check (e.g., refresh/resume)
        const { data } = await supabase.auth.getSession();
        if (!cancelled) {
          if (data.session) router.replace('/home');
          else router.replace('/login');
        }
      } catch {
        if (!cancelled) router.replace('/login');
      } finally {
        if (!cancelled) setChecking(false);
      }
    };

    run();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && !cancelled) router.replace('/home');
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator />
    </View>
  );
}
