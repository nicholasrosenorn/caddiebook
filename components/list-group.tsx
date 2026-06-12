import { Children, Fragment, isValidElement, useMemo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { spacing, type FontSet, type Palette } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';

import { SketchSurface } from './sketch';
import { ThemedText } from './themed-text';
import { IconSymbol, type IconSymbolName } from './ui/icon-symbol';

// A native-iOS-style grouped list: one framed card with hairline dividers
// between rows (inset to align under the labels, like Settings). Pair with
// ListRow children. Reused by Settings, Friends, and Blocked.
export function ListGroup({
  seed,
  children,
  style,
}: {
  seed: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <SketchSurface seed={seed} radius={12} style={[styles.group, style]}>
      {rows.map((child, i) => (
        <Fragment key={i}>
          {i > 0 ? <View style={styles.divider} /> : null}
          {child}
        </Fragment>
      ))}
    </SketchSurface>
  );
}

export function ListRow({
  icon,
  iconColor,
  label,
  sublabel,
  right,
  onPress,
  destructive,
  accessibilityLabel,
}: {
  icon?: IconSymbolName;
  iconColor?: string;
  label: string;
  sublabel?: string | null;
  // Trailing content. Defaults to a chevron when the row is pressable.
  right?: ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  accessibilityLabel?: string;
}) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const tint = destructive ? colors.danger : colors.textPrimary;

  const trailing =
    right !== undefined ? (
      right
    ) : onPress ? (
      <IconSymbol name="chevron.right" size={16} color={colors.textMuted} />
    ) : null;

  const body = (
    <View style={styles.row}>
      {icon ? <IconSymbol name={icon} size={20} color={iconColor ?? colors.accent} /> : null}
      <View style={styles.rowText}>
        <ThemedText style={[styles.rowLabel, { color: tint }]} numberOfLines={1}>
          {label}
        </ThemedText>
        {sublabel ? (
          <ThemedText type="muted" style={styles.rowSub} numberOfLines={1}>
            {sublabel}
          </ThemedText>
        ) : null}
      </View>
      {trailing}
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => pressed && styles.pressed}>
      {body}
    </Pressable>
  );
}

const makeStyles = (colors: Palette, fonts?: FontSet) =>
  StyleSheet.create({
    group: {
      paddingHorizontal: spacing.md,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      // Inset so the hairline starts under the label, not the icon.
      marginLeft: spacing.md + 20,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minHeight: 50,
      paddingVertical: spacing.sm,
    },
    rowText: {
      flex: 1,
      gap: 1,
    },
    rowLabel: {
      fontFamily: fonts?.serif,
      fontSize: 16,
      lineHeight: 22,
      color: colors.textPrimary,
    },
    rowSub: {
      fontSize: 13,
    },
    pressed: {
      opacity: 0.55,
    },
  });
