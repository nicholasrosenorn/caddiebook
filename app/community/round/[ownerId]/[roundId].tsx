import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ApproachTarget } from '@/components/approach-target';
import { DriverTarget, type TargetPin } from '@/components/driver-target';
import { DropdownSelect, type DropdownOption } from '@/components/dropdown-select';
import { ModerationMenu } from '@/components/moderation-menu';
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
import { getFriendRound, likeRound, unlikeRound } from '@/lib/api/client';
import { wireHoleToHole, wirePuttToPutt, wireShotToShot } from '@/lib/community/map';
import type { FriendRoundDetail } from '@/lib/api/types';
import {
  computePerParAverages,
  computeRoundSummary,
  computeScoreDistribution,
  formatPct,
  PUTT_BUCKETS,
  totalPar,
} from '@/lib/stats';

export default function FriendRoundScreen() {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const { ownerId, roundId } = useLocalSearchParams<{ ownerId: string; roundId: string }>();
  const [detail, setDetail] = useState<FriendRoundDetail | null>(null);
  const [error, setError] = useState(false);
  // 'all' = every club; otherwise a club name logged on this round's holes.
  const [driveClubFilter, setDriveClubFilter] = useState<'all' | string>('all');
  const [approachClubFilter, setApproachClubFilter] = useState<'all' | string>('all');

  const load = useCallback(async () => {
    if (!ownerId || !roundId) return;
    try {
      setDetail(await getFriendRound(ownerId, roundId));
    } catch {
      setError(true);
    }
  }, [ownerId, roundId]);

  useEffect(() => {
    load();
  }, [load]);

  const onToggleLike = useCallback(async () => {
    if (!detail) return;
    const next = !detail.likedByMe;
    setDetail({ ...detail, likedByMe: next, likeCount: detail.likeCount + (next ? 1 : -1) });
    try {
      const res = next
        ? await likeRound(detail.ownerId, detail.id)
        : await unlikeRound(detail.ownerId, detail.id);
      setDetail((d) => (d ? { ...d, likedByMe: res.likedByMe, likeCount: res.likeCount } : d));
    } catch {
      setDetail((d) =>
        d ? { ...d, likedByMe: detail.likedByMe, likeCount: detail.likeCount } : d,
      );
    }
  }, [detail]);

  if (error) {
    return (
      <Screen>
        <View style={styles.center}>
          <ThemedText type="muted">This round is no longer available.</ThemedText>
        </View>
      </Screen>
    );
  }
  if (!detail) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </Screen>
    );
  }

  const holes = detail.holes.map(wireHoleToHole);
  const shots = detail.shots.map(wireShotToShot);
  const putts = detail.putts.map(wirePuttToPutt);
  const summary = computeRoundSummary(holes);
  const parPlayed = totalPar(holes);
  const toPar = summary.holesPlayed > 0 ? summary.totalScore - parPlayed : null;
  const perPar = computePerParAverages(holes);
  const distribution = computeScoreDistribution(holes);
  const fullName = [detail.owner.firstName, detail.owner.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();
  const ownerName = fullName || (detail.owner.username ? `@${detail.owner.username}` : 'A friend');
  const ownerHandle = fullName && detail.owner.username ? `@${detail.owner.username}` : null;

  // Resolve each shot's club via its hole; the club lives on the hole, not the shot.
  const holeByNumber = new Map(holes.map((h) => [h.holeNumber, h]));

  // Clubs actually logged this round, ordered for each shot type's dropdown.
  const driveClubsUsed = sortByDriveLength([
    ...new Set(holes.map((h) => h.driveClub).filter((c): c is string => !!c)),
  ]);
  const approachClubsUsed = sortByClubOrder([
    ...new Set(holes.map((h) => h.approachClub).filter((c): c is string => !!c)),
  ]);

  const driveClubOptions: DropdownOption<string>[] = [
    { value: 'all', short: 'All clubs', label: 'All clubs' },
    ...driveClubsUsed.map((c) => ({ value: c, label: c })),
  ];
  const approachClubOptions: DropdownOption<string>[] = [
    { value: 'all', short: 'All clubs', label: 'All clubs' },
    ...approachClubsUsed.map((c) => ({ value: c, label: c })),
  ];

  const driverShots = shots.filter((s) => s.shotType === 'driver');
  const approachShots = shots.filter((s) => s.shotType === 'approach');

  const drivePins: TargetPin[] = driverShots
    .filter(
      (s) =>
        driveClubFilter === 'all' ||
        holeByNumber.get(s.holeNumber)?.driveClub === driveClubFilter,
    )
    .map((s) => ({ xNorm: s.xNorm, yNorm: s.yNorm, key: s.id }));
  const approachPins: TargetPin[] = approachShots
    .filter(
      (s) =>
        approachClubFilter === 'all' ||
        holeByNumber.get(s.holeNumber)?.approachClub === approachClubFilter,
    )
    .map((s) => ({ xNorm: s.xNorm, yNorm: s.yNorm, key: s.id }));

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.owner}>
            <View style={styles.ownerText}>
              <ThemedText style={styles.ownerName} numberOfLines={1}>
                {ownerName}
              </ThemedText>
              {ownerHandle ? (
                <ThemedText type="muted" style={styles.ownerHandle} numberOfLines={1}>
                  {ownerHandle}
                </ThemedText>
              ) : null}
            </View>
            <ModerationMenu
              user={detail.owner}
              round={{ ownerId: detail.ownerId, roundId: detail.id }}
              onBlocked={() => router.back()}
            />
          </View>
          <ThemedText type="caption">{formatDate(detail.datePlayed)}</ThemedText>
          <ThemedText type="title">{detail.courseName}</ThemedText>
        </View>

        <SketchSurface seed="friend-score" style={styles.scoreCard}>
          <View style={styles.scoreCol}>
            <ThemedText type="caption">SCORE</ThemedText>
            <ThemedText style={styles.bigScore}>
              {summary.holesPlayed > 0 ? summary.totalScore : '—'}
            </ThemedText>
          </View>
          <View style={styles.scoreDivider} />
          <View style={styles.scoreCol}>
            <ThemedText type="caption">TO PAR</ThemedText>
            <ThemedText style={styles.bigScore}>{toPar == null ? '—' : formatToPar(toPar)}</ThemedText>
          </View>
        </SketchSurface>

        <View style={styles.statRow}>
          <StatTile label="GIR" value={formatPct(summary.girPct)} />
          <StatTile label="FIR" value={formatPct(summary.firPct)} />
          <StatTile label="U&D" value={formatPct(summary.udPct)} />
          <StatTile
            label="Putts"
            value={summary.totalPutts > 0 ? String(summary.totalPutts) : '—'}
          />
        </View>

        <View style={styles.likeRow}>
          <Pressable onPress={onToggleLike} style={({ pressed }) => pressed && styles.pressed}>
            <IconSymbol
              name={detail.likedByMe ? 'hand.thumbsup.fill' : 'hand.thumbsup'}
              size={22}
              color={detail.likedByMe ? colors.accent : colors.textMuted}
            />
          </Pressable>
          <Pressable
            onPress={() => router.push(`/community/likes/${ownerId}/${roundId}` as any)}
            accessibilityLabel="See who liked this round"
            style={({ pressed }) => pressed && styles.pressed}>
            <ThemedText style={styles.likeLabel}>
              {detail.likeCount} {detail.likeCount === 1 ? 'like' : 'likes'}
            </ThemedText>
          </Pressable>
        </View>

        <Section title="Scorecard">
          <Scorecard holes={holes} />
        </Section>

        <Section title="Scoring by par">
          <View style={styles.statRow}>
            <StatTile label="Par 3" value={formatAvg(perPar.par3)} />
            <StatTile label="Par 4" value={formatAvg(perPar.par4)} />
            <StatTile label="Par 5" value={formatAvg(perPar.par5)} />
          </View>
        </Section>

        <Section title="Score distribution">
          <ScoreDistributionBars distribution={distribution} />
        </Section>

        {driverShots.length > 0 ? (
          <Section title="Drive dispersion">
            <DropdownSelect
              seed="friend-drive-club"
              options={driveClubOptions}
              value={driveClubFilter}
              onChange={setDriveClubFilter}
              block
            />
            <View style={styles.targetWrap}>
              <DriverTarget pins={drivePins} width={260} height={390} />
            </View>
          </Section>
        ) : null}

        {approachShots.length > 0 ? (
          <Section title="Approach dispersion">
            <DropdownSelect
              seed="friend-club"
              options={approachClubOptions}
              value={approachClubFilter}
              onChange={setApproachClubFilter}
              block
            />
            <View style={styles.targetWrap}>
              <ApproachTarget pins={approachPins} size={290} />
            </View>
          </Section>
        ) : null}

        {putts.length > 0 ? (
          <Section title="Putting">
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
          </Section>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function formatAvg(value: number | null): string {
  return value != null ? value.toFixed(1) : '—';
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
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

const makeStyles = (colors: Palette, fonts: FontSet) =>
  StyleSheet.create({
    content: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      gap: spacing.lg,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    header: {
      gap: spacing.xs,
    },
    owner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    ownerText: {
      flex: 1,
    },
    ownerName: {
      fontFamily: fonts.serifBold,
      fontSize: 17,
      lineHeight: 23,
      color: colors.textPrimary,
    },
    ownerHandle: {
      fontSize: 12,
    },
    scoreCard: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
    },
    scoreCol: {
      flex: 1,
      alignItems: 'center',
      gap: 4,
    },
    scoreDivider: {
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
    statRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    likeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    likeLabel: {
      fontFamily: fonts.serif,
      fontSize: 16,
      lineHeight: 22,
      color: colors.textSecondary,
    },
    pressed: {
      opacity: 0.6,
    },
    targetWrap: {
      alignItems: 'center',
      paddingVertical: spacing.sm,
    },
  });
