import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
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
import {
  createRound,
  createTee,
  findOrCreateCourse,
  getBag,
  getCourses,
  getTeesForCourse,
  setBag,
} from '@/db/queries';
import type { Course, Tee } from '@/db/types';

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

  // Saved courses/tees for rating-slope autofill.
  const [courses, setCourses] = useState<Course[]>([]);
  const [tees, setTees] = useState<Tee[]>([]);
  const [teeName, setTeeName] = useState('');
  const [rating, setRating] = useState('');
  const [slope, setSlope] = useState('');
  const [includeInHandicap, setIncludeInHandicap] = useState(true);

  useEffect(() => {
    getBag().then((stored) => {
      if (stored.length > 0) setBagState(stored);
    });
    getCourses().then(setCourses);
  }, []);

  // The saved course matching the typed name (case-insensitive), if any.
  const selectedCourse = useMemo(() => {
    const needle = courseName.trim().toLowerCase();
    if (!needle) return null;
    return courses.find((c) => c.name.toLowerCase() === needle) ?? null;
  }, [courses, courseName]);

  // Load the matched course's tees so they can be tapped to autofill.
  useEffect(() => {
    if (!selectedCourse) {
      setTees([]);
      return;
    }
    let active = true;
    getTeesForCourse(selectedCourse.id).then((t) => {
      if (active) setTees(t);
    });
    return () => {
      active = false;
    };
  }, [selectedCourse]);

  const onBagChange = (next: string[]) => {
    setBagState(next);
    setBag(next).catch((err) => console.error(err));
  };

  const pickTee = (tee: Tee) => {
    setTeeName(tee.name);
    setRating(String(tee.courseRating));
    setSlope(String(tee.slopeRating));
  };

  const canSubmit = courseName.trim().length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const ratingNum = parseNum(rating);
      const slopeNum = parseNum(slope);
      const hasRatingSlope =
        includeInHandicap && ratingNum != null && slopeNum != null;
      const trimmedTee = includeInHandicap ? teeName.trim() : '';

      // Persist the course + tee so next time this autofills.
      const courseId = await findOrCreateCourse(courseName);
      if (hasRatingSlope) {
        const known = tees.some(
          (t) => t.courseRating === ratingNum && t.slopeRating === slopeNum,
        );
        if (!known) {
          await createTee({
            courseId,
            name: trimmedTee || 'Default',
            courseRating: ratingNum,
            slopeRating: slopeNum,
          });
        }
      }

      const id = await createRound({
        courseName: courseName.trim(),
        datePlayed: formatIsoDate(date),
        holeCount,
        teeName: trimmedTee || null,
        courseRating: hasRatingSlope ? ratingNum : null,
        slopeRating: hasRatingSlope ? slopeNum : null,
        includeInHandicap,
      });
      router.replace(`/round/${id}/goals` as any);
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
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
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
            {courses.length > 0 ? (
              <ChipRow
                styles={styles}
                colors={colors}
                seed="course"
                items={courses.map((c) => ({ key: c.id, label: c.name }))}
                selectedKey={selectedCourse?.id ?? null}
                onPick={(key) => {
                  const c = courses.find((x) => x.id === key);
                  if (c) setCourseName(c.name);
                }}
              />
            ) : null}
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
            <Pressable
              style={styles.toggleRow}
              onPress={() => setIncludeInHandicap((v) => !v)}
              accessibilityRole="switch"
              accessibilityState={{ checked: includeInHandicap }}>
              <ThemedText type="caption">INCLUDE IN HANDICAP?</ThemedText>
              <SketchSurface
                seed="new-handicap-toggle"
                radius={999}
                fill={includeInHandicap ? colors.accent : colors.surface}
                stroke={includeInHandicap ? colors.accent : colors.borderStrong}
                grain={includeInHandicap}
                style={[
                  styles.toggleTrack,
                  includeInHandicap ? styles.toggleTrackOn : styles.toggleTrackOff,
                ]}>
                <View
                  style={[
                    styles.toggleKnob,
                    { backgroundColor: includeInHandicap ? colors.accentOn : colors.borderStrong },
                  ]}
                />
              </SketchSurface>
            </Pressable>
          </View>

          {includeInHandicap ? (
          <View style={styles.field}>
            <ThemedText type="caption">TEE & RATING</ThemedText>
            <ThemedText style={styles.hint}>
              * Optional for handicap calculation.
            </ThemedText>
            {tees.length > 0 ? (
              <ChipRow
                styles={styles}
                colors={colors}
                seed="tee"
                items={tees.map((t) => ({
                  key: t.id,
                  label: `${t.name} · ${t.courseRating}/${t.slopeRating}`,
                }))}
                selectedKey={
                  tees.find(
                    (t) =>
                      String(t.courseRating) === rating && String(t.slopeRating) === slope,
                  )?.id ?? null
                }
                onPick={(key) => {
                  const t = tees.find((x) => x.id === key);
                  if (t) pickTee(t);
                }}
              />
            ) : null}
            <View style={styles.ratingRow}>
              <View style={styles.ratingCol}>
                <ThemedText style={styles.subLabel}>TEE*</ThemedText>
                <SketchSurface seed="new-tee-name" radius={8} style={styles.inputSurface}>
                  <TextInput
                    value={teeName}
                    onChangeText={setTeeName}
                    placeholder="Blue"
                    placeholderTextColor={colors.textMuted}
                    style={styles.input}
                    returnKeyType="done"
                  />
                </SketchSurface>
              </View>
              <View style={styles.ratingCol}>
                <ThemedText style={styles.subLabel}>RATING*</ThemedText>
                <SketchSurface seed="new-rating" radius={8} style={styles.inputSurface}>
                  <TextInput
                    value={rating}
                    onChangeText={setRating}
                    placeholder="72.1"
                    placeholderTextColor={colors.textMuted}
                    style={styles.input}
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                  />
                </SketchSurface>
              </View>
              <View style={styles.ratingCol}>
                <ThemedText style={styles.subLabel}>SLOPE*</ThemedText>
                <SketchSurface seed="new-slope" radius={8} style={styles.inputSurface}>
                  <TextInput
                    value={slope}
                    onChangeText={setSlope}
                    placeholder="113"
                    placeholderTextColor={colors.textMuted}
                    style={styles.input}
                    keyboardType="number-pad"
                    returnKeyType="done"
                  />
                </SketchSurface>
              </View>
            </View>
          </View>
          ) : null}

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
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

