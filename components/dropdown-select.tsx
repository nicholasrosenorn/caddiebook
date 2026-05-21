import { useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamily, spacing, type Palette } from '@/constants/theme';
import { useColors } from '@/constants/theme-context';

export type DropdownOption<T extends string | number> = {
  value: T;
  /** Full label shown in the open menu. */
  label: string;
  /** Compact label shown on the collapsed button (defaults to label). */
  short?: string;
};

type Props<T extends string | number> = {
  seed: string;
  value: T;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  /** Stretch the button to fill its parent (value left, chevron right). */
  block?: boolean;
  style?: object;
};

export function DropdownSelect<T extends string | number>({
  seed,
  value,
  options,
  onChange,
  block = false,
  style,
}: Props<T>) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const ref = useRef<View>(null);
  const current = options.find((o) => o.value === value) ?? options[0];

  const openMenu = () => {
    ref.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setOpen(true);
    });
  };

  return (
    <View ref={ref} collapsable={false} style={[block && styles.block, style]}>
      <Pressable onPress={openMenu} style={({ pressed }) => pressed && styles.pressed}>
        <SketchSurface seed={`dd-${seed}`} radius={10} style={styles.button}>
          <ThemedText style={styles.value} numberOfLines={1}>
            {current.short ?? current.label}
          </ThemedText>
          <IconSymbol name="chevron.down" size={20} color={colors.accent} />
        </SketchSurface>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)}>
          <View
            style={[
              styles.menuWrap,
              {
                top: anchor.y + anchor.height + 6,
                left: anchor.x,
                minWidth: Math.max(anchor.width, 160),
              },
            ]}>
            <Pressable>
              <SketchSurface seed={`dd-menu-${seed}`} radius={12} style={styles.menu}>
                {options.map((opt, i) => {
                  const selected = opt.value === value;
                  return (
                    <Pressable
                      key={String(opt.value)}
                      onPress={() => {
                        onChange(opt.value);
                        setOpen(false);
                      }}
                      style={({ pressed }) => [
                        styles.row,
                        i < options.length - 1 && styles.rowDivider,
                        pressed && styles.rowPressed,
                      ]}>
                      <ThemedText style={[styles.rowLabel, selected && styles.rowLabelSelected]}>
                        {opt.label}
                      </ThemedText>
                      {selected ? (
                        <IconSymbol name="checkmark" size={16} color={colors.accent} />
                      ) : null}
                    </Pressable>
                  );
                })}
              </SketchSurface>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  block: {
    flex: 1,
  },
  pressed: {
    opacity: 0.6,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    minHeight: 42,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  value: {
    fontFamily: fontFamily.serifBold,
    fontSize: 17,
    color: colors.textPrimary,
  },
  menuWrap: {
    position: 'absolute',
  },
  menu: {
    paddingVertical: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowPressed: {
    backgroundColor: colors.accentMuted,
  },
  rowLabel: {
    fontFamily: fontFamily.serif,
    fontSize: 16,
    color: colors.textSecondary,
  },
  rowLabelSelected: {
    color: colors.accent,
    fontFamily: fontFamily.serifBold,
  },
});
