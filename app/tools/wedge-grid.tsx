import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { BagPicker } from '@/components/bag-picker';
import { Screen } from '@/components/screen';
import { SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { YardageRuler } from '@/components/yardage-ruler';
import { CLUB_OPTIONS, isWedge } from '@/constants/clubs';
import { fontFamily, spacing, type Palette } from '@/constants/theme';
import { useColors } from '@/constants/theme-context';
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
  const styles = useMemo(() => makeStyles(colors), [colors]);
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

  const valueFor = (club: string, row: RowKey): number | null => {
    if (row === 'full') return yardages[club] ?? null;
    return partials[club]?.[row] ?? null;
  };

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

  const rowLabel = (row: RowKey) => ROWS.find((x) => x.key === row)!.label;
  const selValue = selected ? valueFor(selected.club, selected.row) : null;

  return (
    <Screen>

      <View style={styles.bagPicker}>
        <BagPicker value={bag} onChange={onBagChange} label="My Wedges" options={WEDGE_OPTIONS} />
      </View>

      {wedges.length === 0 ? (
        <ThemedText type="muted" style={styles.empty}>
          No wedges in your bag yet. Add wedges to your bag to use the grid.
        </ThemedText>
      ) : (
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
                      onPress={() => setSelected(isSel ? null : { club, row: r.key })}
                      accessibilityRole="button"
                      accessibilityLabel={`${club} ${r.label}`}
                      style={styles.cell}>
                      <SketchSurface
                        seed={`wedge-${club}-${r.key}`}
                        radius={10}
                        fill={isSel ? colors.accentMuted : colors.surface}
                        stroke={isSel ? colors.accent : colors.borderStrong}
                        style={styles.cellInner}>
                        {v != null ? (
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
      )}

      {selected && (
        <View style={styles.editor}>
          <ThemedText type="caption">
            {selected.club} · {rowLabel(selected.row)}
          </ThemedText>
          <YardageRuler
            key={`${selected.club}-${selected.row}`}
            value={selValue}
            onCommit={(next) => onCommit(selected, next)}
            min={20}
            max={180}
            step={5}
            defaultValue={selValue ?? 90}
          />
        </View>
      )}
    </Screen>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  intro: {
    fontSize: 13,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  bagPicker: {
    paddingVertical: spacing.lg,
  },
  empty: {
    paddingTop: spacing.xl,
    textAlign: 'center',
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
    fontFamily: fontFamily.serif,
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
    fontFamily: fontFamily.serifBold,
    fontSize: 16,
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
    fontFamily: fontFamily.serifBold,
    fontSize: 20,
    color: colors.textPrimary,
  },
  valueEmpty: {
    fontFamily: fontFamily.serif,
    fontSize: 18,
    color: colors.textMuted,
  },
  editor: {
    paddingTop: spacing.lg,
    gap: spacing.xs,
  },
});
