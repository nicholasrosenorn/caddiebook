import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BagPicker } from '@/components/bag-picker';
import { Collapsible } from '@/components/collapsible';
import { Screen } from '@/components/screen';
import { SegmentedControl } from '@/components/segmented-control';
import { SettingToggle } from '@/components/setting-toggle';
import { SketchDivider, SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { CLUB_OPTIONS } from '@/constants/clubs';
import { spacing, type Palette, type FontSet } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';
import type { Tee } from '@/lib/data/models';
import { useCourses, useCreateTee, useEnsureCourse } from '@/lib/data/courses';
import { useCreateRound } from '@/lib/data/rounds';
import { useBag, useSetBag } from '@/lib/data/settings';
import { containsProfanity } from '@/lib/moderation/profanity';

const HOLE_OPTIONS = [
  { value: '9', label: '9' },
  { value: '18', label: '18' },
] as const;

export default function NewRoundScreen() {
  const colors = useColors();
  const fonts = useFontSet();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const [courseName, setCourseName] = useState('');
  const [date, setDate] = useState(new Date());
  const [holeCount, setHoleCount] = useState<9 | 18>(18);
  const [submitting, setSubmitting] = useState(false);
  const [androidPickerOpen, setAndroidPickerOpen] = useState(false);

  const [teeName, setTeeName] = useState('');
  const [rating, setRating] = useState('');
  const [slope, setSlope] = useState('');
  const [includeInHandicap, setIncludeInHandicap] = useState(true);
  // Whether this round is visible in friends' Community feed (default on).
  const [share, setShare] = useState(true);

  // Saved courses/tees (for rating-slope autofill) + the player's bag, from the
  // cached server queries. Brand-new bag shows every club; the player trims it.
  const { data: coursesData } = useCourses();
  const courses = useMemo(() => coursesData ?? [], [coursesData]);
  const { bag: storedBag, bagSet } = useBag();
  const bag = useMemo(
    () => (bagSet ? storedBag : [...CLUB_OPTIONS]),
    [bagSet, storedBag],
  );
  const setBag = useSetBag();
  const ensureCourse = useEnsureCourse();
  const createTee = useCreateTee();
  const createRound = useCreateRound();

  // The saved course matching the typed name (case-insensitive), if any.
  const selectedCourse = useMemo(() => {
    const needle = courseName.trim().toLowerCase();
    if (!needle) return null;
    return courses.find((c) => c.name.toLowerCase() === needle) ?? null;
  }, [courses, courseName]);

  // Typeahead: saved courses containing the typed text. Hidden once the name is
  // an exact match (nothing left to pick) or empty.
  const courseSuggestions = useMemo(() => {
    const needle = courseName.trim().toLowerCase();
    if (!needle) return [];
    const matches = courses.filter((c) => c.name.toLowerCase().includes(needle));
    if (matches.length === 1 && matches[0].name.toLowerCase() === needle) return [];
    return matches.slice(0, 4);
  }, [courses, courseName]);

  // One-line glance of the furled options so state is readable without expanding.
  const optionsSummary = useMemo(
    () =>
      [
        includeInHandicap ? 'Handicap on' : 'Handicap off',
        share ? 'Sharing on' : 'Sharing off',
        `${bag.length} clubs`,
      ].join(' · '),
    [includeInHandicap, share, bag.length],
  );

  // The matched course's tees (embedded in the courses query), tappable to autofill.
  const tees = useMemo<Tee[]>(() => selectedCourse?.tees ?? [], [selectedCourse]);

  const onBagChange = (next: string[]) => {
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
    // The course name is shared on the feed, so it passes the same content gate
    // as other UGC. Catch it here before the round PUT enqueues — otherwise the
    // server would reject it (422) and the outbox would drop the whole round.
    if (containsProfanity(courseName) || containsProfanity(teeName)) {
      Alert.alert('Let’s keep it clean', 'Please choose a different course or tee name.');
      return;
    }
    setSubmitting(true);
    try {
      const ratingNum = parseNum(rating);
      const slopeNum = parseNum(slope);
      const hasRatingSlope =
        includeInHandicap && ratingNum != null && slopeNum != null;
      const trimmedTee = includeInHandicap ? teeName.trim() : '';

      // Persist the course + tee so next time this autofills.
      const courseId = await ensureCourse(courseName);
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
        excludeFromSharing: !share,
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
            {courseSuggestions.length > 0 ? (
              <SketchSurface seed="new-course-suggest" radius={8} style={styles.suggestCard}>
                {courseSuggestions.map((c, i) => (
                  <Pressable
                    key={c.id}
                    onPress={() => setCourseName(c.name)}
                    style={({ pressed }) => [
                      styles.suggestRow,
                      i > 0 && styles.suggestRowDivided,
                      pressed && styles.pressed,
                    ]}>
                    <ThemedText style={styles.suggestLabel}>{c.name}</ThemedText>
                  </Pressable>
                ))}
              </SketchSurface>
            ) : null}
          </View>

          <View style={styles.teeField}>
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
                      String(t.courseRating) === rating &&
                      String(t.slopeRating) === slope,
                  )?.id ?? null
                }
                onPick={(key) => {
                  const t = tees.find((x) => x.id === key);
                  if (t) pickTee(t);
                }}
              />
            ) : null}
            <View style={styles.ratingRow}>
              <SketchSurface seed="new-tee-name" radius={8} style={[styles.ratingCol, styles.inputSurface]}>
                <TextInput
                  value={teeName}
                  onChangeText={setTeeName}
                  placeholder="Tee *"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                  returnKeyType="done"
                />
              </SketchSurface>
              <SketchSurface seed="new-rating" radius={8} style={[styles.ratingCol, styles.inputSurface]}>
                <TextInput
                  value={rating}
                  onChangeText={setRating}
                  placeholder="Rating *"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                />
              </SketchSurface>
              <SketchSurface seed="new-slope" radius={8} style={[styles.ratingCol, styles.inputSurface]}>
                <TextInput
                  value={slope}
                  onChangeText={setSlope}
                  placeholder="Slope *"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                  keyboardType="number-pad"
                  returnKeyType="done"
                />
              </SketchSurface>
            </View>
            <ThemedText style={styles.hint}>* Optional, used for handicap.</ThemedText>
          </View>

          <View style={styles.essentialsRow}>
            <View style={styles.dateCol}>
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

            <View style={styles.holesCol}>
              <ThemedText type="caption">HOLES</ThemedText>
              <SegmentedControl
                seed="new-holes"
                options={HOLE_OPTIONS.map((o) => ({ ...o }))}
                value={String(holeCount)}
                onChange={(v) => setHoleCount(Number(v) as 9 | 18)}
              />
            </View>
          </View>

          <View style={styles.divider}>
            <SketchDivider seed="new-options" />
          </View>

          <Collapsible title="ROUND OPTIONS" summary={optionsSummary}>
            <SettingToggle
              label="INCLUDE IN HANDICAP?"
              value={includeInHandicap}
              onChange={setIncludeInHandicap}
              seed="new-handicap-toggle"
            />

            <SettingToggle
              label="SHARE WITH FRIENDS?"
              value={share}
              onChange={setShare}
              seed="new-share-toggle"
              hint={
                share
                  ? 'Friends can see this round in their Community feed.'
                  : 'Hidden from the Community feed.'
              }
            />

            <View style={styles.subField}>
              <ThemedText type="caption">YOUR BAG</ThemedText>
              <BagPicker value={bag} onChange={onBagChange} />
            </View>
          </Collapsible>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.sm }]}>
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
        </View>
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

const makeStyles = (colors: Palette, fonts: FontSet) =>
  StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  field: {
    paddingTop: spacing.md,
    gap: spacing.xs,
  },
  teeField: {
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  subField: {
    gap: spacing.xs,
  },
  essentialsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingTop: spacing.md,
  },
  dateCol: {
    gap: spacing.xs,
  },
  holesCol: {
    flex: 1,
    gap: spacing.xs,
  },
  divider: {
    paddingTop: spacing.lg,
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
  iosDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  pressed: {
    opacity: 0.6,
  },
  suggestCard: {
    marginTop: spacing.xs,
  },
  suggestRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
  },
  suggestRowDivided: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  suggestLabel: {
    fontFamily: fonts.serif,
    fontSize: 15,
    color: colors.textPrimary,
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
    fontFamily: fonts.serif,
    fontSize: 14,
    color: colors.textSecondary,
  },
  chipLabelSelected: {
    color: colors.accentOn,
  },
  ratingRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  ratingCol: {
    flex: 1,
  },
  footer: {
    paddingTop: spacing.sm,
  },
  ctaWrap: {
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
    fontFamily: fonts.serif,
    fontSize: 16,
    lineHeight: 22,
  },
});
