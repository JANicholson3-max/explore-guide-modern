// app/signup.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import ScreenBackground from '../components/ScreenBackground';
import PrimaryButton from '../components/PrimaryButton';
import { supabase } from './lib/supabase';

export default function SignUp() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [loading, setLoading] = useState(false);

  const onSignUp = async () => {
    try {
      if (!email || !pw) return Alert.alert('Missing info', 'Please enter email and password.');
      if (pw !== pw2) return Alert.alert('Passwords do not match', 'Please re-enter your password.');
      setLoading(true);

      const { data, error } = await supabase.auth.signUp({
        email,
        password: pw,
        // If you keep email confirmations ON, you can pass a redirect:
        // options: { emailRedirectTo: 'https://your-site.example.com/auth/callback' },
      });
      if (error) throw error;

      // If email confirmation is ON, user must confirm before session is active
      if (data.user && !data.session) {
        Alert.alert('Check your email', 'We sent you a confirmation link. After confirming, open the app and log in.');
        router.replace('/login');
        return;
      }

      // If confirmation is OFF, you’re signed in immediately
      router.replace('/home');
    } catch (e: any) {
      console.error(e);
      Alert.alert('Sign up failed', e?.message ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenBackground>
      <View style={styles.header}>
        <Text style={styles.title}>Create Account</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor="rgba(255,255,255,0.5)"
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={pw}
          onChangeText={setPw}
          placeholder="••••••••"
          placeholderTextColor="rgba(255,255,255,0.5)"
          autoCapitalize="none"
          secureTextEntry
        />

        <Text style={styles.label}>Confirm Password</Text>
        <TextInput
          style={styles.input}
          value={pw2}
          onChangeText={setPw2}
          placeholder="••••••••"
          placeholderTextColor="rgba(255,255,255,0.5)"
          autoCapitalize="none"
          secureTextEntry
        />

        <PrimaryButton title={loading ? 'Creating…' : 'Create Account'} onPress={onSignUp} loading={loading} style={{ marginTop: 12 }} />

        <TouchableOpacity onPress={() => router.replace('/login')} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>Back to Log In</Text>
        </TouchableOpacity>
      </View>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 10 },
  title: { color: '#fff', fontSize: 36, fontWeight: '800' },
  content: { paddingHorizontal: 20, paddingTop: 10 },
  label: { color: '#fff', opacity: 0.9, marginTop: 10, marginBottom: 8, fontSize: 14 },
  input: {
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12, color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  cancelBtn: {
    marginTop: 14, paddingVertical: 8, paddingHorizontal: 20, alignSelf: 'center',
    backgroundColor: 'rgba(155, 30, 53, 0.16)', borderRadius: 15, borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.28)',
  },
  cancelText: { color: '#fff', fontSize: 12, textAlign: 'center' },
});
