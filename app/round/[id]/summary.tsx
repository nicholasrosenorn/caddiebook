import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApproachTarget } from '@/components/approach-target';
import { DriverTarget, type TargetPin } from '@/components/driver-target';
import { DropdownSelect, type DropdownOption } from '@/components/dropdown-select';
import { GlassSurface } from '@/components/glass-surface';
import { Scorecard } from '@/components/scorecard';
import { Screen } from '@/components/screen';
import { SketchSurface } from '@/components/sketch';
import {
  ScoreDistributionBars,
  Section,
  SplitDistanceBars,
  StatTile,
} from '@/components/stats-figures';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { sortByClubOrder, sortByDriveLength } from '@/constants/clubs';
import { spacing, type Palette, type FontSet } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';
import type { Hole, PostRoundReview, PreRoundGoals } from '@/lib/data/models';
import { useRoundFull } from '@/lib/data/rounds';
import { useStatsBundle } from '@/lib/data/stats';
import { GOAL_CATEGORIES } from '@/lib/goals';
import {
  formatHandicapIndex,
  handicapHistoryFor,
} from '@/lib/lifetime-stats';
import {
  labelForCommonMiss,
  labelForMostCostly,
  labelForRangeFocus,
} from '@/lib/review';
import {
  computePerParAverages,
  computePuttingStats,
  computeRoundSummary,
  computeScoreDistribution,
  countGreenBlocked,
  formatPct,
  PUTT_BUCKETS,
  totalPar,
  totalPenalties,
} from '@/lib/stats';

