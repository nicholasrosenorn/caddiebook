import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen } from '@/components/screen';
import { SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { spacing, type Palette, type FontSet } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';
import { getReview, setRoundCompletedAt, upsertReview } from '@/db/queries';
import { syncNow } from '@/lib/sync/engine';
import type { CommonMiss, MostCostly, RangeFocus } from '@/db/types';
import {
  COMMON_MISS_OPTIONS,
  MOST_COSTLY_OPTIONS,
  RANGE_FOCUS_OPTIONS,
  RATING_VALUES,
} from '@/lib/review';

const TOTAL_PAGES = 5;

export default function ReviewScreen() {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [pageHeight, setPageHeight] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const [mostCostly, setMostCostly] = useState<MostCostly | null>(null);
  const [decisionMakingRating, setDecisionMakingRating] = useState<number | null>(null);
  const [commonMiss, setCommonMiss] = useState<CommonMiss | null>(null);
  const [rangeFocus, setRangeFocus] = useState<RangeFocus | null>(null);
  const [overallRating, setOverallRating] = useState<number | null>(null);
  const [hadExistingReview, setHadExistingReview] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const existing = await getReview(id);
      if (cancelled || !existing) return;
      setMostCostly(existing.mostCostly);
      setDecisionMakingRating(existing.decisionMakingRating);
      setCommonMiss(existing.commonMiss);
      setRangeFocus(existing.rangeFocus);
      setOverallRating(existing.overallRating);
      setHadExistingReview(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const scrollToPage = useCallback(
    (page: number) => {
      if (pageHeight == null) return;
      scrollRef.current?.scrollTo({ y: page * pageHeight, animated: true });
    },
    [pageHeight],
  );

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (pageHeight == null) return;
    const y = e.nativeEvent.contentOffset.y;
    const idx = Math.min(TOTAL_PAGES - 1, Math.max(0, Math.round(y / pageHeight)));
    if (idx !== currentPage) setCurrentPage(idx);
  };

  const onClose = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/' as any);
    }
  };

  const onSubmit = async () => {
    if (!id) return;
    if (
      !mostCostly ||
      decisionMakingRating == null ||
      !commonMiss ||
      !rangeFocus ||
      overallRating == null
    ) {
      return;
    }
    setSubmitting(true);
    try {
      await upsertReview({
        roundId: id,
        mostCostly,
        decisionMakingRating,
        commonMiss,
        rangeFocus,
        overallRating,
      });
      if (!hadExistingReview) {
        await setRoundCompletedAt(id, new Date().toISOString());
      }
      // Finishing a round is a natural "push my work up now" moment.
      void syncNow();
      router.replace(`/round/${id}/summary` as any);
    } finally {
      setSubmitting(false);
    }
  };

  if (!id) return <Screen />;

  return (
    <Screen padded={false}>
      <View style={[styles.flex, { paddingTop: insets.top }]}>
        <View
          style={styles.flex}
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            if (h > 0 && h !== pageHeight) setPageHeight(h);
          }}>
          {pageHeight !== null && (
            <>
              <ScrollView
                ref={scrollRef}
                pagingEnabled
                decelerationRate="fast"
                showsVerticalScrollIndicator={false}
                onScroll={onScroll}
                scrollEventThrottle={16}>
                <QuestionPage
                  height={pageHeight}
                  index={0}
                  total={TOTAL_PAGES}
                  caption="QUESTION 1 OF 5"
                  title="What cost me the most strokes today?"
                  onBack={null}>
                  <ChipList
                    options={MOST_COSTLY_OPTIONS}
                    value={mostCostly}
                    onChange={(v) => {
                      setMostCostly(v);
                      scrollToPage(1);
                    }}
                  />
                </QuestionPage>

                <QuestionPage
                  height={pageHeight}
                  index={1}
                  total={TOTAL_PAGES}
                  caption="QUESTION 2 OF 5"
                  title="Rate my decision making"
                  onBack={() => scrollToPage(0)}>
                  <RatingGrid
                    value={decisionMakingRating}
                    onChange={(v) => {
                      setDecisionMakingRating(v);
                      scrollToPage(2);
                    }}
                  />
                </QuestionPage>

                <QuestionPage
                  height={pageHeight}
                  index={2}
                  total={TOTAL_PAGES}
                  caption="QUESTION 3 OF 5"
                  title="Most common miss today"
                  onBack={() => scrollToPage(1)}>
                  <ChipList
                    options={COMMON_MISS_OPTIONS}
                    value={commonMiss}
                    onChange={(v) => {
                      setCommonMiss(v);
                      scrollToPage(3);
                    }}
                  />
                </QuestionPage>

                <QuestionPage
                  height={pageHeight}
                  index={3}
                  total={TOTAL_PAGES}
                  caption="QUESTION 4 OF 5"
                  title="If I had 15 minutes on the range, I'd work on…"
                  onBack={() => scrollToPage(2)}>
                  <ChipList
                    options={RANGE_FOCUS_OPTIONS}
                    value={rangeFocus}
                    onChange={(v) => {
                      setRangeFocus(v);
                      scrollToPage(4);
                    }}
                  />
                </QuestionPage>

                <QuestionPage
                  height={pageHeight}
                  index={4}
                  total={TOTAL_PAGES}
                  caption="QUESTION 5 OF 5"
                  title="Overall round rating"
                  onBack={() => scrollToPage(3)}>
                  <RatingGrid value={overallRating} onChange={setOverallRating} />
                  <Pressable
                    disabled={
                      submitting ||
                      !mostCostly ||
                      decisionMakingRating == null ||
                      !commonMiss ||
                      !rangeFocus ||
                      overallRating == null
                    }
                    onPress={onSubmit}
                    style={({ pressed }) => {
                      const ready =
                        !submitting &&
                        !!mostCostly &&
                        decisionMakingRating != null &&
                        !!commonMiss &&
                        !!rangeFocus &&
                        overallRating != null;
                      return [
                        styles.primaryCtaWrap,
                        !ready && styles.primaryCtaDisabled,
                        pressed && ready && styles.pressed,
                      ];
                    }}>
                    <SketchSurface
                      seed="review-submit"
                      fill={colors.accent}
                      stroke={colors.accent}
                      grain
                      style={styles.primaryCta}>
                      <ThemedText style={styles.primaryCtaLabel}>
                        {hadExistingReview ? 'Save review' : 'Finish round'}
                      </ThemedText>
                    </SketchSurface>
                  </Pressable>
                </QuestionPage>
              </ScrollView>

              <PageDots totalPages={TOTAL_PAGES} currentPage={currentPage} />
            </>
          )}
        </View>
      </View>

      <Pressable
        onPress={onClose}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Close review"
        style={({ pressed }) => [
          styles.closeButton,
          { top: insets.top + 8 },
          pressed && styles.closeButtonPressed,
        ]}>
        <IconSymbol name="xmark" size={18} color={colors.textPrimary} />
      </Pressable>
    </Screen>
  );
}

