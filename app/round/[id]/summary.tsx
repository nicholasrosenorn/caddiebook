import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApproachTarget } from '@/components/approach-target';
import { DriverTarget, type TargetPin } from '@/components/driver-target';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { colors, radius, spacing } from '@/constants/theme';
import {
  getHolesForRound,
  getPuttsForRound,
  getReview,
  getRound,
  getShotsForRound,
} from '@/db/queries';
import type { Hole, PostRoundReview, Putt, Round, Shot } from '@/db/types';
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
  formatPct,
  totalPar,
  totalPenalties,
} from '@/lib/stats';

const PUTT_BUCKETS = [
  { ft: 3, label: '<3 ft' },
  { ft: 10, label: '3–10 ft' },
  { ft: 15, label: '10–15 ft' },
  { ft: 30, label: '15+ ft' },
] as const;

export default function SummaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [round, setRound] = useState<Round | null>(null);
  const [holes, setHoles] = useState<Hole[]>([]);
  const [shots, setShots] = useState<Shot[]>([]);
  const [putts, setPutts] = useState<Putt[]>([]);
  const [review, setReview] = useState<PostRoundReview | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const [r, hs, ss, ps, rv] = await Promise.all([
      getRound(id),
      getHolesForRound(id),
      getShotsForRound(id),
      getPuttsForRound(id),
      getReview(id),
    ]);
    setRound(r);
    setHoles(hs);
    setShots(ss);
    setPutts(ps);
    setReview(rv);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!id || !round) return <Screen />;

  const summary = computeRoundSummary(holes);
  const distribution = computeScoreDistribution(holes);
  const parPlayed = totalPar(holes);
  const toPar = summary.holesPlayed > 0 ? summary.totalScore - parPlayed : null;
  const perPar = computePerParAverages(holes);
  const puttingStats = computePuttingStats(holes);
  const penalties = totalPenalties(holes);

  const drivePins: TargetPin[] = shots
    .filter((s) => s.shotType === 'driver')
    .map((s) => ({ xNorm: s.xNorm, yNorm: s.yNorm, key: s.id }));
  const approachPins: TargetPin[] = shots
    .filter((s) => s.shotType === 'approach')
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
          {round.completedAt ? (
            <ThemedText type="muted">
              ✓ Completed {formatDate(round.completedAt.slice(0, 10))}
            </ThemedText>
          ) : null}
        </View>

        <View style={styles.scoreCard}>
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
          <View style={styles.scoreCardDivider} />
          <View style={styles.scoreCardCol}>
            <ThemedText type="caption">HOLES</ThemedText>
            <ThemedText style={styles.bigScore}>
              {summary.holesPlayed}
              <ThemedText style={styles.bigScoreSuffix}>/{round.holeCount}</ThemedText>
            </ThemedText>
          </View>
        </View>

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
            <PerParTile label="Par 3" value={perPar.par3} />
            <PerParTile label="Par 4" value={perPar.par4} />
            <PerParTile label="Par 5" value={perPar.par5} />
          </View>
        </Section>

        <Section title="Score distribution">
          <ScoreDistributionBars distribution={distribution} />
        </Section>

        <Section title="Drive dispersion">
          <View style={styles.targetWrap}>
            <DriverTarget pins={drivePins} width={200} height={300} />
          </View>
          <ThemedText type="muted" style={styles.centerText}>
            {drivePins.length} drive{drivePins.length === 1 ? '' : 's'} ·
            {' '}FIR {formatPct(summary.firPct)}
          </ThemedText>
        </Section>

        <Section title="Approach dispersion">
          <View style={styles.targetWrap}>
            <ApproachTarget pins={approachPins} size={240} />
          </View>
          <ThemedText type="muted" style={styles.centerText}>
            {approachPins.length} approach{approachPins.length === 1 ? '' : 'es'} ·
            {' '}GIR {formatPct(summary.girPct)}
          </ThemedText>
        </Section>

        <Section title="Putting">
          <PuttingDistribution putts={putts} />
        </Section>

        <Section title="Post-round review">
          {review ? <ReviewAnswers review={review} /> : <NoReview />}
        </Section>

        <Pressable
          onPress={() => router.push(`/round/${id}` as any)}
          style={({ pressed }) => [styles.editCta, pressed && styles.editCtaPressed]}>
          <ThemedText style={styles.editCtaLabel}>Edit round</ThemedText>
        </Pressable>
      </ScrollView>

      <Pressable
        onPress={onClose}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Close summary"
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="subtitle">{title}</ThemedText>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statTile}>
      <ThemedText type="caption" numberOfLines={1}>
        {label.toUpperCase()}
      </ThemedText>
      <ThemedText style={styles.statTileValue} numberOfLines={1}>
        {value}
      </ThemedText>
    </View>
  );
}

function PerParTile({ label, value }: { label: string; value: number | null }) {
  return (
    <View style={styles.perParTile}>
      <ThemedText type="caption" numberOfLines={1}>
        {label.toUpperCase()}
      </ThemedText>
      <ThemedText style={styles.perParValue} numberOfLines={1}>
        {value != null ? value.toFixed(1) : '—'}
      </ThemedText>
    </View>
  );
}

