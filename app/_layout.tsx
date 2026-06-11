import {
  Fraunces_500Medium,
  Fraunces_700Bold,
  useFonts,
} from '@expo-google-fonts/fraunces';
import {
  LibreBaskerville_500Medium,
  LibreBaskerville_700Bold,
} from '@expo-google-fonts/libre-baskerville';
import { Newsreader_500Medium, Newsreader_600SemiBold } from '@expo-google-fonts/newsreader';
import { Spectral_500Medium, Spectral_600SemiBold } from '@expo-google-fonts/spectral';
import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { Intro } from '@/components/intro';
import { Onboarding } from '@/components/onboarding';
import { SignIn } from '@/components/sign-in';
import { Splash } from '@/components/splash';
import { themes } from '@/constants/theme';
import {
  ThemeProvider as AppThemeProvider,
  useColors,
  useFontSet,
  useTheme,
} from '@/constants/theme-context';
import { AuthProvider, useAuth } from '@/lib/auth/provider';
import { loadSession, type Session } from '@/lib/auth/tokens';
import { getPref, setPref } from '@/lib/local/prefs';
import { migrateLegacyPrefs } from '@/lib/migration/legacy-flush';

const INTRO_SEEN_KEY = 'intro_seen';

export const unstable_settings = {
  anchor: '(tabs)',
};

// Keep the native splash up until fonts + DB are ready (otherwise the
// first render returns null and the splash auto-hides into a blank flash).
SplashScreen.preventAutoHideAsync();

function Navigation() {
  const colors = useColors();
  const fonts = useFontSet();
  const { themeId } = useTheme();
  const isDark = themes[themeId].dark ?? false;

  // Deep-link from a tapped push notification. useLastNotificationResponse covers
  // both a cold start (app launched by the tap) and a warm tap. The payload's
  // `url` is set server-side (currently the Community tab).
  const notificationResponse = Notifications.useLastNotificationResponse();
  useEffect(() => {
    const url = notificationResponse?.notification.request.content.data?.url;
    if (typeof url === 'string') {
      // Typed routes can't statically know a runtime string; the URL is
      // server-controlled and always an in-app path.
      router.navigate(url as Parameters<typeof router.navigate>[0]);
    }
  }, [notificationResponse]);

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
          headerTitleStyle: { color: colors.textPrimary, fontFamily: fonts.serifBold },
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
        <Stack.Screen name="friends" options={{ title: 'Friends', headerBackTitle: 'Settings' }} />
        <Stack.Screen
          name="add-friends"
          options={{ title: 'Add friends', headerBackTitle: 'Friends' }}
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
        <Stack.Screen name="round/[id]/settings" options={{ headerShown: false }} />
        <Stack.Screen
          name="community/round/[ownerId]/[roundId]"
          options={{ title: 'Round', headerBackTitle: 'Back' }}
        />
        <Stack.Screen
          name="community/likes/[ownerId]/[roundId]"
          options={{ title: 'Likes', headerBackTitle: 'Back' }}
        />
      </Stack>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

// Choose the gate once the intro is dismissed: not signed in → sign-in; signed
// in but no profile yet (new or legacy account) → onboarding; otherwise the app.
// A cached session is trusted offline (no server check).
function Gate() {
  const { session } = useAuth();
  if (!session) return <SignIn />;
  if (!session.user.username) return <Onboarding />;
  return <Navigation />;
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  // null = not yet known (keep the splash up until the flag is read).
  const [introSeen, setIntroSeen] = useState<boolean | null>(null);
  // The animated cover splash shows once per cold launch (never resets on
  // foreground), overlaying the app while the launch sync runs underneath.
  const [splashDone, setSplashDone] = useState(false);
  const [initialSession, setInitialSession] = useState<Session | null>(null);
  const [fontsLoaded] = useFonts({
    Fraunces_500Medium,
    Fraunces_700Bold,
    Newsreader_500Medium,
    Newsreader_600SemiBold,
    Spectral_500Medium,
    Spectral_600SemiBold,
    LibreBaskerville_500Medium,
    LibreBaskerville_700Bold,
  });

  useEffect(() => {
    // Existing installs carry theme/intro in the old sqlite settings — copy
    // them into prefs before the first read (one-time, flag-gated).
    migrateLegacyPrefs()
      .then(() => Promise.all([getPref(INTRO_SEEN_KEY), loadSession()]))
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
    setPref(INTRO_SEEN_KEY, '1').catch((err) =>
      console.error('Failed to persist intro flag', err),
    );
  };

  if (!ready || !fontsLoaded || introSeen === null) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppThemeProvider>
        <AuthProvider initialSession={initialSession}>
          {introSeen ? <Gate /> : <Intro onDone={dismissIntro} />}
          {/* First run shows the intro only — its cover *is* the splash. */}
          {introSeen && !splashDone && <Splash onDone={() => setSplashDone(true)} />}
        </AuthProvider>
      </AppThemeProvider>
    </GestureHandlerRootView>
  );
}
