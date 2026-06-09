import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ApproachTarget } from '@/components/approach-target';
import { DriverTarget, type TargetPin } from '@/components/driver-target';
import { Scorecard } from '@/components/scorecard';
import { Screen } from '@/components/screen';
import { SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { spacing, type Palette, type FontSet } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';
import { getFriendRound, likeRound, unlikeRound } from '@/lib/api/client';
import { wireHoleToHole, wireShotToShot } from '@/lib/community/map';
import type { FriendRoundDetail } from '@/lib/sync/wire';
import { computeRoundSummary, formatPct, totalPar } from '@/lib/stats';

export default function FriendRoundScreen() {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const { ownerId, roundId } = useLocalSearchParams<{ ownerId: string; roundId: string }>();
  const [detail, setDetail] = useState<FriendRoundDetail | null>(null);
  const [error, setError] = useState(false);

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
  const summary = computeRoundSummary(holes);
  const parPlayed = totalPar(holes);
  const toPar = summary.holesPlayed > 0 ? summary.totalScore - parPlayed : null;
  const ownerName = detail.owner.username
    ? `@${detail.owner.username}`
    : detail.owner.firstName ?? 'A friend';

  const drivePins: TargetPin[] = shots
    .filter((s) => s.shotType === 'driver')
    .map((s) => ({ xNorm: s.xNorm, yNorm: s.yNorm, key: s.id }));
  const approachPins: TargetPin[] = shots
    .filter((s) => s.shotType === 'approach')
    .map((s) => ({ xNorm: s.xNorm, yNorm: s.yNorm, key: s.id }));

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.owner}>
            <IconSymbol
              name={(detail.owner.avatar as IconSymbolName) ?? 'person.crop.circle'}
              size={26}
              color={colors.accent}
            />
            <ThemedText style={styles.ownerName}>{ownerName}</ThemedText>
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
          <View style={styles.scoreDivider} />
          <View style={styles.scoreCol}>
            <ThemedText type="caption">HOLES</ThemedText>
            <ThemedText style={styles.bigScore}>
              {summary.holesPlayed}
              <ThemedText style={styles.bigScoreSuffix}>/{detail.holeCount}</ThemedText>
            </ThemedText>
          </View>
        </SketchSurface>

        <View style={styles.statRow}>
          <StatTile label="GIR" value={formatPct(summary.girPct)} colors={colors} styles={styles} />
          <StatTile label="FIR" value={formatPct(summary.firPct)} colors={colors} styles={styles} />
          <StatTile label="U&D" value={formatPct(summary.udPct)} colors={colors} styles={styles} />
          <StatTile
            label="Putts"
            value={summary.totalPutts > 0 ? String(summary.totalPutts) : '—'}
            colors={colors}
            styles={styles}
          />
        </View>

        <View style={styles.likeRow}>
          <Pressable onPress={onToggleLike} style={({ pressed }) => pressed && styles.pressed}>
            <IconSymbol
              name={detail.likedByMe ? 'heart.fill' : 'heart'}
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

        <Section title="Scorecard" styles={styles}>
          <Scorecard holes={holes} />
        </Section>

        {drivePins.length > 0 ? (
          <Section title="Drive dispersion" styles={styles}>
            <View style={styles.targetWrap}>
              <DriverTarget pins={drivePins} width={233} height={350} />
            </View>
          </Section>
        ) : null}

        {approachPins.length > 0 ? (
          <Section title="Approach dispersion" styles={styles}>
            <View style={styles.targetWrap}>
              <ApproachTarget pins={approachPins} size={240} />
            </View>
          </Section>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function Section({
  title,
  children,
  styles,
}: {
  title: string;
  children: React.ReactNode;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.section}>
      <ThemedText type="subtitle">{title}</ThemedText>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function StatTile({
  label,
  value,
  styles,
}: {
  label: string;
  value: string;
  colors: Palette;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <SketchSurface seed={`friend-stat-${label}`} style={styles.statTile}>
      <ThemedText type="caption" numberOfLines={1}>
        {label.toUpperCase()}
      </ThemedText>
      <ThemedText style={styles.statTileValue} numberOfLines={1}>
        {value}
      </ThemedText>
    </SketchSurface>
  );
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
    ownerName: {
      fontFamily: fonts.serif,
      fontSize: 15,
      color: colors.textSecondary,
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
    bigScoreSuffix: {
      fontFamily: fonts.serif,
      fontSize: 18,
      lineHeight: 24,
      color: colors.textSecondary,
    },
    statRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    statTile: {
      flex: 1,
      minWidth: 0,
      minHeight: 64,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      gap: 4,
      alignItems: 'center',
    },
    statTileValue: {
      fontFamily: fonts.serifBold,
      fontSize: 20,
      lineHeight: 27,
      color: colors.textPrimary,
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
    section: {
      gap: spacing.md,
    },
    sectionBody: {
      gap: spacing.sm,
    },
    targetWrap: {
      alignItems: 'center',
      paddingVertical: spacing.sm,
    },
  });
