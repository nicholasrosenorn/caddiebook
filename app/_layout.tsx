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
import { Personalize } from '@/components/personalize';
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

type IntroStage = 'value' | 'quiz' | 'auth' | 'done';

// Renders the right surface for the current first-run stage and session. A
// session always wins (→ onboarding if there's no profile yet, else the app);
// a cached session is trusted offline (no server check). Otherwise we walk the
// first-run stages: value story → quiz → sign-in. The intro completes into the
// quiz; "I already have an account" / Skip jump straight to sign-in; the quiz
// payoff signs in inline (session wins). 'auth' offers a back affordance to
// wherever the user came from; 'done' is the returning signed-out user.
function AppRoot({
  stage,
  onIntroDone,
  onIntroSignIn,
  onQuizSkip,
  onAuthBack,
}: {
  stage: IntroStage;
  onIntroDone: () => void;
  onIntroSignIn: () => void;
  onQuizSkip: () => void;
  onAuthBack: () => void;
}) {
  const { session } = useAuth();
  if (session) {
    if (!session.user.username) return <Onboarding />;
    return <Navigation />;
  }
  if (stage === 'value') return <Intro onDone={onIntroDone} onSignIn={onIntroSignIn} />;
  if (stage === 'quiz') return <Personalize onDone={onQuizSkip} />;
  return <SignIn onBack={stage === 'auth' ? onAuthBack : undefined} />;
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  // null = not yet known (keep the splash up until the flag is read).
  const [introSeen, setIntroSeen] = useState<boolean | null>(null);
  // First run is a sequence: value story (intro) → personalization quiz →
  // sign-in. Tracked in memory so the user can step back from sign-in to the
  // quiz even after intro_seen has been persisted. 'done' = first run complete
  // (returning user lands straight on sign-in, no back).
  const [introStage, setIntroStage] = useState<IntroStage>('value');
  // The stage to return to when backing out of sign-in (intro vs. quiz).
  const [authReturn, setAuthReturn] = useState<IntroStage>('quiz');
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
        if (seen === '1') setIntroStage('done');
        setInitialSession(session);
      })
      .catch((err) => {
        console.error('Failed to initialize app', err);
        // Don't trap the user on the splash if the read fails — skip the intro.
        setIntroSeen(true);
        setIntroStage('done');
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

  // Jump from a first-run stage to sign-in, remembering where to return on back.
  const goAuth = (from: IntroStage) => {
    setAuthReturn(from);
    setIntroStage('auth');
    dismissIntro();
  };

  // On explicit sign-out, replay the full first-run (value story → quiz) so the
  // signed-out experience reintroduces Caddie Book before landing on sign-in.
  const replayIntro = () => {
    setIntroStage('value');
    setIntroSeen(false);
    setPref(INTRO_SEEN_KEY, '0').catch((err) =>
      console.error('Failed to reset intro flag', err),
    );
  };

  if (!ready || !fontsLoaded || introSeen === null) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppThemeProvider>
        <AuthProvider initialSession={initialSession} onSignOut={replayIntro}>
          <AppRoot
            stage={introStage}
            onIntroDone={() => setIntroStage('quiz')}
            // Jumping to sign-in persists intro_seen (a relaunch skips straight
            // to sign-in) but remembers the origin stage so back still works.
            onIntroSignIn={() => goAuth('value')}
            onQuizSkip={() => goAuth('quiz')}
            onAuthBack={() => setIntroStage(authReturn)}
          />
          {/* Returning users (a cached session, or the intro already seen) get
              the launch splash; a fresh first-run user sees the intro cover
              instead — its cover *is* the splash. */}
          {(introSeen || initialSession !== null) && !splashDone && (
            <Splash onDone={() => setSplashDone(true)} />
          )}
        </AuthProvider>
      </AppThemeProvider>
    </GestureHandlerRootView>
  );
}