export default function SummaryScreen() {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { data: detail } = useRoundFull(id);
  const { data: statsData } = useStatsBundle();

  const round = detail?.round ?? null;
  const holes = useMemo(() => detail?.holes ?? [], [detail]);
  const shots = detail?.shots ?? [];
  const putts = detail?.putts ?? [];
  const review = detail?.review ?? null;
  const goals = detail?.goals ?? null;

  // 'all' = every club; otherwise a club name logged on this round's holes.
  const [driveClubFilter, setDriveClubFilter] = useState<'all' | string>('all');
  const [approachClubFilter, setApproachClubFilter] = useState<'all' | string>('all');

  const holesWithNotes = useMemo(
    () => holes.filter((h) => h.notes?.trim()),
    [holes],
  );

  // Resolve each shot's club via its hole; the club lives on the hole, not the shot.
  const holeByNumber = useMemo(() => {
    const map = new Map<number, Hole>();
    for (const h of holes) map.set(h.holeNumber, h);
    return map;
  }, [holes]);

  // Clubs actually logged this round, ordered for each shot type's dropdown.
  const driveClubsUsed = useMemo(() => {
    const seen = new Set<string>();
    for (const h of holes) if (h.driveClub) seen.add(h.driveClub);
    return sortByDriveLength([...seen]);
  }, [holes]);

  const approachClubsUsed = useMemo(() => {
    const seen = new Set<string>();
    for (const h of holes) if (h.approachClub) seen.add(h.approachClub);
    return sortByClubOrder([...seen]);
  }, [holes]);

  const driveClubOptions = useMemo<DropdownOption<string>[]>(
    () => [
      { value: 'all', short: 'All clubs', label: 'All clubs' },
      ...driveClubsUsed.map((c) => ({ value: c, label: c })),
    ],
    [driveClubsUsed],
  );

  const approachClubOptions = useMemo<DropdownOption<string>[]>(
    () => [
      { value: 'all', short: 'All clubs', label: 'All clubs' },
      ...approachClubsUsed.map((c) => ({ value: c, label: c })),
    ],
    [approachClubsUsed],
  );

  // New Handicap Index after this round + how it moved from the index carried in.
  const hcp = useMemo(() => {
    if (!statsData || !id) return null;
    const completed = statsData.rounds.filter((cr) => cr.completedAt != null);
    const holesByRound = new Map<string, Hole[]>();
    for (const h of statsData.holes) {
      const arr = holesByRound.get(h.roundId);
      if (arr) arr.push(h);
      else holesByRound.set(h.roundId, [h]);
    }
    const history = handicapHistoryFor(completed, holesByRound);
    const i = history.points.findIndex((p) => p.roundId === id);
    if (i === -1) return null;
    const newHcp = history.points[i].index;
    const before = i > 0 ? history.points[i - 1].index : null;
    const delta = before == null ? null : Math.round((newHcp - before) * 10) / 10;
    return { newHcp, delta };
  }, [statsData, id]);

  if (!id || !round) return <Screen />;

  const summary = computeRoundSummary(holes);
  const distribution = computeScoreDistribution(holes);
  const parPlayed = totalPar(holes);
  const toPar = summary.holesPlayed > 0 ? summary.totalScore - parPlayed : null;
  const perPar = computePerParAverages(holes);
  const puttingStats = computePuttingStats(holes);
  const penalties = totalPenalties(holes);
  const noApproachHoles = countGreenBlocked(holes);

  const drivePins: TargetPin[] = shots
    .filter(
      (s) =>
        s.shotType === 'driver' &&
        (driveClubFilter === 'all' ||
          holeByNumber.get(s.holeNumber)?.driveClub === driveClubFilter),
    )
    .map((s) => ({ xNorm: s.xNorm, yNorm: s.yNorm, key: s.id }));
  const approachPins: TargetPin[] = shots
    .filter(
      (s) =>
        s.shotType === 'approach' &&
        (approachClubFilter === 'all' ||
          holeByNumber.get(s.holeNumber)?.approachClub === approachClubFilter),
    )
    .map((s) => ({ xNorm: s.xNorm, yNorm: s.yNorm, key: s.id }));

  const onClose = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/' as any);
    }
  };

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <ThemedText type="caption">{formatDate(round.datePlayed)}</ThemedText>
          <ThemedText type="title">{round.courseName}</ThemedText>
        </View>

        <SketchSurface seed="summary-score" style={styles.scoreCard}>
          <View style={styles.scoreCardCol}>
            <ThemedText type="caption">SCORE</ThemedText>
            <ThemedText style={styles.bigScore}>
              {summary.holesPlayed > 0 ? summary.totalScore : '—'}
            </ThemedText>
          </View>
          <View style={styles.scoreCardDivider} />
          <View style={styles.scoreCardCol}>
            <ThemedText type="caption">TO PAR</ThemedText>
            <ThemedText style={styles.bigScore}>
              {toPar == null ? '—' : formatToPar(toPar)}
            </ThemedText>
          </View>
        </SketchSurface>

        {hcp ? (
          <SketchSurface seed="summary-hcp" style={styles.scoreCard}>
            <View style={styles.scoreCardCol}>
              <ThemedText type="caption">HCP INDEX</ThemedText>
              <ThemedText style={styles.bigScore}>{formatHandicapIndex(hcp.newHcp)}</ThemedText>
            </View>
            <View style={styles.scoreCardDivider} />
            <View style={styles.scoreCardCol}>
              <ThemedText type="caption">CHANGE</ThemedText>
              <ThemedText
                style={[
                  styles.bigScore,
                  hcp.delta != null && hcp.delta < 0 && { color: colors.accent },
                  hcp.delta != null && hcp.delta > 0 && { color: colors.textMuted },
                ]}>
                {hcp.delta == null ? '—' : formatDelta(hcp.delta)}
              </ThemedText>
            </View>
          </SketchSurface>
        ) : null}

        <Section title="Scorecard">
          <Scorecard
            holes={holes}
            onPressHole={(n) => router.push(`/round/${id}?hole=${n}&page=stats` as any)}
          />
        </Section>

        <View style={styles.statGrid}>
          <View style={styles.statRow}>
            <StatTile label="GIR" value={formatPct(summary.girPct)} />
            <StatTile label="FIR" value={formatPct(summary.firPct)} />
            <StatTile label="U&D" value={formatPct(summary.udPct)} />
          </View>
          <View style={styles.statRow}>
            <StatTile
              label="Putts/Hole"
              value={
                puttingStats.perHole != null ? puttingStats.perHole.toFixed(1) : '—'
              }
            />
            <StatTile
              label="3-Putts"
              value={
                summary.holesPlayed > 0 ? String(puttingStats.threePuttCount) : '—'
              }
            />
            <StatTile
              label="Penalties"
              value={summary.holesPlayed > 0 ? String(penalties) : '—'}
            />
          </View>
        </View>

        <Section title="Scoring by par">
          <View style={styles.perParRow}>
            <StatTile label="Par 3" value={formatAvg(perPar.par3)} />
            <StatTile label="Par 4" value={formatAvg(perPar.par4)} />
            <StatTile label="Par 5" value={formatAvg(perPar.par5)} />
          </View>
        </Section>

        <Section title="Score distribution">
          <ScoreDistributionBars distribution={distribution} />
        </Section>

        <Section title="Drive dispersion">
          <DropdownSelect
            seed="summary-drive-club"
            options={driveClubOptions}
            value={driveClubFilter}
            onChange={setDriveClubFilter}
            block
          />
          <View style={[styles.targetWrap, { marginBottom: spacing.md }]}>
            <DriverTarget pins={drivePins} width={260} height={390} />
          </View>
          {noApproachHoles > 0 ? (
            <ThemedText type="muted" style={styles.centerText}>
              {noApproachHoles} drive{noApproachHoles === 1 ? '' : 's'} left no shot at the green
            </ThemedText>
          ) : null}
        </Section>

        <Section title="Approach dispersion">
          <DropdownSelect
            seed="summary-club"
            options={approachClubOptions}
            value={approachClubFilter}
            onChange={setApproachClubFilter}
            block
          />
          <View style={styles.targetWrap}>
            <ApproachTarget pins={approachPins} size={290} />
          </View>
          {/* <ThemedText type="muted" style={styles.centerText}>
            {approachPins.length} approach{approachPins.length === 1 ? '' : 'es'} ·
            {' '}GIR {formatPct(summary.girPct)}
          </ThemedText> */}
        </Section>

        <Section title="Putting">
          {putts.length === 0 ? (
            <ThemedText type="muted">No putts logged.</ThemedText>
          ) : (
            <SplitDistanceBars
              seedPrefix="putt"
              successLabel="Made"
              failLabel="Missed"
              rows={PUTT_BUCKETS.map((b) => {
                const inBucket = putts.filter((p) => p.distanceFt === b.ft);
                const makes = inBucket.filter((p) => p.made).length;
                return { key: String(b.ft), label: b.label, success: makes, total: inBucket.length };
              })}
            />
          )}
        </Section>

        <Section title="Round goals">
          <RoundGoals goals={goals} />
        </Section>

        <Section title="Post-round review">
          {review ? <ReviewAnswers review={review} /> : <NoReview />}
        </Section>

        {holesWithNotes.length > 0 ? (
          <Section title="Hole notes">
            <SketchSurface seed="summary-notes" style={styles.reviewCard}>
              {holesWithNotes.map((h, i) => (
                <View
                  key={h.id}
                  style={[
                    styles.noteRow,
                    i < holesWithNotes.length - 1 && styles.reviewRowDivider,
                  ]}>
                  <ThemedText type="caption">HOLE {h.holeNumber}</ThemedText>
                  <ThemedText style={styles.noteBody}>{h.notes?.trim()}</ThemedText>
                </View>
              ))}
            </SketchSurface>
          </Section>
        ) : null}
      </ScrollView>

      <Pressable
        onPress={() => router.push(`/round/${id}/settings` as any)}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Round settings"
        style={[styles.settingsButton, { top: insets.top + 8 }]}>
        {({ pressed }) => (
          <>
            <GlassSurface borderRadius={18} />
            {pressed && <View style={styles.buttonPressedOverlay} pointerEvents="none" />}
            <IconSymbol name="gearshape" size={18} color={colors.textPrimary} />
          </>
        )}
      </Pressable>

      <Pressable
        onPress={onClose}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Close summary"
        style={[styles.closeButton, { top: insets.top + 8 }]}>
        {({ pressed }) => (
          <>
            <GlassSurface borderRadius={18} />
            {pressed && <View style={styles.buttonPressedOverlay} pointerEvents="none" />}
            <IconSymbol name="xmark" size={18} color={colors.textPrimary} />
          </>
        )}
      </Pressable>
    </Screen>
  );
}

