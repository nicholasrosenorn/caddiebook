import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Screen } from '@/components/screen';
import { SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { spacing, type Palette, type FontSet } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';
import { useDeleteRound, useRoundFull, useUpdateRound } from '@/lib/data/rounds';

export default function RoundSettingsScreen() {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const { id, inRound } = useLocalSearchParams<{ id: string; inRound?: string }>();
  const insets = useSafeAreaInsets();
  const [ratingText, setRatingText] = useState('');
  const [slopeText, setSlopeText] = useState('');

  const { data } = useRoundFull(id);
  const round = data?.round ?? null;
  const updateRound = useUpdateRound();
  const deleteRound = useDeleteRound();

  useEffect(() => {
    setRatingText(round?.courseRating != null ? String(round.courseRating) : '');
    setSlopeText(round?.slopeRating != null ? String(round.slopeRating) : '');
  }, [round?.courseRating, round?.slopeRating]);

  if (!id || !round) return <Screen />;

  const onClose = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/' as any);
  };

  // Each write patches the cached round optimistically, so the toggles flip on
  // the same frame and the command queues for the server.
  const onToggleHandicap = async () => {
    await updateRound(round.id, { includeInHandicap: !round.includeInHandicap });
  };

  const onToggleShare = async () => {
    // The toggle reads as "share with friends", so ON = NOT excluded.
    await updateRound(round.id, { excludeFromSharing: !round.excludeFromSharing });
  };

  const onCommitRatingSlope = async () => {
    const rating = parseNum(ratingText);
    const slope = parseNum(slopeText);
    if (rating === round.courseRating && slope === round.slopeRating) return;
    await updateRound(round.id, { courseRating: rating, slopeRating: slope });
  };

  const onDelete = () => {
    Alert.alert('Delete round?', `${round.courseName} will be permanently deleted.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteRound(round.id);
          // The round screen beneath is stale too — pop the whole round stack
          // back to wherever the user opened it from.
          if (router.canGoBack()) router.dismissAll();
          else router.replace('/' as any);
        },
      },
    ]);
  };

  const shared = !round.excludeFromSharing;

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
          <ThemedText type="caption">ROUND SETTINGS</ThemedText>
          <ThemedText type="title">{round.courseName}</ThemedText>
          {round.datePlayed ? (
            <ThemedText type="muted">{formatDate(round.datePlayed)}</ThemedText>
          ) : null}
        </View>

        {/* Hidden when reached from the in-round menu — you're already editing. */}
        {!inRound ? (
          <Pressable
            onPress={() => router.replace(`/round/${round.id}` as any)}
            accessibilityRole="button"
            accessibilityLabel="Edit round"
            style={({ pressed }) => [styles.editCtaWrap, pressed && styles.pressed]}>
            <SketchSurface
              seed="settings-edit"
              fill={colors.surface}
              stroke={colors.borderStrong}
              style={styles.editCta}>
              <IconSymbol name="pencil" size={16} color={colors.accent} />
              <ThemedText style={styles.editCtaLabel}>Edit round</ThemedText>
            </SketchSurface>
          </Pressable>
        ) : null}

        <SketchSurface seed="settings-hcp-toggle" style={styles.card}>
          <Pressable
            onPress={onToggleHandicap}
            accessibilityRole="switch"
            accessibilityState={{ checked: round.includeInHandicap }}
            style={styles.toggleRow}>
            <View style={styles.toggleText}>
              <ThemedText type="caption">INCLUDE IN HANDICAP</ThemedText>
              <ThemedText style={styles.toggleHint}>
                {round.includeInHandicap
                  ? 'This round counts toward your index.'
                  : 'Excluded — posts no differential.'}
              </ThemedText>
            </View>
            <Toggle on={round.includeInHandicap} seed="settings-hcp-switch" colors={colors} styles={styles} />
          </Pressable>

          {round.includeInHandicap ? (
            <View style={styles.ratingRow}>
              <View style={styles.ratingCol}>
                <ThemedText style={styles.subLabel}>COURSE RATING</ThemedText>
                <SketchSurface seed="settings-rating" radius={8} style={styles.inputSurface}>
                  <TextInput
                    value={ratingText}
                    onChangeText={setRatingText}
                    onBlur={onCommitRatingSlope}
                    placeholder="72.1"
                    placeholderTextColor={colors.textMuted}
                    style={styles.input}
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                  />
                </SketchSurface>
              </View>
              <View style={styles.ratingCol}>
                <ThemedText style={styles.subLabel}>SLOPE</ThemedText>
                <SketchSurface seed="settings-slope" radius={8} style={styles.inputSurface}>
                  <TextInput
                    value={slopeText}
                    onChangeText={setSlopeText}
                    onBlur={onCommitRatingSlope}
                    placeholder="113"
                    placeholderTextColor={colors.textMuted}
                    style={styles.input}
                    keyboardType="number-pad"
                    returnKeyType="done"
                  />
                </SketchSurface>
              </View>
            </View>
          ) : null}
        </SketchSurface>

        <SketchSurface seed="settings-share-toggle" style={styles.card}>
          <Pressable
            onPress={onToggleShare}
            accessibilityRole="switch"
            accessibilityState={{ checked: shared }}
            style={styles.toggleRow}>
            <View style={styles.toggleText}>
              <ThemedText type="caption">SHARE WITH FRIENDS</ThemedText>
              <ThemedText style={styles.toggleHint}>
                {shared
                  ? "Visible in your friends' Community feed."
                  : 'Hidden from the Community feed.'}
              </ThemedText>
            </View>
            <Toggle on={shared} seed="settings-share-switch" colors={colors} styles={styles} />
          </Pressable>
        </SketchSurface>

        <Pressable
          onPress={onDelete}
          accessibilityRole="button"
          accessibilityLabel="Delete round"
          style={({ pressed }) => [styles.deleteRow, pressed && styles.pressed]}>
          <IconSymbol name="trash" size={18} color={colors.danger} />
          <ThemedText style={styles.deleteLabel}>Delete round</ThemedText>
        </Pressable>
      </ScrollView>

      <Pressable
        onPress={onClose}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Close settings"
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

function Toggle({
  on,
  seed,
  colors,
  styles,
}: {
  on: boolean;
  seed: string;
  colors: Palette;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <SketchSurface
      seed={seed}
      radius={999}
      fill={on ? colors.accent : colors.surface}
      stroke={on ? colors.accent : colors.borderStrong}
      grain={on}
      style={[styles.toggleTrack, on ? styles.toggleTrackOn : styles.toggleTrackOff]}>
      <View
        style={[
          styles.toggleKnob,
          { backgroundColor: on ? colors.accentOn : colors.borderStrong },
        ]}
      />
    </SketchSurface>
  );
}

function parseNum(value: string): number | null {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

function formatDate(iso: string): string {
  const parts = iso.split('-').map((s) => parseInt(s, 10));
  if (parts.length !== 3 || parts.some(Number.isNaN)) return iso;
  const [y, m, d] = parts;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
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
    editCtaWrap: {
      minHeight: 48,
    },
    editCta: {
      flexDirection: 'row',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 48,
    },
    editCtaLabel: {
      color: colors.accent,
      fontFamily: fonts.serif,
      fontSize: 16,
      lineHeight: 22,
    },
    card: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      gap: spacing.md,
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    toggleText: {
      flex: 1,
      gap: 4,
    },
    toggleHint: {
      fontSize: 13,
      color: colors.textMuted,
    },
    toggleTrack: {
      width: 52,
      height: 30,
      justifyContent: 'center',
    },
    toggleTrackOn: {
      alignItems: 'flex-end',
    },
    toggleTrackOff: {
      alignItems: 'flex-start',
    },
    toggleKnob: {
      width: 22,
      height: 22,
      borderRadius: 11,
      marginHorizontal: 3,
    },
    ratingRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    ratingCol: {
      flex: 1,
      gap: spacing.xs,
    },
    subLabel: {
      fontSize: 11,
      letterSpacing: 0.8,
      color: colors.textMuted,
      fontFamily: fonts.body,
    },
    inputSurface: {
      minHeight: 48,
    },
    input: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      fontSize: 16,
      color: colors.textPrimary,
      minHeight: 48,
      justifyContent: 'center',
    },
    pressed: {
      opacity: 0.6,
    },
    deleteRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      marginTop: spacing.md,
    },
    deleteLabel: {
      fontFamily: fonts.serif,
      fontSize: 16,
      lineHeight: 22,
      color: colors.danger,
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