const DIST_ROWS: {
  key: keyof ReturnType<typeof computeScoreDistribution>;
  label: string;
  color: string;
}[] = [
  { key: 'eagleOrBetter', label: 'Eagle+', color: colors.info },
  { key: 'birdie', label: 'Birdie', color: colors.accent },
  { key: 'par', label: 'Par', color: colors.borderStrong },
  { key: 'bogey', label: 'Bogey', color: colors.warning },
  { key: 'doubleBogey', label: 'Double', color: '#F97316' },
  { key: 'tripleOrWorse', label: 'Triple+', color: colors.danger },
];

function ScoreDistributionBars({
  distribution,
}: {
  distribution: ReturnType<typeof computeScoreDistribution>;
}) {
  const max = Math.max(1, ...DIST_ROWS.map((r) => distribution[r.key]));
  return (
    <View style={styles.distList}>
      {DIST_ROWS.map((row) => {
        const count = distribution[row.key];
        const frac = count > 0 ? count / max : 0;
        return (
          <View key={row.key} style={styles.distRowItem}>
            <ThemedText style={styles.distRowLabel}>{row.label}</ThemedText>
            <View style={styles.distBarTrack}>
              <View
                style={[
                  styles.distBarFill,
                  {
                    flex: frac,
                    backgroundColor: count > 0 ? row.color : 'transparent',
                    minWidth: count > 0 ? 6 : 0,
                  },
                ]}
              />
              <View style={{ flex: Math.max(0, 1 - frac) }} />
            </View>
            <ThemedText type="muted" style={styles.distRowCount}>
              {count}
            </ThemedText>
          </View>
        );
      })}
    </View>
  );
}

function PuttingDistribution({ putts }: { putts: Putt[] }) {
  const buckets = PUTT_BUCKETS.map((b) => {
    const inBucket = putts.filter((p) => p.distanceFt === b.ft);
    const makes = inBucket.filter((p) => p.made).length;
    const misses = inBucket.length - makes;
    return { ...b, makes, misses, total: inBucket.length };
  });
  const maxTotal = Math.max(1, ...buckets.map((b) => b.total));

  if (putts.length === 0) {
    return <ThemedText type="muted">No putts logged.</ThemedText>;
  }

  return (
    <View style={styles.puttingList}>
      {buckets.map((b) => {
        const makesPct = b.total > 0 ? b.makes / maxTotal : 0;
        const missesPct = b.total > 0 ? b.misses / maxTotal : 0;
        return (
          <View key={b.ft} style={styles.puttRow}>
            <ThemedText style={styles.puttLabel}>{b.label}</ThemedText>
            <View style={styles.puttBarTrack}>
              <View
                style={[
                  styles.puttBarMake,
                  { flex: makesPct, minWidth: b.makes > 0 ? 6 : 0 },
                ]}
              />
              <View
                style={[
                  styles.puttBarMiss,
                  { flex: missesPct, minWidth: b.misses > 0 ? 6 : 0 },
                ]}
              />
              <View style={{ flex: Math.max(0, 1 - makesPct - missesPct) }} />
            </View>
            <ThemedText type="muted" style={styles.puttCounts}>
              {b.makes}/{b.total}
            </ThemedText>
          </View>
        );
      })}
      <View style={styles.puttLegend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, styles.puttBarMake]} />
          <ThemedText type="caption">Made</ThemedText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendSwatch, styles.puttBarMiss]} />
          <ThemedText type="caption">Missed</ThemedText>
        </View>
      </View>
    </View>
  );
}

function ReviewAnswers({ review }: { review: PostRoundReview }) {
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
    <View style={styles.reviewCard}>
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
    </View>
  );
}

function NoReview() {
  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewRow}>
        <ThemedText type="muted">No review yet. Finish the round to record one.</ThemedText>
      </View>
    </View>
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

const styles = StyleSheet.create({
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
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
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
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  bigScore: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: 40,
  },
  bigScoreSuffix: {
    fontSize: 18,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  statGrid: {
    gap: spacing.sm,
  },
  statRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statTile: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    gap: 4,
    alignItems: 'center',
  },
  statTileValue: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  perParRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  perParTile: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    gap: 4,
  },
  perParValue: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  section: {
    gap: spacing.md,
  },
  sectionBody: {
    gap: spacing.sm,
  },
  distList: {
    gap: spacing.sm,
  },
  distRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  distRowLabel: {
    width: 64,
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  distBarTrack: {
    flex: 1,
    height: 14,
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 7,
    overflow: 'hidden',
  },
  distBarFill: {
    height: '100%',
  },
  distRowCount: {
    width: 28,
    textAlign: 'right',
  },
  targetWrap: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  centerText: {
    textAlign: 'center',
  },
  puttingList: {
    gap: spacing.sm,
  },
  puttRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  puttLabel: {
    width: 64,
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  puttBarTrack: {
    flex: 1,
    height: 14,
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 7,
    overflow: 'hidden',
  },
  puttBarMake: {
    backgroundColor: colors.accent,
    height: '100%',
  },
  puttBarMiss: {
    backgroundColor: colors.danger,
    height: '100%',
  },
  puttCounts: {
    width: 52,
    textAlign: 'right',
  },
  puttLegend: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingTop: spacing.xs,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  reviewCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
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
  editCta: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editCtaPressed: {
    backgroundColor: colors.accentPressed,
  },
  editCtaLabel: {
    color: colors.accentOn,
    fontSize: 17,
    fontWeight: '600',
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
});