type ChipItem = { key: string; label: string };

function ChipRow({
  styles,
  colors,
  seed,
  items,
  selectedKey,
  onPick,
}: {
  styles: ReturnType<typeof makeStyles>;
  colors: Palette;
  seed: string;
  items: ChipItem[];
  selectedKey: string | null;
  onPick: (key: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.chipRow}>
      {items.map((item) => {
        const selected = item.key === selectedKey;
        return (
          <Pressable key={item.key} onPress={() => onPick(item.key)}>
            <SketchSurface
              seed={`new-${seed}-${item.key}`}
              radius={999}
              fill={selected ? colors.accent : colors.surface}
              stroke={selected ? colors.accent : colors.borderStrong}
              grain={selected}
              style={styles.chip}>
              <ThemedText style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
                {item.label}
              </ThemedText>
            </SketchSurface>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function parseNum(value: string): number | null {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : null;
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
  scrollContent: {
    paddingBottom: spacing.xl,
  },
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
  hint: {
    fontSize: 13,
    color: colors.textMuted,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleTrack: {
    width: 52,
    height: 30,
    justifyContent: 'center',
  },
  toggleTrackOn: {
    alignItems: 'flex-end',
  },
  toggleTrackOff: {
    alignItems: 'flex-start',
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    marginHorizontal: 3,
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
  chipRow: {
    gap: spacing.sm,
    paddingTop: spacing.xs,
    paddingRight: spacing.md,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipLabel: {
    fontFamily: fontFamily.serif,
    fontSize: 14,
    color: colors.textSecondary,
  },
  chipLabelSelected: {
    color: colors.accentOn,
  },
  ratingRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  ratingCol: {
    flex: 1,
    gap: spacing.xs,
  },
  subLabel: {
    fontSize: 11,
    letterSpacing: 0.8,
    color: colors.textMuted,
    fontFamily: fontFamily.sans,
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
