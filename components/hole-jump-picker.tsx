import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, View } from 'react-native';

import { SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { spacing, type Palette, type FontSet } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';
import type { Hole } from '@/db/types';

const MENU_WIDTH = 260;

type Props = {
  holeNumber: number;
  holeCount: number;
  holes: Hole[];
  onJump: (n: number) => void;
  onFinish: () => void;
  /** The "Hole X · Par N" label that triggers the picker. */
  children: ReactNode;
  /** Style passed to the trigger wrapper (e.g. flex from the nav). */
  triggerStyle?: object;
  /** Open below the label (top nav) or above it (bottom nav). Default 'below'. */
  placement?: 'below' | 'above';
};

// Tap the "Hole X" label anywhere in the round flow to jump to a specific hole
// or finish the round. Pairs with the chevron stepper rather than replacing it.
export function HoleJumpPicker({
  holeNumber,
  holeCount,
  holes,
  onJump,
  onFinish,
  children,
  triggerStyle,
  placement = 'below',
}: Props) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const ref = useRef<View>(null);

  const scoredByNumber = useMemo(() => {
    const set = new Set<number>();
    for (const h of holes) if (h.score != null) set.add(h.holeNumber);
    return set;
  }, [holes]);

  const openMenu = () => {
    ref.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setOpen(true);
    });
  };

  const numbers = Array.from({ length: holeCount }, (_, i) => i + 1);

  // Center the menu under the trigger, clamped roughly within the screen edges.
  const left = Math.max(
    spacing.md,
    anchor.x + anchor.width / 2 - MENU_WIDTH / 2,
  );

  // Below the label (top nav) or anchored above it (bottom nav) so the grid
  // grows up into the screen instead of off the bottom edge.
  const position =
    placement === 'above'
      ? { bottom: Dimensions.get('window').height - anchor.y + 8, left, width: MENU_WIDTH }
      : { top: anchor.y + anchor.height + 8, left, width: MENU_WIDTH };

  return (
    <View ref={ref} collapsable={false} style={triggerStyle}>
      <Pressable
        onPress={openMenu}
        accessibilityRole="button"
        accessibilityLabel="Jump to hole"
        style={({ pressed }) => pressed && styles.pressed}>
        {children}
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)}>
          <View
            style={[styles.menuWrap, position]}>
            <Pressable>
              <SketchSurface seed="hole-jump-menu" radius={14} grain style={styles.menu}>
                <ThemedText style={styles.caption}>JUMP TO HOLE</ThemedText>
                <View style={styles.grid}>
                  {numbers.map((n) => {
                    const isCurrent = n === holeNumber;
                    const scored = scoredByNumber.has(n);
                    return (
                      <Pressable
                        key={n}
                        onPress={() => {
                          onJump(n);
                          setOpen(false);
                        }}
                        style={({ pressed }) => [styles.tileWrap, pressed && styles.pressed]}>
                        <SketchSurface
                          seed={`hole-tile-${n}`}
                          radius={10}
                          fill={isCurrent ? colors.accent : undefined}
                          stroke={isCurrent ? colors.accent : undefined}
                          grain={isCurrent}
                          style={styles.tile}>
                          <ThemedText
                            style={[styles.tileLabel, isCurrent && styles.tileLabelCurrent]}>
                            {n}
                          </ThemedText>
                        </SketchSurface>
                        <View
                          style={[
                            styles.dot,
                            scored && styles.dotScored,
                            isCurrent && scored && styles.dotScoredCurrent,
                          ]}
                        />
                      </Pressable>
                    );
                  })}
                </View>

                <Pressable
                  onPress={() => {
                    setOpen(false);
                    onFinish();
                  }}
                  style={({ pressed }) => [styles.finishWrap, pressed && styles.pressed]}>
                  <SketchSurface
                    seed="hole-jump-finish"
                    radius={10}
                    fill={colors.accent}
                    stroke={colors.accent}
                    grain
                    style={styles.finish}>
                    <IconSymbol name="checkmark" size={16} color={colors.accentOn} />
                    <ThemedText style={styles.finishLabel}>Finish round</ThemedText>
                  </SketchSurface>
                </Pressable>
              </SketchSurface>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const makeStyles = (colors: Palette, fonts: FontSet) =>
  StyleSheet.create({
    pressed: {
      opacity: 0.6,
    },
    menuWrap: {
      position: 'absolute',
    },
    menu: {
      padding: spacing.md,
      gap: spacing.sm,
    },
    caption: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.2,
      color: colors.textMuted,
      textAlign: 'center',
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    tileWrap: {
      width: 44,
      alignItems: 'center',
      gap: 4,
    },
    tile: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tileLabel: {
      fontFamily: fonts.serifBold,
      fontSize: 18,
      lineHeight: 24,
      color: colors.textPrimary,
    },
    tileLabelCurrent: {
      color: colors.accentOn,
    },
    dot: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
      backgroundColor: 'transparent',
    },
    dotScored: {
      backgroundColor: colors.accent,
    },
    dotScoredCurrent: {
      backgroundColor: colors.accentOn,
    },
    finishWrap: {
      marginTop: spacing.xs,
    },
    finish: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
    },
    finishLabel: {
      fontFamily: fonts.serifBold,
      fontSize: 16,
      lineHeight: 22,
      color: colors.accentOn,
    },
  });
