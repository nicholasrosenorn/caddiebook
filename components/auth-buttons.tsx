import * as AppleAuthentication from 'expo-apple-authentication';
import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';

import { SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { spacing, type FontSet, type Palette } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';
import { useAuth } from '@/lib/auth/provider';

// Was the auth flow dismissed by the user? Those aren't real errors to surface.
function isCancellation(e: unknown): boolean {
  if (e && typeof e === 'object' && 'code' in e && e.code === 'ERR_REQUEST_CANCELED') return true;
  const msg = e instanceof Error ? e.message.toLowerCase() : '';
  return msg.includes('cancel');
}

/**
 * The shared sign-in actions — Apple (iOS only) + Continue with Google — with
 * their own busy/error state. Used by both the standalone sign-in screen and
 * the quiz payoff so the auth surface stays identical everywhere. Renders inside
 * FirstRunTheme + AuthProvider, so theme and `useAuth()` resolve.
 */
export function AuthButtons() {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const { signInApple, signInGoogle } = useAuth();
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
    <View style={styles.actions}>
      {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

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
        onPressIn={() => {
          if (process.env.EXPO_OS === 'ios') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
        }}
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
  );
}

const makeStyles = (colors: Palette, fonts: FontSet) =>
  StyleSheet.create({
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
      fontFamily: fonts.serif,
      fontSize: 17,
      lineHeight: 23,
      color: colors.textPrimary,
    },
    pressed: {
      transform: [{ scale: 0.97 }],
    },
    error: {
      color: colors.danger,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: spacing.xs,
    },
    spinner: {
      marginTop: spacing.sm,
    },
  });