function QuestionPage({
  height,
  index,
  total,
  caption,
  title,
  onBack,
  children,
}: {
  height: number;
  index: number;
  total: number;
  caption: string;
  title: string;
  onBack: (() => void) | null;
  children: React.ReactNode;
}) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  return (
    <View style={{ height }}>
      <View style={styles.pageContent}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={`Back to question ${index} of ${total}`}
            style={({ pressed }) => [styles.backChevron, pressed && styles.backChevronPressed]}>
            <SketchSurface seed="review-back" radius={18} style={styles.backChevronSurface}>
              <ThemedText style={styles.backChevronLabel}>‹</ThemedText>
            </SketchSurface>
          </Pressable>
        ) : (
          <View style={styles.backChevronPlaceholder} />
        )}

        <View style={styles.headerBlock}>
          <ThemedText type="caption">{caption}</ThemedText>
          <ThemedText type="title">{title}</ThemedText>
        </View>

        <View style={styles.body}>{children}</View>
      </View>
    </View>
  );
}

function ChipList<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (next: T) => void;
}) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  return (
    <View style={styles.chipList}>
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={({ pressed }) => [styles.chip, pressed && !selected && styles.pressed]}>
            <SketchSurface
              seed={`review-chip-${opt.value}`}
              fill={selected ? colors.accent : colors.surface}
              stroke={selected ? colors.accent : colors.borderStrong}
              grain={selected}
              style={styles.chipSurface}>
              <ThemedText
                style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
                {opt.label}
              </ThemedText>
            </SketchSurface>
          </Pressable>
        );
      })}
    </View>
  );
}

