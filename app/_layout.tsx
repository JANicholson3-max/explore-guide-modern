import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="auth-options" />
      <Stack.Screen name="home" />
      <Stack.Screen name="camera" />
      <Stack.Screen name="trips" />
      <Stack.Screen name="add-trip" />
      <Stack.Screen name="trip-details" />
    </Stack>
  );
}