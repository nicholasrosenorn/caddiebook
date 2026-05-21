import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { BagPicker } from '@/components/bag-picker';
import { Screen } from '@/components/screen';
import { SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { CLUB_OPTIONS } from '@/constants/clubs';
import { fontFamily, spacing, type Palette } from '@/constants/theme';
import { useColors } from '@/constants/theme-context';
import { createRound, getBag, setBag } from '@/db/queries';

const HOLE_OPTIONS = [9, 18] as const;

export default function NewRoundScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [courseName, setCourseName] = useState('');
  const [date, setDate] = useState(new Date());
  const [holeCount, setHoleCount] = useState<9 | 18>(18);
  const [submitting, setSubmitting] = useState(false);
  const [androidPickerOpen, setAndroidPickerOpen] = useState(false);
  // Brand-new bag is pre-filled with every club; the player trims it.
  const [bag, setBagState] = useState<string[]>([...CLUB_OPTIONS]);

  useEffect(() => {
    getBag().then((stored) => {
      if (stored.length > 0) setBagState(stored);
    });
  }, []);

  const onBagChange = (next: string[]) => {
    setBagState(next);
    setBag(next).catch((err) => console.error(err));
  };

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
          <SketchSurface seed="new-course" radius={8} style={styles.inputSurface}>
            <TextInput
              value={courseName}
              onChangeText={setCourseName}
              placeholder="e.g. Pebble Beach"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              autoFocus
              returnKeyType="done"
            />
          </SketchSurface>
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
              <Pressable onPress={() => setAndroidPickerOpen(true)}>
                <SketchSurface seed="new-date" radius={8} style={styles.input}>
                  <ThemedText>{date.toLocaleDateString()}</ThemedText>
                </SketchSurface>
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
                  style={({ pressed }) => [styles.segment, pressed && !selected && styles.pressed]}>
                  <SketchSurface
                    seed={`new-holes-${n}`}
                    radius={8}
                    fill={selected ? colors.accent : colors.surface}
                    stroke={selected ? colors.accent : colors.borderStrong}
                    grain={selected}
                    style={styles.segmentSurface}>
                    <ThemedText style={selected ? styles.segmentLabelSelected : undefined}>
                      {n}
                    </ThemedText>
                  </SketchSurface>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.field}>
          <ThemedText type="caption">YOUR BAG</ThemedText>
          <BagPicker value={bag} onChange={onBagChange} />
        </View>

        <Pressable
          disabled={!canSubmit}
          onPress={handleSubmit}
          style={({ pressed }) => [
            styles.ctaWrap,
            !canSubmit && styles.ctaDisabled,
            pressed && canSubmit && styles.pressed,
          ]}>
          <SketchSurface
            seed="new-cta"
            fill={colors.accent}
            stroke={colors.accent}
            grain
            style={styles.cta}>
            <ThemedText style={styles.ctaLabel}>
              {submitting ? 'Starting…' : 'Start round'}
            </ThemedText>
          </SketchSurface>
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

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  flex: { flex: 1 },
  field: {
    paddingTop: spacing.md,
    gap: spacing.xs,
  },
  inputSurface: {
    minHeight: 48,
  },
  input: {
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
    gap: spacing.sm,
  },
  segment: {
    flex: 1,
    minHeight: 52,
  },
  segmentSurface: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
  segmentLabelSelected: {
    color: colors.accentOn,
    fontFamily: fontFamily.serif,
  },
  ctaWrap: {
    marginTop: spacing.xl,
    minHeight: 52,
  },
  cta: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  ctaDisabled: {
    opacity: 0.5,
  },
  ctaLabel: {
    color: colors.accentOn,
    fontFamily: fontFamily.serif,
    fontSize: 16,
  },
});
