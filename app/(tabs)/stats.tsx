import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/screen';
import { SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { spacing } from '@/constants/theme';

const PLACEHOLDER_METRICS = [
  { label: 'Avg Score', value: '—' },
  { label: 'GIR %', value: '—' },
  { label: 'FIR %', value: '—' },
  { label: 'U&D %', value: '—' },
  { label: 'Avg Putts', value: '—' },
];

export default function StatsScreen() {
  return (
    <Screen marks>
      <View style={styles.header}>
        <ThemedText type="title">Stats</ThemedText>
        <ThemedText type="muted">Lifetime trends across all rounds</ThemedText>
      </View>

      <View style={styles.grid}>
        {PLACEHOLDER_METRICS.map((metric) => (
          <SketchSurface key={metric.label} seed={`stat-${metric.label}`} style={styles.card}>
            <ThemedText type="caption">{metric.label.toUpperCase()}</ThemedText>
            <ThemedText type="title" style={styles.value}>
              {metric.value}
            </ThemedText>
          </SketchSurface>
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
    minHeight: 88,
    padding: spacing.md,
    gap: spacing.xs,
  },
  value: {
    marginTop: spacing.xs,
  },
});
