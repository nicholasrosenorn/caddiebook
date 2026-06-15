import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, DevSettings, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { ListGroup, ListRow } from '@/components/list-group';
import { Screen } from '@/components/screen';
import { SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { spacing, THEME_ORDER, themes, type FontSet, type Palette, type ThemeId } from '@/constants/theme';
import { useColors, useFontSet, useTheme } from '@/constants/theme-context';
import { listFriends } from '@/lib/api/client';
import { EULA_URL, SUPPORT_EMAIL, TERMS_URL } from '@/lib/legal';
import { useAuth } from '@/lib/auth/provider';
import { clearAllRounds, seedSampleRounds } from '@/lib/dev-seed';
import { drainNow, subscribeOutbox } from '@/lib/data/outbox';
import { queryClient } from '@/lib/data/query-client';
import { useResetSetupNudge } from '@/lib/data/settings';
import { setPref } from '@/lib/local/prefs';
import { requestStoreReview, STORE_REVIEW_REQUESTED_KEY } from '@/lib/review-prompt';
import { TOUR_NUDGE_DISMISSED_KEY, TOUR_SEEN_KEY } from '@/lib/tour';

export default function SettingsScreen() {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const { themeId, setTheme } = useTheme();
  const { session, signOut } = useAuth();
  const [devBusy, setDevBusy] = useState(false);
  const [pendingWrites, setPendingWrites] = useState(0);
  const [friendCount, setFriendCount] = useState<number | null>(null);
  const resetSetupNudge = useResetSetupNudge();

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
          <ThemedText type="caption" style={styles.sectionTitle}>
            ACCOUNT
          </ThemedText>
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
            <ThemedText type="caption" style={styles.sectionTitle}>
              CLUBHOUSE
            </ThemedText>
            <ListGroup seed="clubhouse-group">
              <ListRow
                icon="person.2.fill"
                label="Friends"
                onPress={() => router.push('/friends')}
                right={
                  <View style={styles.trailing}>
                    {friendCount !== null ? (
                      <ThemedText type="muted" style={styles.trailingValue}>
                        {friendCount}
                      </ThemedText>
                    ) : null}
                    <IconSymbol name="chevron.right" size={16} color={colors.textMuted} />
                  </View>
                }
              />
              <ListRow
                icon="hand.raised"
                label="Blocked"
                onPress={() => router.push('/blocked-users' as any)}
              />
            </ListGroup>
          </View>
        ) : null}

        <View style={styles.section}>
          <ThemedText type="caption" style={styles.sectionTitle}>
            APPEARANCE
          </ThemedText>
          <ListGroup seed="appearance-group">
            {THEME_ORDER.map((id) => (
              <ThemeRow
                key={id}
                id={id}
                selected={id === themeId}
                onSelect={() => setTheme(id)}
              />
            ))}
          </ListGroup>
        </View>

        <View style={styles.section}>
          <ThemedText type="caption" style={styles.sectionTitle}>
            ABOUT &amp; SAFETY
          </ThemedText>
          <ListGroup seed="about-group">
            <ListRow
              icon="star.fill"
              label="Review Caddie Book"
              onPress={() => void requestStoreReview()}
            />
            <ListRow
              icon="envelope"
              label="Contact us"
              onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
            />
            <ListRow
              icon="checkmark.shield"
              label="Community Guidelines"
              onPress={() => Linking.openURL(EULA_URL)}
            />
            <ListRow
              icon="doc.text"
              label="Terms of Service"
              onPress={() => Linking.openURL(TERMS_URL)}
            />
          </ListGroup>
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

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Replay tour"
              onPress={async () => {
                // Re-arm the tour's seen flag, the sparse-data nudge, and the
                // one-shot review prompt, then open it immediately.
                await Promise.all([
                  setPref(TOUR_SEEN_KEY, '0'),
                  setPref(TOUR_NUDGE_DISMISSED_KEY, '0'),
                  setPref(STORE_REVIEW_REQUESTED_KEY, '0'),
                ]);
                router.push('/tour');
              }}
              style={({ pressed }) => pressed && styles.cardPressed}>
              <SketchSurface seed="dev-replay-tour" radius={12} style={styles.devRow}>
                <ThemedText style={styles.cardLabel}>Replay tour</ThemedText>
                <ThemedText type="muted" style={styles.cardHint}>
                  Re-arms the tour, nudge &amp; review flags, then opens it
                </ThemedText>
              </SketchSurface>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reset setup nudge"
              disabled={devBusy}
              onPress={() =>
                runDev(async () => {
                  await resetSetupNudge();
                  Alert.alert(
                    'Setup nudge reset',
                    'Cleared your bag, yardages and the seen flags. The menu dot and first-login tip will show again — visit the yardages tool to clear them.',
                  );
                })
              }
              style={({ pressed }) => pressed && styles.cardPressed}>
              <SketchSurface seed="dev-reset-nudge" radius={12} style={styles.devRow}>
                <ThemedText style={styles.cardLabel}>Reset setup nudge</ThemedText>
                <ThemedText type="muted" style={styles.cardHint}>
                  Clears bag, yardages &amp; seen flags so the dot + tooltip return
                </ThemedText>
              </SketchSurface>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function ThemeRow({
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
      style={({ pressed }) => pressed && styles.rowPressed}>
      <View style={styles.themeRow}>
        {/* Swatch shows the preset's own ink-on-paper pairing */}
        <View style={[styles.swatch, { backgroundColor: palette.background, borderColor: palette.borderStrong }]}>
          <View style={[styles.swatchInk, { backgroundColor: palette.accent }]} />
          <View style={[styles.swatchLine, { backgroundColor: palette.accent }]} />
        </View>

        <View style={styles.themeText}>
          <ThemedText style={[styles.themeLabel, { fontFamily: themeFonts.serifBold }]}>
            {label}
          </ThemedText>
          <ThemedText type="muted" style={styles.cardHint} numberOfLines={1}>
            {hint}
          </ThemedText>
        </View>

        {selected ? <IconSymbol name="checkmark" size={16} color={colors.accent} /> : null}
      </View>
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
    trailing: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    trailingValue: {
      fontFamily: fonts.serif,
      fontSize: 16,
    },
    syncError: {
      fontSize: 13,
      marginTop: 2,
      color: colors.textSecondary,
      fontFamily: fonts.serif,
    },
    cardPressed: {
      opacity: 0.6,
    },
    rowPressed: {
      opacity: 0.55,
    },
    themeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minHeight: 50,
      paddingVertical: spacing.sm,
    },
    swatch: {
      width: 30,
      height: 30,
      borderRadius: 6,
      borderWidth: 1,
      padding: 5,
      justifyContent: 'flex-end',
      overflow: 'hidden',
    },
    swatchInk: {
      position: 'absolute',
      top: 5,
      right: 5,
      width: 9,
      height: 9,
      borderRadius: 4.5,
    },
    swatchLine: {
      height: 3,
      width: '70%',
      borderRadius: 1.5,
    },
    themeText: {
      flex: 1,
      gap: 1,
    },
    themeLabel: {
      fontFamily: fonts.serif,
      fontSize: 16,
      lineHeight: 22,
      color: colors.textPrimary,
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
