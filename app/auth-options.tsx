import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';
import { supabase } from './lib/supabase';
import { EmailAuthForm } from '../components/EmailAuthForm';

export default function AuthOptions() {
  const [loading, setLoading] = useState(false);

  const handleSignIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      console.log('=== SIGN IN DEBUG ===');
      console.log('Email:', email);
      console.log('Password length:', password.length);
      console.log('Supabase client:', !!supabase);
      
      // Test if Supabase client is working
      const { data: testData, error: testError } = await supabase.auth.getSession();
      console.log('Current session test:', testData, testError);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      console.log('Sign in response:', { data, error });

      if (error) {
        console.error('Sign in error:', error);
        Alert.alert('Sign In Error', error.message || 'Unknown error occurred');
        return;
      }

      if (data?.user) {
        console.log('Sign in successful:', data.user.email);
        Alert.alert('Success', 'Signed in successfully!');
        router.replace('/home');
      } else {
        console.log('No user in response');
        Alert.alert('Error', 'No user data received');
      }
    } catch (error: any) {
      console.error('Sign in exception:', error);
      Alert.alert('Error', `Exception: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (email: string, password: string) => {
    try {
      setLoading(true);
      console.log('Attempting sign up with:', email);
      
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
      });

      if (error) {
        console.error('Sign up error:', error);
        Alert.alert('Sign Up Error', error.message);
        return;
      }

      Alert.alert('Success', 'Account created! Please check your email to confirm.');
    } catch (error: any) {
      console.error('Sign up exception:', error);
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome</Text>
      <EmailAuthForm
        onSignIn={handleSignIn}
        onSignUp={handleSignUp}
        loading={loading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 40,
  },
});