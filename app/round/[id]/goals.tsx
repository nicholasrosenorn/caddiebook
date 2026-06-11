import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen } from '@/components/screen';
import { SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { spacing, type Palette, type FontSet } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';
import { useRoundFull, useUpsertGoals } from '@/lib/data/rounds';
import { GOAL_CATEGORIES, type GoalCategory, type GoalCategoryKey } from '@/lib/goals';

type GoalState = Record<GoalCategoryKey, string | null>;

const EMPTY_GOALS: GoalState = { execution: null, strategic: null, mental: null };

export default function GoalsScreen() {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  const [goals, setGoals] = useState<GoalState>(EMPTY_GOALS);
  const [submitting, setSubmitting] = useState(false);

  const { data: detail } = useRoundFull(id);
  const round = detail?.round ?? null;
  const upsertGoals = useUpsertGoals();

  // Hydrate previously saved goals once from the cached round detail.
  const hydrated = useRef(false);
  const existing = detail?.goals ?? null;
  useEffect(() => {
    if (hydrated.current || !existing) return;
    hydrated.current = true;
    setGoals({
      execution: existing.execution,
      strategic: existing.strategic,
      mental: existing.mental,
    });
  }, [existing]);

  const setGoalText = (key: GoalCategoryKey, text: string) =>
    setGoals((g) => ({ ...g, [key]: text }));

  const finish = async () => {
    if (!id || submitting) return;
    setSubmitting(true);
    try {
      await upsertGoals(id, {
        execution: normalize(goals.execution),
        strategic: normalize(goals.strategic),
        mental: normalize(goals.mental),
      });
      router.replace(`/round/${id}` as any);
    } finally {
      setSubmitting(false);
    }
  };

  if (!id) return <Screen />;

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <ThemedText type="caption">PRE-ROUND</ThemedText>
          <ThemedText type="title">Today&apos;s Goals</ThemedText>
          {round ? (
            <ThemedText type="muted">
              {round.courseName} · {round.holeCount} holes
            </ThemedText>
          ) : null}
        </View>

        <View style={styles.blocks}>
          {GOAL_CATEGORIES.map((category) => (
            <GoalBlock
              key={category.key}
              category={category}
              value={goals[category.key]}
              onChangeText={(t) => setGoalText(category.key, t)}
            />
          ))}
        </View>

        <Pressable
          disabled={submitting}
          onPress={finish}
          style={({ pressed }) => [
            styles.primaryCtaWrap,
            submitting && styles.primaryCtaDisabled,
            pressed && !submitting && styles.pressed,
          ]}>
          <SketchSurface
            seed="goals-start"
            fill={colors.accent}
            stroke={colors.accent}
            grain
            style={styles.primaryCta}>
            <ThemedText style={styles.primaryCtaLabel}>Continue</ThemedText>
          </SketchSurface>
        </Pressable>
      </ScrollView>

      <Pressable
        onPress={finish}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Skip goal setting"
        style={({ pressed }) => [
          styles.skipButton,
          { top: insets.top + 8 },
          pressed && styles.skipButtonPressed,
        ]}>
        <ThemedText style={styles.skipLabel}>Skip</ThemedText>
      </Pressable>
    </Screen>
  );
}

function GoalBlock({
  category,
  value,
  onChangeText,
}: {
  category: GoalCategory;
  value: string | null;
  onChangeText: (text: string) => void;
}) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  return (
    <View style={styles.block}>
      <ThemedText type="caption">{category.label.toUpperCase()}</ThemedText>
      <ThemedText type="muted" style={styles.helper}>
        {category.helper}
      </ThemedText>

      <SketchSurface
        seed={`goals-input-${category.key}`}
        fill={colors.surfaceAlt}
        style={styles.inputSurface}>
        <TextInput
          value={value ?? ''}
          onChangeText={onChangeText}
          placeholder={category.placeholder}
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          multiline
          returnKeyType="done"
          blurOnSubmit
        />
      </SketchSurface>
    </View>
  );
}

function normalize(value: string | null): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

const makeStyles = (colors: Palette, fonts: FontSet) =>
  StyleSheet.create({
    content: {
      paddingHorizontal: spacing.md,
      gap: spacing.lg,
    },
    header: {
      gap: spacing.xs,
    },
    blocks: {
      gap: spacing.lg,
    },
    block: {
      gap: spacing.xs,
    },
    helper: {
      fontSize: 13,
      lineHeight: 18,
    },
    inputSurface: {
      minHeight: 60,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      justifyContent: 'center',
      marginTop: spacing.xs,
    },
    input: {
      fontFamily: fonts.serif,
      fontSize: 17,
      lineHeight: 24,
      color: colors.textPrimary,
      minHeight: 44,
      paddingTop: spacing.xs,
    },
    pressed: {
      opacity: 0.6,
    },
    primaryCtaWrap: {
      minHeight: 52,
    },
    primaryCta: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 52,
    },
    primaryCtaDisabled: {
      opacity: 0.5,
    },
    primaryCtaLabel: {
      color: colors.accentOn,
      fontFamily: fonts.serif,
      fontSize: 17,
      lineHeight: 23,
    },
    skipButton: {
      position: 'absolute',
      right: 12,
      paddingHorizontal: spacing.md,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 30,
    },
    skipButtonPressed: {
      backgroundColor: colors.accentMuted,
    },
    skipLabel: {
      fontFamily: fonts.serif,
      fontSize: 15,
      color: colors.textSecondary,
    },
  });
