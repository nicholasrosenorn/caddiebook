import * as Haptics from 'expo-haptics';
import { useMemo } from 'react';
import { Linking, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthButtons } from '@/components/auth-buttons';
import { CoverHero, CoverLockup, heroIn } from '@/components/cover-hero';
import { FirstRunTheme } from '@/components/first-run-theme';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { spacing, type Palette } from '@/constants/theme';
import { useColors } from '@/constants/theme-context';
import { EULA_URL, TERMS_URL } from '@/lib/legal';
import { revealUp } from '@/lib/motion';

// The closing page of the first-run set, mirroring the launch splash: the same
// CoverHero + wordmark lockup (pinned to the Augusta editorial identity via
// FirstRunTheme), with the auth buttons in place of the splash's loading bar —
// so the splash fades straight into a matching hero. `onBack`, when set (the
// in-session first run), shows a back chevron returning to the prior stage.
export function SignIn({ onBack }: { onBack?: () => void }) {
  return (
    <FirstRunTheme>
      <SignInContent onBack={onBack} />
    </FirstRunTheme>
  );
}

function SignInContent({ onBack }: { onBack?: () => void }) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  // Same hero sizing as the intro cover + splash.
  const heroSize = Math.min(232, (windowWidth - spacing.lg * 2) * 0.7);

  return (
    <Screen>
      {onBack ? (
        <Pressable
          onPress={() => {
            if (process.env.EXPO_OS === 'ios') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
            onBack();
          }}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={({ pressed }) => [styles.back, { top: insets.top + spacing.sm }, pressed && styles.pressed]}>
          <IconSymbol name="chevron.left" size={24} color={colors.textSecondary} />
        </Pressable>
      ) : null}

      <View
        style={[
          styles.root,
          { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl },
        ]}>
        <View style={styles.hero}>
          <Animated.View entering={heroIn}>
            <CoverHero size={heroSize} />
          </Animated.View>
          <CoverLockup />
        </View>

        <View style={styles.footer}>
          <Animated.View entering={revealUp(7)}>
            <AuthButtons />
          </Animated.View>
          {/* Guideline 1.2: the EULA agreement, surfaced at the account-creation
              point for both Apple and Google sign-in. */}
          <Animated.View entering={revealUp(8)}>
            <ThemedText style={styles.terms}>
              By continuing, you agree to our{' '}
              <Text style={styles.termsLink} onPress={() => Linking.openURL(TERMS_URL)}>
                Terms of Service
              </Text>{' '}
              and{' '}
              <Text style={styles.termsLink} onPress={() => Linking.openURL(EULA_URL)}>
                Community Guidelines
              </Text>
              .
            </ThemedText>
          </Animated.View>
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
    back: {
      position: 'absolute',
      left: spacing.md,
      zIndex: 10,
      padding: spacing.xs,
    },
    hero: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.lg,
    },
    footer: {
      gap: spacing.lg,
    },
    tagline: {
      fontSize: 15,
      lineHeight: 22,
      textAlign: 'center',
      maxWidth: 320,
      alignSelf: 'center',
    },
    terms: {
      fontSize: 12,
      lineHeight: 18,
      textAlign: 'center',
      maxWidth: 300,
      alignSelf: 'center',
      color: colors.textMuted,
    },
    termsLink: {
      color: colors.textSecondary,
      textDecorationLine: 'underline',
    },
    pressed: {
      transform: [{ scale: 0.97 }],
    },
  });
