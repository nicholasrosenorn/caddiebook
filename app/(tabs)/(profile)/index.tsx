import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { EdgeSwipeOpener } from '@/components/edge-swipe-opener';
import { FiguresRow } from '@/components/figures-row';
import { MyRoundsView } from '@/components/my-rounds-view';
import { ProgressView } from '@/components/progress-view';
import { Screen } from '@/components/screen';
import { SetupCoachmark } from '@/components/setup-coachmark';
import { TextTabs } from '@/components/text-tabs';
import { ThemedText } from '@/components/themed-text';
import { spacing, type FontSet, type Palette } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';
import type { Hole } from '@/lib/data/models';
import { useAuth } from '@/lib/auth/provider';
import { useSetupTooltip } from '@/lib/data/settings';
import { useStatsBundle } from '@/lib/data/stats';
import {
  deriveRound,
  formatHandicapIndex,
  handicapHistoryFor,
  type RoundDerived,
} from '@/lib/lifetime-stats';

type Tab = 'progress' | 'rounds';

const TABS = [
  { value: 'progress' as const, label: 'Progress' },
  { value: 'rounds' as const, label: 'My Rounds' },
];

type MastheadFigures = {
  /** Current WHS-lite index over the full history (never filtered). */
  handicapIndex: number | null;
  roundCount: number;
  /** Per-18 normalized scoring average, so 9s and 18s share one number. */
  avgPer18: number | null;
};

// The masthead's lifetime figures, derived from the shared stats bundle (the
// same cached query ProgressView reads, so there's exactly one fetch).
function useMastheadFigures(): MastheadFigures | null {
  const { data } = useStatsBundle();

  return useMemo(() => {
    if (!data) return null;
    const completed = data.rounds.filter((r) => r.completedAt != null);
    const holesByRound = new Map<string, Hole[]>();
    for (const h of data.holes) {
      const arr = holesByRound.get(h.roundId);
      if (arr) arr.push(h);
      else holesByRound.set(h.roundId, [h]);
    }
    const derived = completed
      .map((r) => deriveRound(r, holesByRound.get(r.id) ?? []))
      .filter((d): d is RoundDerived => d != null);
    const avgPer18 =
      derived.length > 0
        ? derived.reduce((s, d) => s + (d.totalScore / d.holesPlayed) * 18, 0) / derived.length
        : null;
    return {
      handicapIndex: handicapHistoryFor(completed, holesByRound).current,
      roundCount: completed.length,
      avgPer18,
    };
  }, [data]);
}

export default function ProfileScreen() {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const { session } = useAuth();
  const user = session?.user;
  const [tab, setTab] = useState<Tab>('progress');
  const figures = useMastheadFigures();
  const tooltip = useSetupTooltip();

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();

  // The locker-plate masthead: name lockup, lifetime figures over a rule, then
  // the view toggle as text tabs. It scrolls with the page, so it's passed into
  // the active view to render at the top of its own scroll container (no
  // horizontal padding here — each view's content container already provides it).
  const header = (
    <View style={styles.header}>
      <View style={styles.identity}>
        <View style={styles.identityText}>
          <ThemedText style={styles.name} numberOfLines={1}>
            {fullName || 'Golfer'}
          </ThemedText>
          {user?.username ? (
            <ThemedText type="muted" style={styles.handle} numberOfLines={1}>
              @{user.username}
            </ThemedText>
          ) : null}
        </View>
      </View>

      <FiguresRow
        size="lg"
        rule={false}
        figures={[
          {
            label: 'Handicap',
            value:
              figures?.handicapIndex != null
                ? formatHandicapIndex(figures.handicapIndex)
                : '—',
          },
          { label: 'Rounds', value: figures ? String(figures.roundCount) : '—' },
          {
            label: 'Avg /18',
            value: figures?.avgPer18 != null ? figures.avgPer18.toFixed(1) : '—',
          },
        ]}
      />

      <TextTabs seed="profile-tabs" options={TABS} value={tab} onChange={setTab} />
    </View>
  );

  // Both views stay mounted; we toggle visibility instead of swapping them so
  // switching segments is instant and never re-reads the DB or flashes a blank
  // loading state. Only the visible view renders the shared header.
  return (
    <Screen padded={false} marks>
      <View style={[styles.fill, tab !== 'progress' && styles.hidden]}>
        <ProgressView header={tab === 'progress' ? header : undefined} />
      </View>
      <View style={[styles.fill, tab !== 'rounds' && styles.hidden]}>
        <MyRoundsView header={tab === 'rounds' ? header : undefined} />
      </View>
      {tooltip.show ? <SetupCoachmark onDismiss={tooltip.dismiss} /> : null}
      <EdgeSwipeOpener />
    </Screen>
  );
}

const makeStyles = (colors: Palette, fonts: FontSet) =>
  StyleSheet.create({
    fill: {
      flex: 1,
    },
    hidden: {
      display: 'none',
    },
    header: {
      paddingTop: spacing.xs,
      gap: spacing.md,
      marginBottom: spacing.sm,
    },
    identity: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    identityText: {
      flex: 1,
      gap: 2,
    },
    name: {
      fontFamily: fonts.serifBold,
      fontSize: 33,
      lineHeight: 40,
      letterSpacing: -0.4,
      color: colors.textPrimary,
    },
    handle: {
      fontSize: 14,
      lineHeight: 20,
    },
  });