function formatAvg(value: number | null): string {
  return value != null ? value.toFixed(1) : '—';
}

function RoundGoals({ goals }: { goals: PreRoundGoals | null }) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const rows = GOAL_CATEGORIES.map((c) => ({ label: c.label, value: goals?.[c.key] ?? null })).filter(
    (r): r is { label: string; value: string } => !!r.value,
  );
  if (rows.length === 0) {
    return (
      <SketchSurface seed="summary-nogoals" style={styles.reviewCard}>
        <View style={styles.reviewRow}>
          <ThemedText type="muted">No goals set for this round.</ThemedText>
        </View>
      </SketchSurface>
    );
  }
  return (
    <SketchSurface seed="summary-goals" style={styles.reviewCard}>
      {rows.map((row, i) => (
        <View
          key={row.label}
          style={[styles.goalRow, i < rows.length - 1 && styles.reviewRowDivider]}>
          <ThemedText type="caption">{row.label.toUpperCase()}</ThemedText>
          <ThemedText style={styles.goalValue}>{row.value}</ThemedText>
        </View>
      ))}
    </SketchSurface>
  );
}

function ReviewAnswers({ review }: { review: PostRoundReview }) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const rows: { question: string; answer: string | null; emphasis?: 'rating' }[] = [
    {
      question: 'Cost me the most strokes',
      answer: review.mostCostly ? labelForMostCostly(review.mostCostly) : null,
    },
    {
      question: 'Decision making',
      answer:
        review.decisionMakingRating != null ? `${review.decisionMakingRating}/10` : null,
      emphasis: 'rating',
    },
    {
      question: 'Most common miss',
      answer: review.commonMiss ? labelForCommonMiss(review.commonMiss) : null,
    },
    {
      question: '15-min range focus',
      answer: review.rangeFocus ? labelForRangeFocus(review.rangeFocus) : null,
    },
    {
      question: 'Overall round',
      answer: review.overallRating != null ? `${review.overallRating}/10` : null,
      emphasis: 'rating',
    },
  ];
  return (
    <SketchSurface seed="summary-review" style={styles.reviewCard}>
      {rows.map((row, i) => (
        <View
          key={row.question}
          style={[styles.reviewRow, i < rows.length - 1 && styles.reviewRowDivider]}>
          <ThemedText style={styles.reviewQuestion}>{row.question}</ThemedText>
          <ThemedText
            style={[
              styles.reviewAnswer,
              row.answer == null && styles.reviewAnswerEmpty,
              row.emphasis === 'rating' && styles.reviewAnswerRating,
            ]}
            numberOfLines={1}>
            {row.answer ?? '—'}
          </ThemedText>
        </View>
      ))}
    </SketchSurface>
  );
}

