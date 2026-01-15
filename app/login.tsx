import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from './lib/supabase';
import { finalizePasswordLogin } from './lib/biometricLogin';
import ScreenBackground from '../components/ScreenBackground';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.session) {
        Alert.alert('Sign in error', error?.message ?? 'Unknown error');
        return;
      }
      await finalizePasswordLogin(data.session, true);
      router.replace('/home');
    } catch (e: any) {
      Alert.alert('Sign in error', e?.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenBackground>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.select({ ios: 'padding', android: undefined })}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.title}>Panterix</Text>
            <Text style={styles.subtitle}>The future of travel is here.</Text>
          </View>

          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="rgba(255,255,255,0.6)"
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="rgba(255,255,255,0.6)"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            <TouchableOpacity style={styles.signInBtn} onPress={handleSignIn} disabled={loading}>
              <Text style={styles.signInText}>{loading ? 'Signing In…' : 'Sign In'}</Text>
            </TouchableOpacity>

            {/* Sign Up button styled like Home screen's Sign Out */}
            <TouchableOpacity style={styles.signUpButton} onPress={() => router.push('/signup')}>
              <Text style={styles.signUpText}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  contentContainer: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },

  header: { alignItems: 'center', marginTop: 60, marginBottom: 50 },
  title: { fontSize: 84, fontWeight: '200', color: '#ffffff', marginBottom: 40, textAlign: 'center' },
  subtitle: { fontSize: 32, color: '#ffffff', textAlign: 'center', fontWeight: '200', lineHeight: 38 },

  form: { width: '86%', maxWidth: 420, alignItems: 'center' },

  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 14,
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },

  signInBtn: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    alignItems: 'center',
    width: '60%',
    alignSelf: 'center',
  },
  signInText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },

  // "Sign Up" matches Home screen's Sign Out button style
  signUpButton: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    alignSelf: 'center',
  },
  signUpText: { color: '#ffffff', fontSize: 12, fontWeight: 'normal' },
});
