import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { EdgeSwipeOpener } from '@/components/edge-swipe-opener';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { spacing, type Palette } from '@/constants/theme';
import { useColors } from '@/constants/theme-context';

export default function CommunityScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Screen marks>
      <View style={styles.empty}>
        <ThemedText type="subtitle">Community</ThemedText>
        <ThemedText type="muted" style={styles.copy}>
          Coming soon — follow friends and compare rounds.
        </ThemedText>
      </View>
      <EdgeSwipeOpener />
    </Screen>
  );
}

const makeStyles = (_colors: Palette) =>
  StyleSheet.create({
    empty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingBottom: spacing.xxl,
    },
    copy: {
      textAlign: 'center',
      maxWidth: 280,
    },
  });