function NoReview() {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  return (
    <SketchSurface seed="summary-noreview" style={styles.reviewCard}>
      <View style={styles.reviewRow}>
        <ThemedText type="muted">No review yet. Finish the round to record one.</ThemedText>
      </View>
    </SketchSurface>
  );
}

function formatDate(iso: string): string {
  const parts = iso.split('-').map((s) => parseInt(s, 10));
  if (parts.length !== 3 || parts.some(Number.isNaN)) return iso;
  const [y, m, d] = parts;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatToPar(toPar: number): string {
  if (toPar === 0) return 'Even par';
  if (toPar > 0) return `+${toPar}`;
  return `${toPar}`;
}

// Signed handicap change, one decimal: "+0.4", "-0.3", "0.0".
function formatDelta(delta: number): string {
  return delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1);
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
  scoreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  scoreCardCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  scoreCardDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: colors.borderStrong,
    marginVertical: spacing.xs,
  },
  bigScore: {
    fontFamily: fonts.serifBold,
    fontSize: 36,
    color: colors.textPrimary,
    lineHeight: 40,
  },
  statGrid: {
    gap: spacing.sm,
  },
  statRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  perParRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  targetWrap: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  centerText: {
    textAlign: 'center',
  },
  reviewCard: {
    paddingHorizontal: spacing.xs,
  },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  reviewRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  goalRow: {
    gap: 4,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  goalValue: {
    fontFamily: fonts.serif,
    fontSize: 16,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  noteRow: {
    gap: 4,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  noteBody: {
    fontFamily: fonts.serif,
    fontSize: 16,
    lineHeight: 23,
    color: colors.textPrimary,
  },
  reviewQuestion: {
    flex: 1,
    fontSize: 15,
    color: colors.textSecondary,
  },
  reviewAnswer: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'right',
  },
  reviewAnswerEmpty: {
    color: colors.textMuted,
    fontWeight: '400',
  },
  reviewAnswerRating: {
    color: colors.accent,
  },
  closeButton: {
    position: 'absolute',
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
  },
  settingsButton: {
    position: 'absolute',
    left: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
  },
  buttonPressedOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
    backgroundColor: colors.accentMuted,
  },
});
