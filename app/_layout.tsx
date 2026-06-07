import {
  Fraunces_500Medium,
  Fraunces_700Bold,
  useFonts,
} from '@expo-google-fonts/fraunces';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { Intro } from '@/components/intro';
import { Onboarding } from '@/components/onboarding';
import { SignIn } from '@/components/sign-in';
import { fontFamily, themes } from '@/constants/theme';
import { ThemeProvider as AppThemeProvider, useColors, useTheme } from '@/constants/theme-context';
import { loadSession, type Session } from '@/lib/auth/tokens';
import { SyncProvider, useSync } from '@/lib/sync/provider';
import { initDb } from '@/db/client';
import { getSetting, setSetting } from '@/db/queries';

const INTRO_SEEN_KEY = 'intro_seen';

export const unstable_settings = {
  anchor: '(tabs)',
};

// Keep the native splash up until fonts + DB are ready (otherwise the
// first render returns null and the splash auto-hides into a blank flash).
SplashScreen.preventAutoHideAsync();

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
          name="edit-profile"
          options={{ title: 'Edit profile', headerBackTitle: 'Settings' }}
        />
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
        <Stack.Screen name="journal/index" options={{ title: 'Journal', headerBackTitle: 'Back' }} />
        <Stack.Screen name="journal/[id]" options={{ title: 'Note', headerBackTitle: 'Journal' }} />
        <Stack.Screen name="round/new" options={{ title: 'New Round', presentation: 'modal' }} />
        <Stack.Screen name="round/[id]/index" options={{ headerShown: false }} />
        <Stack.Screen name="round/[id]/goals" options={{ headerShown: false }} />
        <Stack.Screen name="round/[id]/review" options={{ headerShown: false }} />
        <Stack.Screen name="round/[id]/summary" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

// Choose the gate once the intro is dismissed: not signed in → sign-in; signed
// in but no profile yet (new or legacy account) → onboarding; otherwise the app.
// A cached session is trusted offline (no server check).
function Gate() {
  const { session } = useSync();
  if (!session) return <SignIn />;
  if (!session.user.username) return <Onboarding />;
  return <Navigation />;
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  // null = not yet known (keep the splash up until the flag is read).
  const [introSeen, setIntroSeen] = useState<boolean | null>(null);
  const [initialSession, setInitialSession] = useState<Session | null>(null);
  const [fontsLoaded] = useFonts({
    Fraunces_500Medium,
    Fraunces_700Bold,
  });

  useEffect(() => {
    initDb()
      .then(() => Promise.all([getSetting(INTRO_SEEN_KEY), loadSession()]))
      .then(([seen, session]) => {
        setIntroSeen(seen === '1');
        setInitialSession(session);
      })
      .catch((err) => {
        console.error('Failed to initialize app', err);
        // Don't trap the user on the splash if the read fails — skip the intro.
        setIntroSeen(true);
        setInitialSession(null);
      })
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (ready && fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [ready, fontsLoaded]);

  const dismissIntro = () => {
    setIntroSeen(true);
    setSetting(INTRO_SEEN_KEY, '1').catch((err) =>
      console.error('Failed to persist intro flag', err),
    );
  };

  if (!ready || !fontsLoaded || introSeen === null) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppThemeProvider>
        <SyncProvider initialSession={initialSession}>
          {introSeen ? <Gate /> : <Intro onDone={dismissIntro} />}
        </SyncProvider>
      </AppThemeProvider>
    </GestureHandlerRootView>
  );
}
