import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';

import { colors } from '@/constants/theme';
import { initDb } from '@/db/client';

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    card: colors.background,
    text: colors.textPrimary,
    border: colors.border,
    primary: colors.accent,
    notification: colors.accent,
  },
};

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initDb()
      .catch((err) => {
        console.error('Failed to initialize database', err);
      })
      .finally(() => setReady(true));
  }, []);

  if (!ready) {
    return null;
  }

  return (
    <ThemeProvider value={navigationTheme}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTitleStyle: { color: colors.textPrimary },
          headerTintColor: colors.accent,
          contentStyle: { backgroundColor: colors.background },
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="round/new" options={{ title: 'New Round', presentation: 'modal' }} />
        <Stack.Screen name="round/[id]/index" options={{ headerShown: false }} />
        <Stack.Screen name="round/[id]/review" options={{ headerShown: false }} />
        <Stack.Screen name="round/[id]/summary" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="dark" />
    </ThemeProvider>
  );
}
