import React from 'react';
import BetaGateModal from '../components/BetaGateModal';
import { isAdmin } from './lib/isAdmin';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import CategoryButton from '../components/CategoryButton';
import ScreenBackground from '../components/ScreenBackground';
import { supabase } from './lib/supabase';
import { signOutEverywhere } from './lib/biometricLogin';

export default function Home() {
  const router = useRouter();

  // ⬇️ Moved inside component
  const [betaOpen, setBetaOpen] = React.useState(false);
  const [admin, setAdmin] = React.useState(false);

  React.useEffect(() => {
    (async () => setAdmin(await isAdmin()))();
  }, []);

  // Optional: keep your user log
  React.useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      console.log('Home screen - Current user:', user?.email || 'No user');
    };
    checkUser();
  }, []);

  // Gate helper: runs action for admins, opens beta modal for others
  const gate = (action: () => void) => {
    if (admin) action();
    else setBetaOpen(true);
  };

  const handleCategoryPress = (category: string) => {
    // Only gate non-admins. Admins go to camera for now.
    gate(() => router.push('/camera'));
  };

  const handleSignOut = async () => {
    try {
      await signOutEverywhere();
      router.replace('/login');
    } catch (e: any) {
      console.error('Sign out error:', e);
      Alert.alert('Error', e?.message ?? 'Could not sign out.');
      router.replace('/login'); // still force back to login
    }
  };

  return (
    <ScreenBackground>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>Panterix</Text>
          <Text style={styles.subtitle}>Where can we{"\n"}guide you?</Text>
        </View>

        <View style={styles.buttonContainer}>
          <CategoryButton
            title="Sites, Monuments, & Museums"
            onPress={() => handleCategoryPress('Sites, Monuments, & Museums')}
          />
          <CategoryButton
            title="Restaurants & Cafes"
            onPress={() => handleCategoryPress('Restaurants & Cafes')}
          />
          <CategoryButton
            title="Local Neighborhoods"
            onPress={() => handleCategoryPress('Local Neighborhoods')}
          />
          <CategoryButton
            title="Local Shopping"
            onPress={() => handleCategoryPress('Local Shopping')}
          />
          <CategoryButton
            title="My Trips"
            onPress={() => router.push('/my-trips')} // allowed for everyone
          />
        </View>

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal as a sibling of ScrollView */}
      <BetaGateModal visible={betaOpen} onClose={() => setBetaOpen(false)} />
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  contentContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  header: {
    alignItems: 'center',
    marginTop: 60,
    marginBottom: 80,
  },
  title: {
    fontSize: 84,
    fontWeight: '200',
    color: '#ffffff',
    marginBottom: 40,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 32,
    color: '#ffffff',
    textAlign: 'center',
    fontWeight: '200',
    lineHeight: 38,
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: 40,
  },
  signOutButton: {
    marginTop: 20,
    paddingVertical: 8,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  signOutText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'normal',
    textAlign: 'center',
  },
});