import * as AppleAuthentication from 'expo-apple-authentication';
import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/brand-mark';
import { FirstRunTheme } from '@/components/first-run-theme';
import { Screen } from '@/components/screen';
import { SketchDivider, SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { spacing, type Palette, type FontSet } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';
import { revealRule, revealUp } from '@/lib/motion';
import { useAuth } from '@/lib/auth/provider';

// Was the auth flow dismissed by the user? Those aren't real errors to surface.
function isCancellation(e: unknown): boolean {
  if (e && typeof e === 'object' && 'code' in e && e.code === 'ERR_REQUEST_CANCELED') return true;
  const msg = e instanceof Error ? e.message.toLowerCase() : '';
  return msg.includes('cancel');
}

// The closing page of the first-run set: pinned to the same Augusta editorial
// identity as the intro (FirstRunTheme), with the same hero lockup — crest,
// kicker, serif title, short rule, tagline — revealing in the same stagger.
export function SignIn() {
  return (
    <FirstRunTheme>
      <SignInContent />
    </FirstRunTheme>
  );
}

function SignInContent() {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const insets = useSafeAreaInsets();
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
    <Screen>
      <View
        style={[
          styles.root,
          { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl },
        ]}>
        <View style={styles.hero}>
          <Animated.View entering={revealUp(0)} style={styles.crest}>
            <BrandMark />
          </Animated.View>
          <Animated.View entering={revealUp(1)}>
            <ThemedText type="caption" style={styles.kicker}>
              CADDIE BOOK
            </ThemedText>
          </Animated.View>
          <Animated.View entering={revealUp(2)}>
            <ThemedText style={styles.title}>Your rounds,{'\n'}on every device.</ThemedText>
          </Animated.View>
          <Animated.View entering={revealRule(3)} style={styles.rule}>
            <SketchDivider seed="signin-rule" />
          </Animated.View>
          <Animated.View entering={revealUp(4)}>
            <ThemedText type="muted" style={styles.subtitle}>
              Sign in to back up every round, keep your stats in sync, and share with friends.
            </ThemedText>
          </Animated.View>
        </View>

        <Animated.View entering={revealUp(5)} style={styles.actions}>
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
        </Animated.View>
      </View>
    </Screen>
  );
}

const makeStyles = (colors: Palette, fonts: FontSet) =>
  StyleSheet.create({
    root: {
      flex: 1,
      paddingHorizontal: spacing.md,
      justifyContent: 'space-between',
    },
    hero: {
      flex: 1,
      justifyContent: 'center',
    },
    crest: {
      marginBottom: spacing.lg,
      alignSelf: 'flex-start',
    },
    kicker: {
      fontWeight: '500',
      letterSpacing: 2,
      color: colors.textMuted,
    },
    title: {
      fontFamily: fonts.serifBold,
      fontSize: 34,
      lineHeight: 40,
      letterSpacing: -0.4,
      color: colors.textPrimary,
      marginTop: spacing.sm,
    },
    rule: {
      width: 72,
      marginVertical: spacing.md,
    },
    subtitle: {
      fontSize: 15,
      lineHeight: 22,
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
