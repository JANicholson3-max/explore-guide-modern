import React from 'react';
import { ImageBackground, StyleSheet, View } from 'react-native';

const BG_URL = 'https://xsipeygwjfqseyvpgudy.supabase.co/storage/v1/object/public/public-assets/pyramids-bg.jpg';

export default function ScreenBackground({ children }: { children: React.ReactNode }) {
  return (
    <ImageBackground source={{ uri: BG_URL }} style={styles.bg} resizeMode="cover">
      <View style={styles.content}>{children}</View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  content: { flex: 1 },
});