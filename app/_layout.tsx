import {
  Fraunces_500Medium,
  Fraunces_700Bold,
  useFonts,
} from '@expo-google-fonts/fraunces';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';

import { fontFamily, themes } from '@/constants/theme';
import { ThemeProvider as AppThemeProvider, useColors, useTheme } from '@/constants/theme-context';
import { initDb } from '@/db/client';

export const unstable_settings = {
  anchor: '(tabs)',
};

function Navigation() {
  const colors = useColors();
  const { themeId } = useTheme();
  const isDark = themes[themeId].dark ?? false;

  const navigationTheme = {
    ...DefaultTheme,
    dark: isDark,
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

  return (
    <ThemeProvider value={navigationTheme}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTitleStyle: { color: colors.textPrimary, fontFamily: fontFamily.serifBold },
          headerTintColor: colors.accent,
          contentStyle: { backgroundColor: colors.background },
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="menu"
          options={{
            headerShown: false,
            presentation: 'transparentModal',
            animation: 'none',
            contentStyle: { backgroundColor: 'transparent' },
          }}
        />
        <Stack.Screen name="settings" options={{ title: 'Settings', headerBackTitle: 'Back' }} />
        <Stack.Screen
          name="tools/yardages"
          options={{ title: 'Stock yardages', headerBackTitle: 'Back' }}
        />
        <Stack.Screen
          name="tools/wedge-grid"
          options={{ title: 'Wedge grid', headerBackTitle: 'Back' }}
        />
        <Stack.Screen
          name="tools/tempo"
          options={{ title: 'Tempo trainer', headerBackTitle: 'Back' }}
        />
        <Stack.Screen name="round/new" options={{ title: 'New Round', presentation: 'modal' }} />
        <Stack.Screen name="round/[id]/index" options={{ headerShown: false }} />
        <Stack.Screen name="round/[id]/review" options={{ headerShown: false }} />
        <Stack.Screen name="round/[id]/summary" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [fontsLoaded] = useFonts({
    Fraunces_500Medium,
    Fraunces_700Bold,
  });

  useEffect(() => {
    initDb()
      .catch((err) => {
        console.error('Failed to initialize database', err);
      })
      .finally(() => setReady(true));
  }, []);

  if (!ready || !fontsLoaded) {
    return null;
  }

  return (
    <AppThemeProvider>
      <Navigation />
    </AppThemeProvider>
  );
}
