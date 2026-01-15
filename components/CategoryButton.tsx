// components/CategoryButton.tsx
import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from 'react-native';

interface CategoryButtonProps {
  title: string;
  onPress: () => void;
  style?: ViewStyle;
}

export default function CategoryButton({ title, onPress, style }: CategoryButtonProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={[styles.button, style]}
      onPress={onPress}
    >
      <Text style={styles.buttonText} numberOfLines={1}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: '100%',
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 5,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '600', // <— unbolded
    letterSpacing: 0.15,
    color: '#ffffff',
    textAlign: 'center',
  },
});
