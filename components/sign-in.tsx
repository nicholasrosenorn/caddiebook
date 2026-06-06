import * as AppleAuthentication from 'expo-apple-authentication';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen } from '@/components/screen';
import { SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { fontFamily, spacing, type Palette } from '@/constants/theme';
import { useColors } from '@/constants/theme-context';
import { useSync } from '@/lib/sync/provider';

// Was the auth flow dismissed by the user? Those aren't real errors to surface.
function isCancellation(e: unknown): boolean {
  if (e && typeof e === 'object' && 'code' in e && e.code === 'ERR_REQUEST_CANCELED') return true;
  const msg = e instanceof Error ? e.message.toLowerCase() : '';
  return msg.includes('cancel');
}

export function SignIn() {
  return (
    <SafeAreaProvider>
      <SignInContent />
    </SafeAreaProvider>
  );
}

function SignInContent() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { signInApple, signInGoogle } = useSync();
  const [busy, setBusy] = useState<'apple' | 'google' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async (kind: 'apple' | 'google', fn: () => Promise<void>) => {
    setError(null);
    setBusy(kind);
    try {
      await fn();
    } catch (e) {
      if (!isCancellation(e)) {
        setError(e instanceof Error ? e.message : 'Sign-in failed. Please try again.');
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen marks>
      <View
        style={[
          styles.root,
          { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl },
        ]}>
        <View style={styles.hero}>
          <ThemedText type="caption">CADDIE BOOK</ThemedText>
          <ThemedText style={styles.title}>Your round,{'\n'}on every device.</ThemedText>
          <ThemedText type="muted" style={styles.subtitle}>
            Sign in to back up your rounds and keep your stats in sync.
          </ThemedText>
        </View>

        <View style={styles.actions}>
          {error ? (
            <ThemedText style={styles.error}>{error}</ThemedText>
          ) : null}

          {Platform.OS === 'ios' ? (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={10}
              style={styles.appleButton}
              onPress={() => run('apple', signInApple)}
            />
          ) : null}

          <Pressable
            disabled={busy !== null}
            accessibilityRole="button"
            accessibilityLabel="Continue with Google"
            onPress={() => run('google', signInGoogle)}
            style={({ pressed }) => pressed && styles.pressed}>
            <SketchSurface seed="signin-google" radius={10} style={styles.googleButton}>
              {busy === 'google' ? (
                <ActivityIndicator color={colors.textPrimary} />
              ) : (
                <ThemedText style={styles.googleLabel}>Continue with Google</ThemedText>
              )}
            </SketchSurface>
          </Pressable>

          {busy === 'apple' ? (
            <ActivityIndicator style={styles.spinner} color={colors.accent} />
          ) : null}
        </View>
      </View>
    </Screen>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    root: {
      flex: 1,
      paddingHorizontal: spacing.md,
      justifyContent: 'space-between',
    },
    hero: {
      flex: 1,
      justifyContent: 'center',
      gap: spacing.sm,
    },
    title: {
      fontFamily: fontFamily.serifBold,
      fontSize: 34,
      lineHeight: 40,
      color: colors.textPrimary,
      marginTop: spacing.sm,
    },
    subtitle: {
      fontSize: 15,
      marginTop: spacing.xs,
      maxWidth: 320,
    },
    actions: {
      gap: spacing.sm,
    },
    appleButton: {
      height: 52,
    },
    googleButton: {
      minHeight: 52,
      alignItems: 'center',
      justifyContent: 'center',
    },
    googleLabel: {
      fontFamily: fontFamily.serif,
      fontSize: 17,
      color: colors.textPrimary,
    },
    pressed: {
      opacity: 0.6,
    },
    error: {
      color: colors.danger,
      fontSize: 14,
      marginBottom: spacing.xs,
    },
    spinner: {
      marginTop: spacing.sm,
    },
  });
