import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { colors, radius, spacing } from '@/constants/theme';
import { createRound } from '@/db/queries';

const HOLE_OPTIONS = [9, 18] as const;

export default function NewRoundScreen() {
  const [courseName, setCourseName] = useState('');
  const [date, setDate] = useState(new Date());
  const [holeCount, setHoleCount] = useState<9 | 18>(18);
  const [submitting, setSubmitting] = useState(false);
  const [androidPickerOpen, setAndroidPickerOpen] = useState(false);

  const canSubmit = courseName.trim().length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const id = await createRound({
        courseName: courseName.trim(),
        datePlayed: formatIsoDate(date),
        holeCount,
      });
      router.replace(`/round/${id}` as any);
    } catch (err) {
      console.error(err);
      Alert.alert('Could not start round', 'Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <View style={styles.field}>
          <ThemedText type="caption">COURSE NAME</ThemedText>
          <TextInput
            value={courseName}
            onChangeText={setCourseName}
            placeholder="e.g. Pebble Beach"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            autoFocus
            returnKeyType="done"
          />
        </View>

        <View style={styles.field}>
          <ThemedText type="caption">DATE</ThemedText>
          {Platform.OS === 'ios' ? (
            <View style={styles.iosDateRow}>
              <DateTimePicker
                value={date}
                mode="date"
                display="compact"
                onChange={(_, d) => d && setDate(d)}
                maximumDate={new Date()}
                themeVariant="light"
                accentColor={colors.accent}
              />
            </View>
          ) : (
            <>
              <Pressable onPress={() => setAndroidPickerOpen(true)} style={styles.input}>
                <ThemedText>{date.toLocaleDateString()}</ThemedText>
              </Pressable>
              {androidPickerOpen && (
                <DateTimePicker
                  value={date}
                  mode="date"
                  display="default"
                  onChange={(_, d) => {
                    setAndroidPickerOpen(false);
                    if (d) setDate(d);
                  }}
                  maximumDate={new Date()}
                />
              )}
            </>
          )}
        </View>

        <View style={styles.field}>
          <ThemedText type="caption">HOLES</ThemedText>
          <View style={styles.segmented}>
            {HOLE_OPTIONS.map((n) => {
              const selected = holeCount === n;
              return (
                <Pressable
                  key={n}
                  onPress={() => setHoleCount(n)}
                  style={({ pressed }) => [
                    styles.segment,
                    selected && styles.segmentSelected,
                    pressed && !selected && styles.segmentPressed,
                  ]}>
                  <ThemedText style={selected ? styles.segmentLabelSelected : undefined}>
                    {n}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Pressable
          disabled={!canSubmit}
          onPress={handleSubmit}
          style={({ pressed }) => [
            styles.cta,
            !canSubmit && styles.ctaDisabled,
            pressed && canSubmit && styles.ctaPressed,
          ]}>
          <ThemedText style={styles.ctaLabel}>
            {submitting ? 'Starting…' : 'Start round'}
          </ThemedText>
        </Pressable>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function formatIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  field: {
    paddingTop: spacing.md,
    gap: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.textPrimary,
    minHeight: 48,
    justifyContent: 'center',
  },
  iosDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  segmentSelected: {
    backgroundColor: colors.accent,
  },
  segmentPressed: {
    backgroundColor: colors.accentMuted,
  },
  segmentLabelSelected: {
    color: colors.accentOn,
    fontWeight: '600',
  },
  cta: {
    marginTop: spacing.xl,
    backgroundColor: colors.accent,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  ctaPressed: {
    backgroundColor: colors.accentPressed,
  },
  ctaDisabled: {
    opacity: 0.5,
  },
  ctaLabel: {
    color: colors.accentOn,
    fontWeight: '600',
    fontSize: 16,
  },
});
