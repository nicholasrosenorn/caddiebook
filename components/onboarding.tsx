import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { DEFAULT_AVATAR } from '@/components/avatar';
import { ProfileForm } from '@/components/profile-form';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { fontFamily, spacing, type Palette } from '@/constants/theme';
import { useColors } from '@/constants/theme-context';

export function Onboarding() {
  return (
    <SafeAreaProvider>
      <OnboardingContent />
    </SafeAreaProvider>
  );
}

function OnboardingContent() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  const header = (
    <View style={styles.hero}>
      <ThemedText type="caption">CADDIE BOOK</ThemedText>
      <ThemedText style={styles.title}>Set up{'\n'}your profile.</ThemedText>
      <ThemedText type="muted" style={styles.subtitle}>
        This is how you&apos;ll show up across your devices.
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

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    hero: {
      gap: spacing.xs,
    },
    title: {
      fontFamily: fontFamily.serifBold,
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
