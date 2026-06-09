import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { EdgeSwipeOpener } from '@/components/edge-swipe-opener';
import { MyRoundsView } from '@/components/my-rounds-view';
import { ProgressView } from '@/components/progress-view';
import { Screen } from '@/components/screen';
import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { spacing, type FontSet, type Palette } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';
import { useSync } from '@/lib/sync/provider';

type Tab = 'progress' | 'rounds';

const TABS = [
  { value: 'progress' as const, label: 'Progress' },
  { value: 'rounds' as const, label: 'My Rounds' },
];

export default function ProfileScreen() {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const { session } = useSync();
  const user = session?.user;
  const [tab, setTab] = useState<Tab>('progress');

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();

  // The identity block + segmented toggle scroll with the page, so they're passed
  // into the active view to render at the top of its own scroll container (no
  // horizontal padding here — each view's content container already provides it).
  const header = (
    <View style={styles.header}>
      <View style={styles.identity}>
        <Avatar avatar={user?.avatar} size={64} seed="profile-avatar" />
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

      <SegmentedControl seed="profile-tabs" options={TABS} value={tab} onChange={setTab} />
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
      fontSize: 22,
      lineHeight: 30,
      color: colors.textPrimary,
    },
    handle: {
      fontSize: 14,
      lineHeight: 20,
    },
  });
