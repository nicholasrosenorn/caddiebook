import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { colors, radius, spacing } from '@/constants/theme';

const PLACEHOLDER_METRICS = [
  { label: 'Avg Score', value: '—' },
  { label: 'GIR %', value: '—' },
  { label: 'FIR %', value: '—' },
  { label: 'U&D %', value: '—' },
  { label: 'Avg Putts', value: '—' },
];

export default function StatsScreen() {
  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="title">Stats</ThemedText>
        <ThemedText type="muted">Lifetime trends across all rounds</ThemedText>
      </View>

      <View style={styles.grid}>
        {PLACEHOLDER_METRICS.map((metric) => (
          <View key={metric.label} style={styles.card}>
            <ThemedText type="caption">{metric.label.toUpperCase()}</ThemedText>
            <ThemedText type="title" style={styles.value}>
              {metric.value}
            </ThemedText>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.xs,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  card: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  value: {
    marginTop: spacing.xs,
  },
});
