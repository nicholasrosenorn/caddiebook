import { useMemo, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, View } from 'react-native';

import { blockUser, reportContent } from '@/lib/api/client';
import type { PublicProfile, ReportReason } from '@/lib/api/types';
import { spacing, type FontSet, type Palette } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';

import { SketchSurface } from './sketch';
import { ThemedText } from './themed-text';
import { IconSymbol, type IconSymbolName } from './ui/icon-symbol';

const REASONS: { key: ReportReason; label: string }[] = [
  { key: 'spam', label: 'Spam' },
  { key: 'harassment', label: 'Harassment or bullying' },
  { key: 'objectionable', label: 'Objectionable content' },
  { key: 'other', label: 'Something else' },
];

// The ⋯ overflow menu carrying the App Store Guideline 1.2 user-safety actions:
// report (content or user) and block. Drop it onto any surface that renders
// another user's content — feed cards, round detail, friends, search results.
export function ModerationMenu({
  user,
  round,
  onBlocked,
  color,
  size = 18,
}: {
  user: PublicProfile;
  // When present, "Report" files a round report; otherwise a user report.
  round?: { ownerId: string; roundId: string };
  onBlocked?: () => void;
  color?: string;
  size?: number;
}) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'menu' | 'report'>('menu');
  const [busy, setBusy] = useState(false);

  const handle = user.username ? `@${user.username}` : 'this user';

  const close = () => {
    setOpen(false);
    setView('menu');
  };

  const onReport = async (reason: ReportReason) => {
    if (busy) return;
    setBusy(true);
    try {
      await reportContent(
        round
          ? { targetType: 'round', targetOwnerId: round.ownerId, targetRoundId: round.roundId, reason }
          : { targetType: 'user', targetOwnerId: user.id, reason },
      );
      close();
      Alert.alert('Report received', 'Thanks — our team will review this within 24 hours.');
    } catch {
      Alert.alert('Could not send report', 'Please check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const confirmBlock = () => {
    Alert.alert(
      `Block ${handle}?`,
      'They will no longer see your rounds or profile, and you won’t see theirs. This also removes any friendship between you.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await blockUser(user.id);
              close();
              onBlocked?.();
            } catch {
              Alert.alert('Could not block', 'Please check your connection and try again.');
            }
          },
        },
      ],
    );
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="More options">
        <IconSymbol name="ellipsis" size={size} color={color ?? colors.textMuted} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
          {/* Inner press shouldn't dismiss. */}
          <Pressable style={styles.sheetWrap} onPress={() => {}}>
            <SketchSurface seed={`mod-${user.id}`} radius={16} style={styles.sheet}>
              {view === 'menu' ? (
                <>
                  <ThemedText type="caption" style={styles.title}>
                    {handle.toUpperCase()}
                  </ThemedText>
                  <Row
                    icon="flag"
                    label={round ? 'Report this round' : 'Report user'}
                    onPress={() => setView('report')}
                    styles={styles}
                    colors={colors}
                  />
                  <Row
                    icon="hand.raised"
                    label={`Block ${handle}`}
                    destructive
                    onPress={confirmBlock}
                    styles={styles}
                    colors={colors}
                  />
                  <Row icon="xmark" label="Cancel" muted onPress={close} styles={styles} colors={colors} />
                </>
              ) : (
                <>
                  <ThemedText type="caption" style={styles.title}>
                    WHY ARE YOU REPORTING THIS?
                  </ThemedText>
                  {REASONS.map((r) => (
                    <Row
                      key={r.key}
                      label={r.label}
                      onPress={() => onReport(r.key)}
                      disabled={busy}
                      styles={styles}
                      colors={colors}
                    />
                  ))}
                  <Row icon="chevron.left" label="Back" muted onPress={() => setView('menu')} styles={styles} colors={colors} />
                </>
              )}
            </SketchSurface>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function Row({
  icon,
  label,
  onPress,
  destructive,
  muted,
  disabled,
  styles,
  colors,
}: {
  icon?: IconSymbolName;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  muted?: boolean;
  disabled?: boolean;
  styles: ReturnType<typeof makeStyles>;
  colors: Palette;
}) {
  const tint = destructive ? colors.danger : muted ? colors.textMuted : colors.textPrimary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed, disabled && styles.rowDisabled]}>
      {icon ? <IconSymbol name={icon} size={18} color={tint} /> : <View style={styles.iconSpacer} />}
      <ThemedText style={[styles.rowLabel, { color: tint }]}>{label}</ThemedText>
    </Pressable>
  );
}

const makeStyles = (colors: Palette, fonts: FontSet) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: '#0006',
      justifyContent: 'flex-end',
    },
    sheetWrap: {
      padding: spacing.md,
    },
    sheet: {
      padding: spacing.sm,
      gap: 2,
    },
    title: {
      paddingHorizontal: spacing.sm,
      paddingTop: spacing.xs,
      paddingBottom: spacing.xs,
      color: colors.textMuted,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
      minHeight: 48,
    },
    rowPressed: {
      opacity: 0.6,
    },
    rowDisabled: {
      opacity: 0.4,
    },
    iconSpacer: {
      width: 18,
    },
    rowLabel: {
      fontFamily: fonts.serif,
      fontSize: 16,
      lineHeight: 22,
    },
  });
