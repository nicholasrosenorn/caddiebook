import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { BagPicker } from '@/components/bag-picker';
import { Screen } from '@/components/screen';
import { SketchDivider, SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { WedgeRangeChart } from '@/components/wedge-range-chart';
import { CLUB_OPTIONS, isWedge } from '@/constants/clubs';
import { spacing, type Palette, type FontSet } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';
import {
  getBag,
  getClubYardages,
  getWedgePartials,
  setBag,
  setClubYardage,
  setWedgePartial,
  type WedgePartials,
} from '@/db/queries';

type RowKey = 'full' | 'tq' | 'half' | 'quarter';

const ROWS: { key: RowKey; label: string }[] = [
  { key: 'full', label: 'Full' },
  { key: 'tq', label: '¾' },
  { key: 'half', label: '½' },
  { key: 'quarter', label: '¼' },
];

// Legend dot diameters, biggest → smallest, mirroring the chart's power sizes.
const LEGEND_DOT = [18, 14, 11, 9];

const HEADER_H = 34;
const CELL_H = 52;
const COL_W = 76;
const LABEL_W = 56;
const GAP = spacing.sm;

type Selection = { club: string; row: RowKey };

// Every wedge (PW + more-lofted), in canonical order — the only clubs the
// grid's bag picker offers.
const WEDGE_OPTIONS = CLUB_OPTIONS.filter(isWedge);

// The wedges in a bag, in canonical order.
function wedgesFromBag(bag: string[]): string[] {
  const pool = new Set(bag);
  return WEDGE_OPTIONS.filter((c) => pool.has(c));
}

export default function WedgeGridScreen() {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const [bag, setBagState] = useState<string[]>([...CLUB_OPTIONS]);
  const [wedges, setWedges] = useState<string[]>([]);
  const [yardages, setYardages] = useState<Record<string, number>>({});
  const [partials, setPartials] = useState<Record<string, WedgePartials>>({});
  const [selected, setSelected] = useState<Selection | null>(null);

  const load = useCallback(async () => {
    const [storedBag, yds, parts] = await Promise.all([
      getBag(),
      getClubYardages(),
      getWedgePartials(),
    ]);
    const effective = storedBag.length > 0 ? storedBag : [...CLUB_OPTIONS];
    setBagState(effective);
    setWedges(wedgesFromBag(effective));
    setYardages(yds);
    setPartials(parts);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onBagChange = useCallback(async (next: string[]) => {
    setBagState(next);
    setWedges(wedgesFromBag(next));
    // Drop the open editor if its wedge is no longer in the bag.
    setSelected((sel) => (sel && !next.includes(sel.club) ? null : sel));
    await setBag(next);
  }, []);

  const valueFor = useCallback(
    (club: string, row: RowKey): number | null => {
      if (row === 'full') return yardages[club] ?? null;
      return partials[club]?.[row] ?? null;
    },
    [yardages, partials],
  );

  const onSelect = useCallback(
    (club: string, row: RowKey) =>
      setSelected((sel) => (sel?.club === club && sel?.row === row ? null : { club, row })),
    [],
  );

  const onCommit = useCallback(async (sel: Selection, next: number | null) => {
    if (sel.row === 'full') {
      setYardages((prev) => {
        const out = { ...prev };
        if (next == null) delete out[sel.club];
        else out[sel.club] = next;
        return out;
      });
      await setClubYardage(sel.club, next);
    } else {
      setPartials((prev) => {
        const cur = prev[sel.club] ?? { tq: null, half: null, quarter: null };
        return { ...prev, [sel.club]: { ...cur, [sel.row]: next } };
      });
      await setWedgePartial(sel.club, sel.row, next);
    }
  }, []);


  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets>
      <View style={styles.bagPicker}>
        <BagPicker value={bag} onChange={onBagChange} label="My Wedges" options={WEDGE_OPTIONS} />
      </View>

      {wedges.length === 0 ? (
        <ThemedText type="muted" style={styles.empty}>
          No wedges in your bag yet. Add wedges to your bag to use the grid.
        </ThemedText>
      ) : (
        <>
        {/* Hero: the carry "range" — wedges across, distance up. Dot size = power.
            Read-only; the grid below is the editor. */}
        <WedgeRangeChart wedges={wedges} getValue={valueFor} selected={selected} />

        {/* Power markers tucked close under the chart */}
        <View style={styles.legend}>
          {ROWS.map((r, i) => (
            <View key={r.key} style={styles.legendItem}>
              <View style={[styles.legendDot, { width: LEGEND_DOT[i], height: LEGEND_DOT[i] }]} />
              <ThemedText style={styles.legendLabel}>{r.label}</ThemedText>
            </View>
          ))}
        </View>

        <SketchDivider seed="wedge-divider" />

        <View style={styles.hint}>
          <View style={styles.infoBadge}>
            <ThemedText style={styles.infoI}>i</ThemedText>
          </View>
          <ThemedText style={styles.hintText}>
            Edit your wedge numbers below to update the graph.
          </ThemedText>
        </View>

        <View style={styles.gridRow}>
          {/* Fixed left swing-length labels */}
          <View style={styles.labelCol}>
            <View style={{ height: HEADER_H }} />
            {ROWS.map((r) => (
              <View key={r.key} style={styles.labelCell}>
                <ThemedText style={styles.axisLabel}>{r.label}</ThemedText>
              </View>
            ))}
          </View>

          {/* Scrollable wedge columns */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.cols}>
            {wedges.map((club) => (
              <View key={club} style={styles.col}>
                <View style={styles.loftHeader}>
                  <ThemedText style={styles.loft}>{club}</ThemedText>
                </View>
                {ROWS.map((r) => {
                  const v = valueFor(club, r.key);
                  const isSel = selected?.club === club && selected?.row === r.key;
                  return (
                    <Pressable
                      key={r.key}
                      onPress={() => onSelect(club, r.key)}
                      accessibilityRole="button"
                      accessibilityLabel={`${club} ${r.label}`}
                      style={styles.cell}>
                      <SketchSurface
                        seed={`wedge-${club}-${r.key}`}
                        radius={10}
                        fill={isSel ? colors.accentMuted : colors.surface}
                        stroke={isSel ? colors.accent : colors.borderStrong}
                        style={styles.cellInner}>
                        {isSel ? (
                          <CellInput
                            value={v}
                            onCommit={(next) => onCommit({ club, row: r.key }, next)}
                            style={styles.cellInput}
                            placeholderColor={colors.textMuted}
                          />
                        ) : v != null ? (
                          <ThemedText style={styles.value}>{v}</ThemedText>
                        ) : (
                          <ThemedText style={styles.valueEmpty}>—</ThemedText>
                        )}
                      </SketchSurface>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        </View>
        </>
      )}
      </ScrollView>
    </Screen>
  );
}

// An inline cell editor: a numeric keyboard input that replaces the cell's value
// while it's selected. Commits (clamped) on blur / submit / unmount; tapping
// another cell moves the edit there. Local text state keeps typing snappy and
// only the final value writes through.
function CellInput({
  value,
  onCommit,
  style,
  placeholderColor,
}: {
  value: number | null;
  onCommit: (next: number | null) => void;
  style: TextInput['props']['style'];
  placeholderColor: string;
}) {
  const [text, setText] = useState(value == null ? '' : String(value));
  const latest = useRef(text);
  latest.current = text;
  const committed = useRef(false);

  const commit = useCallback(() => {
    if (committed.current) return;
    committed.current = true;
    const t = latest.current.trim();
    if (t === '') {
      if (value !== null) onCommit(null);
      return;
    }
    const parsed = parseInt(t, 10);
    if (Number.isNaN(parsed)) return;
    const clamped = Math.max(20, Math.min(180, parsed));
    if (clamped !== value) onCommit(clamped);
  }, [value, onCommit]);

  // Save if the cell unmounts (e.g. tapping another cell) without a blur first.
  useEffect(() => () => commit(), [commit]);

  return (
    <TextInput
      autoFocus
      keyboardType="number-pad"
      returnKeyType="done"
      selectTextOnFocus
      value={text}
      onChangeText={(t) => setText(t.replace(/[^0-9]/g, ''))}
      onFocus={() => {
        committed.current = false;
      }}
      onBlur={commit}
      onSubmitEditing={commit}
      placeholder="—"
      placeholderTextColor={placeholderColor}
      style={style}
    />
  );
}

const makeStyles = (colors: Palette, fonts: FontSet) =>
  StyleSheet.create({
  bagPicker: {
    paddingVertical: spacing.lg,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  empty: {
    paddingTop: spacing.xl,
    textAlign: 'center',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    borderRadius: 999,
    backgroundColor: colors.accentPressed,
  },
  legendLabel: {
    fontFamily: fonts.serif,
    fontSize: 13,
    color: colors.textSecondary,
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  infoBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  infoI: {
    fontFamily: fonts.serif,
    fontSize: 12,
    lineHeight: 14,
    color: colors.textSecondary,
  },
  hintText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  gridRow: {
    flexDirection: 'row',
    gap: GAP,
  },
  labelCol: {
    width: LABEL_W,
    gap: GAP,
  },
  labelCell: {
    height: CELL_H,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  axisLabel: {
    fontFamily: fonts.serif,
    fontSize: 15,
    color: colors.textSecondary,
  },
  cols: {
    gap: GAP,
  },
  col: {
    width: COL_W,
    gap: GAP,
  },
  loftHeader: {
    height: HEADER_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loft: {
    fontFamily: fonts.serifBold,
    fontSize: 16,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  cell: {
    height: CELL_H,
  },
  cellInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontFamily: fonts.serifBold,
    fontSize: 20,
    lineHeight: 27,
    color: colors.textPrimary,
  },
  valueEmpty: {
    fontFamily: fonts.serif,
    fontSize: 18,
    lineHeight: 24,
    color: colors.textMuted,
  },
  cellInput: {
    alignSelf: 'stretch',
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.serifBold,
    fontSize: 20,
    lineHeight: 27,
    color: colors.textPrimary,
    padding: 0,
  },
});
