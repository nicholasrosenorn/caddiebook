import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { DEFAULT_AVATAR } from '@/components/avatar';
import { BrandMark } from '@/components/brand-mark';
import { ProfileForm } from '@/components/profile-form';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { spacing, type Palette, type FontSet } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';

export function Onboarding() {
  return (
    <SafeAreaProvider>
      <OnboardingContent />
    </SafeAreaProvider>
  );
}

function OnboardingContent() {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const insets = useSafeAreaInsets();

  const header = (
    <View style={styles.hero}>
      <View style={styles.crest}>
        <BrandMark />
      </View>
      <ThemedText type="caption">CADDIE BOOK</ThemedText>
      <ThemedText style={styles.title}>Set up{'\n'}your profile.</ThemedText>
      <ThemedText type="muted" style={styles.subtitle}>
        Your name and a glyph — this is how friends see you in the feed.
      </ThemedText>
    </View>
  );

  return (
    <Screen marks>
      <ProfileForm
        initial={{ firstName: '', lastName: '', username: '', avatar: DEFAULT_AVATAR }}
        submitLabel="Finish"
        header={header}
        contentStyle={{
          paddingTop: insets.top + spacing.xl,
          paddingBottom: insets.bottom + spacing.xl,
        }}
      />
    </Screen>
  );
}

const makeStyles = (colors: Palette, fonts: FontSet) =>
  StyleSheet.create({
    hero: {
      gap: spacing.xs,
    },
    crest: {
      marginBottom: spacing.md,
    },
    title: {
      fontFamily: fonts.serifBold,
      fontSize: 32,
      lineHeight: 38,
      color: colors.textPrimary,
      marginTop: spacing.xs,
    },
    subtitle: {
      fontSize: 15,
      marginTop: spacing.xs,
      maxWidth: 320,
    },
  });
