import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, DevSettings, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Screen } from '@/components/screen';
import { SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { spacing, THEME_ORDER, themes, type FontSet, type Palette, type ThemeId } from '@/constants/theme';
import { useColors, useFontSet, useTheme } from '@/constants/theme-context';
import { listFriends } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/provider';
import { clearAllRounds, seedSampleRounds } from '@/lib/dev-seed';
import { drainNow, subscribeOutbox } from '@/lib/data/outbox';
import { queryClient } from '@/lib/data/query-client';
import { setPref } from '@/lib/local/prefs';

export default function SettingsScreen() {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const { themeId, setTheme } = useTheme();
  const { session, signOut } = useAuth();
  const [devBusy, setDevBusy] = useState(false);
  const [pendingWrites, setPendingWrites] = useState(0);
  const [friendCount, setFriendCount] = useState<number | null>(null);

  // Live count of queued (not yet delivered) writes, for the dev section.
  useEffect(() => subscribeOutbox(setPendingWrites), []);

  // Live friend count for the Community row; refetched on focus so removals
  // made on the Friends screen are reflected when we return here.
  useFocusEffect(
    useCallback(() => {
      if (!session) return;
      let active = true;
      listFriends()
        .then((friends) => active && setFriendCount(friends.length))
        .catch(() => active && setFriendCount(null));
      return () => {
        active = false;
      };
    }, [session]),
  );

  const user = session?.user;
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();

  const confirmSignOut = useCallback(() => {
    Alert.alert(
      'Sign out?',
      'Your rounds stay safe on the server. Any unsent changes are uploaded first when possible.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
      ],
    );
  }, [signOut]);

  const runDev = useCallback(async (fn: () => Promise<void>) => {
    setDevBusy(true);
    try {
      await fn();
    } finally {
      setDevBusy(false);
    }
  }, []);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <ThemedText type="caption">ACCOUNT</ThemedText>
          <Pressable
            onPress={() => router.push('/edit-profile')}
            accessibilityRole="button"
            accessibilityLabel="Edit profile"
            style={({ pressed }) => pressed && styles.cardPressed}>
            <SketchSurface seed="account-card" radius={12} style={styles.accountCard}>
              <Avatar avatar={user?.avatar} size={56} seed="settings-avatar" />
              <View style={styles.accountText}>
                <ThemedText style={styles.accountName}>{fullName || 'Golfer'}</ThemedText>
                {user?.username ? (
                  <ThemedText type="muted" style={styles.accountHandle}>
                    @{user.username}
                  </ThemedText>
                ) : null}
                {user?.email ? (
                  <ThemedText type="muted" style={styles.accountEmail}>
                    {user.email}
                  </ThemedText>
                ) : null}
              </View>
              <View style={styles.editAffordance}>
                <IconSymbol name="pencil" size={15} color={colors.accent} />
                <ThemedText style={styles.editLabel}>Edit</ThemedText>
              </View>
            </SketchSurface>
          </Pressable>

          <View style={styles.devBar}>
            <Pressable
              style={styles.devBtn}
              accessibilityRole="button"
              accessibilityLabel="Sign out"
              onPress={confirmSignOut}>
              <SketchSurface seed="sign-out" radius={8} style={styles.devSurface}>
                <ThemedText style={styles.devClearLabel}>Sign out</ThemedText>
              </SketchSurface>
            </Pressable>
          </View>
        </View>

        {session ? (
          <View style={styles.section}>
            <ThemedText type="caption">CLUBHOUSE</ThemedText>
            <Pressable
              onPress={() => router.push('/friends')}
              accessibilityRole="button"
              accessibilityLabel="View friends"
              style={({ pressed }) => pressed && styles.cardPressed}>
              <SketchSurface seed="friends-card" radius={12} style={styles.communityRow}>
                <IconSymbol name="person.2.fill" size={20} color={colors.accent} />
                <ThemedText style={styles.cardLabel}>Friends</ThemedText>
                {friendCount !== null ? (
                  <View style={styles.countChip}>
                    <ThemedText style={styles.countText}>{friendCount}</ThemedText>
                  </View>
                ) : null}
                <IconSymbol name="chevron.right" size={16} color={colors.textMuted} />
              </SketchSurface>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.section}>
          <ThemedText type="caption" style={styles.sectionTitle}>
            APPEARANCE
          </ThemedText>
          <View style={styles.gallery}>
          {THEME_ORDER.map((id) => (
            <ThemeCard
              key={id}
              id={id}
              selected={id === themeId}
              onSelect={() => setTheme(id)}
            />
          ))}
        </View>
        </View>

        {__DEV__ && (
          <View style={styles.devSection}>
            <ThemedText type="caption">DEVELOPER</ThemedText>

            <Pressable
              style={styles.devBtn}
              accessibilityRole="button"
              accessibilityLabel="Deliver queued writes"
              onPress={() => drainNow()}>
              <SketchSurface
                seed="sync-now"
                fill={colors.accent}
                stroke={colors.accent}
                radius={8}
                style={styles.devSurface}>
                <ThemedText style={styles.devSeedLabel}>
                  {pendingWrites > 0 ? `Deliver queued (${pendingWrites})` : 'Queue empty'}
                </ThemedText>
              </SketchSurface>
            </Pressable>

            <View style={styles.devBar}>
              <Pressable
                style={styles.devBtn}
                disabled={devBusy}
                accessibilityRole="button"
                accessibilityLabel="Seed 70 sample rounds"
                onPress={() => runDev(() => seedSampleRounds(70))}>
                <SketchSurface
                  seed="dev-seed"
                  fill={colors.accent}
                  stroke={colors.accent}
                  radius={8}
                  style={styles.devSurface}>
                  <ThemedText style={styles.devSeedLabel}>
                    {devBusy ? 'Working…' : 'Seed 70 rounds'}
                  </ThemedText>
                </SketchSurface>
              </Pressable>
              <Pressable
                style={styles.devBtn}
                disabled={devBusy}
                accessibilityRole="button"
                accessibilityLabel="Clear all rounds"
                onPress={() => runDev(clearAllRounds)}>
                <SketchSurface seed="dev-clear" radius={8} style={styles.devSurface}>
                  <ThemedText style={styles.devClearLabel}>Clear all</ThemedText>
                </SketchSurface>
              </Pressable>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Refetch all data from the server"
              disabled={devBusy}
              onPress={() => runDev(async () => queryClient.invalidateQueries())}
              style={({ pressed }) => pressed && styles.cardPressed}>
              <SketchSurface seed="dev-repull" radius={12} style={styles.devRow}>
                <ThemedText style={styles.cardLabel}>Refetch all</ThemedText>
                <ThemedText type="muted" style={styles.cardHint}>
                  Marks every cached query stale and refetches server truth
                </ThemedText>
              </SketchSurface>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Replay intro"
              onPress={async () => {
                // Clear the one-time flag, then reload so the root layout
                // re-reads it and shows the intro again.
                await setPref('intro_seen', '0');
                DevSettings.reload();
              }}
              style={({ pressed }) => pressed && styles.cardPressed}>
              <SketchSurface seed="dev-replay-intro" radius={12} style={styles.devRow}>
                <ThemedText style={styles.cardLabel}>Replay intro</ThemedText>
                <ThemedText type="muted" style={styles.cardHint}>
                  Resets the first-launch flag and reloads
                </ThemedText>
              </SketchSurface>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function ThemeCard({
  id,
  selected,
  onSelect,
}: {
  id: ThemeId;
  selected: boolean;
  onSelect: () => void;
}) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const { label, hint, palette, fonts: themeFonts } = themes[id];

  return (
    <Pressable
      onPress={onSelect}
      accessibilityRole="button"
      accessibilityLabel={`${label} theme`}
      accessibilityState={{ selected }}
      style={({ pressed }) => pressed && styles.cardPressed}>
      <SketchSurface
        seed={`theme-${id}`}
        radius={12}
        stroke={selected ? colors.accent : colors.borderStrong}
        strokeWidth={selected ? 2 : 1.3}
        style={styles.card}>
        {/* Swatch shows the preset's own ink-on-paper pairing */}
        <View style={[styles.swatch, { backgroundColor: palette.background, borderColor: palette.borderStrong }]}>
          <View style={[styles.swatchInk, { backgroundColor: palette.accent }]} />
          <View style={[styles.swatchLine, { backgroundColor: palette.accent }]} />
          <View style={[styles.swatchLineShort, { backgroundColor: palette.borderStrong }]} />
        </View>

        <View style={styles.cardText}>
          <ThemedText style={[styles.cardLabel, { fontFamily: themeFonts.serifBold }]}>
            {label}
          </ThemedText>
          <ThemedText type="muted" style={styles.cardHint}>
            {hint}
          </ThemedText>
        </View>

        {selected ? (
          <IconSymbol name="checkmark" size={20} color={colors.accent} />
        ) : (
          <View style={styles.checkPlaceholder} />
        )}
      </SketchSurface>
    </Pressable>
  );
}

const makeStyles = (colors: Palette, fonts: FontSet) =>
  StyleSheet.create({
    content: {
      paddingVertical: spacing.md,
      gap: spacing.lg,
    },
    section: {
      gap: 2,
    },
    sectionTitle: {
      marginBottom: spacing.xs,
    },
    accountCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      marginTop: spacing.xs,
      marginBottom: spacing.sm,
    },
    accountText: {
      flex: 1,
      gap: 1,
    },
    accountName: {
      fontFamily: fonts.serifBold,
      fontSize: 19,
      lineHeight: 26,
      color: colors.textPrimary,
    },
    accountHandle: {
      fontSize: 14,
    },
    accountEmail: {
      fontSize: 12,
      color: colors.textMuted,
    },
    editAffordance: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    editLabel: {
      fontFamily: fonts.serif,
      fontSize: 14,
      color: colors.accent,
    },
    sectionHint: {
      fontSize: 13,
      marginTop: 2,
    },
    communityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      marginTop: spacing.xs,
      minHeight: 60,
    },
    countChip: {
      marginLeft: 'auto',
      minWidth: 24,
      height: 24,
      borderRadius: 12,
      paddingHorizontal: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accentMuted,
    },
    countText: {
      fontFamily: fonts.serifBold,
      fontSize: 14,
      color: colors.accent,
    },
    syncError: {
      fontSize: 13,
      marginTop: 2,
      color: colors.textSecondary,
      fontFamily: fonts.serif,
    },
    gallery: {
      gap: spacing.sm,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      minHeight: 76,
    },
    cardPressed: {
      opacity: 0.6,
    },
    swatch: {
      width: 52,
      height: 52,
      borderRadius: 8,
      borderWidth: 1,
      padding: 8,
      justifyContent: 'center',
      gap: 4,
      overflow: 'hidden',
    },
    swatchInk: {
      position: 'absolute',
      top: 7,
      right: 7,
      width: 14,
      height: 14,
      borderRadius: 7,
    },
    swatchLine: {
      height: 4,
      width: '70%',
      borderRadius: 2,
    },
    swatchLineShort: {
      height: 4,
      width: '45%',
      borderRadius: 2,
    },
    cardText: {
      flex: 1,
      gap: 2,
    },
    cardLabel: {
      fontFamily: fonts.serif,
      fontSize: 18,
      lineHeight: 24,
      color: colors.textPrimary,
    },
    cardHint: {
      fontSize: 13,
    },
    checkPlaceholder: {
      width: 20,
      height: 20,
    },
    devSection: {
      gap: spacing.sm,
    },
    devRow: {
      gap: 2,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      minHeight: 60,
      justifyContent: 'center',
    },
    devBar: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    devBtn: {
      flex: 1,
    },
    devSurface: {
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.sm,
    },
    devSeedLabel: {
      fontFamily: fonts.serif,
      fontSize: 14,
      color: colors.accentOn,
    },
    devClearLabel: {
      fontFamily: fonts.serif,
      fontSize: 14,
      color: colors.textSecondary,
    },
  });