function RatingGrid({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (next: number) => void;
}) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const row1 = RATING_VALUES.slice(0, 5);
  const row2 = RATING_VALUES.slice(5, 10);
  const renderTile = (n: number) => {
    const selected = value === n;
    return (
      <Pressable
        key={n}
        onPress={() => onChange(n)}
        style={({ pressed }) => [styles.ratingTile, pressed && !selected && styles.pressed]}>
        <SketchSurface
          seed={`review-rating-${n}`}
          fill={selected ? colors.accent : colors.surface}
          stroke={selected ? colors.accent : colors.borderStrong}
          grain={selected}
          style={styles.ratingTileSurface}>
          <ThemedText
            style={[styles.ratingValue, selected && styles.ratingValueSelected]}>
            {n}
          </ThemedText>
        </SketchSurface>
      </Pressable>
    );
  };
  return (
    <View style={styles.ratingGrid}>
      <View style={styles.ratingRow}>{row1.map(renderTile)}</View>
      <View style={styles.ratingRow}>{row2.map(renderTile)}</View>
    </View>
  );
}

function PageDots({
  totalPages,
  currentPage,
}: {
  totalPages: number;
  currentPage: number;
}) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  return (
    <View style={styles.dotsContainer} pointerEvents="none">
      {Array.from({ length: totalPages }).map((_, i) => (
        <View
          key={i}
          style={[styles.dot, currentPage === i && styles.dotActive]}
        />
      ))}
    </View>
  );
}

const makeStyles = (colors: Palette, fonts: FontSet) =>
  StyleSheet.create({
  flex: { flex: 1 },
  pageContent: {
    flex: 1,
    paddingLeft: spacing.md,
    paddingRight: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  backChevron: {
    width: 36,
    height: 36,
  },
  backChevronSurface: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backChevronPressed: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.6,
  },
  backChevronPlaceholder: {
    width: 36,
    height: 36,
  },
  backChevronLabel: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.textPrimary,
    lineHeight: 26,
    marginTop: -2,
  },
  headerBlock: {
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
    gap: spacing.xs,
  },
  body: {
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
  },
  chipList: {
    gap: spacing.sm,
  },
  chip: {
    minHeight: 56,
  },
  chipSurface: {
    flex: 1,
    minHeight: 56,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipLabel: {
    fontFamily: fonts.serif,
    fontSize: 17,
    lineHeight: 23,
    color: colors.textPrimary,
  },
  chipLabelSelected: {
    color: colors.accentOn,
  },
  ratingGrid: {
    gap: spacing.sm,
  },
  ratingRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  ratingTile: {
    flex: 1,
    aspectRatio: 1,
  },
  ratingTileSurface: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingValue: {
    fontFamily: fonts.serifBold,
    fontSize: 22,
    lineHeight: 30,
    color: colors.textPrimary,
  },
  ratingValueSelected: {
    color: colors.accentOn,
  },
  primaryCtaWrap: {
    marginTop: spacing.md,
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
  closeButton: {
    position: 'absolute',
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
  },
  closeButtonPressed: {
    backgroundColor: colors.accentMuted,
  },
  dotsContainer: {
    position: 'absolute',
    right: 10,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.borderStrong,
  },
  dotActive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
});
