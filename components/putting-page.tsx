import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { colors, fontFamily, spacing } from '@/constants/theme';
import { createPutt, deletePutt } from '@/db/queries';
import type { Hole, Putt } from '@/db/types';
import { roughCirclePath } from '@/lib/sketch';

type Bucket = { value: number; label: string };

const BUCKETS: Bucket[] = [
  { value: 3, label: '<3 ft' },
  { value: 10, label: '3-10' },
  { value: 15, label: '10-15' },
  { value: 30, label: '15+' },
];

const MIN_ROWS = 8;
const SLOT_SIZE = 22;
const SIDE_LABEL_WIDTH = 24;
const ROTATED_TEXT_WIDTH = 80;

type Props = {
  roundId: string;
  hole: Hole;
  putts: Putt[];
  onChange: () => void | Promise<void>;
};

export function PuttingPage({ roundId, hole, putts, onChange }: Props) {
  const makesByBucket = useMemo(() => groupByBucket(putts, true), [putts]);
  const missesByBucket = useMemo(() => groupByBucket(putts, false), [putts]);

  const totals = useMemo(
    () => ({
      made: putts.filter((p) => p.made).length,
      total: putts.length,
    }),
    [putts],
  );

  const maxMakes = Math.max(
    0,
    ...BUCKETS.map((b) => makesByBucket.get(b.value)?.length ?? 0),
  );
  const maxMisses = Math.max(
    0,
    ...BUCKETS.map((b) => missesByBucket.get(b.value)?.length ?? 0),
  );
  const makeRows = Math.max(MIN_ROWS, maxMakes + 1);
  const missRows = Math.max(MIN_ROWS, maxMisses + 1);

  const addPutt = async (distance: number, made: boolean) => {
    try {
      await createPutt({
        roundId,
        holeNumber: hole.holeNumber,
        distanceFt: distance,
        made,
      });
      await onChange();
    } catch (err) {
      console.error(err);
    }
  };

  const removePutt = async (puttId: string) => {
    try {
      await deletePutt(puttId);
      await onChange();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="caption">PUTTING</ThemedText>
        <ThemedText type="title">
          Hole {hole.holeNumber}
          {hole.par != null ? ` · Par ${hole.par}` : ''}
        </ThemedText>
        <ThemedText type="muted" style={styles.totals}>
          {totals.made}/{totals.total} made this round
        </ThemedText>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <VerticalLabel label="MAKES" />
          <View style={styles.gridArea}>
            <PuttingGrid
              rows={makeRows}
              byBucket={makesByBucket}
              variant="make"
              fillFromBottom
              onAdd={(d) => addPutt(d, true)}
              onRemove={removePutt}
            />
          </View>
        </View>

        <View style={styles.headerRow}>
          <View style={styles.sideLabelSpacer} />
          <View style={styles.headerCells}>
            {BUCKETS.map((b) => (
              <View key={b.value} style={styles.cell}>
                <ThemedText style={styles.bucketHeader}>{b.label}</ThemedText>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <VerticalLabel label="MISSES" />
          <View style={styles.gridArea}>
            <PuttingGrid
              rows={missRows}
              byBucket={missesByBucket}
              variant="miss"
              fillFromBottom={false}
              onAdd={(d) => addPutt(d, false)}
              onRemove={removePutt}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function VerticalLabel({ label }: { label: string }) {
  return (
    <View style={styles.verticalLabel}>
      <ThemedText style={styles.verticalLabelText}>{label}</ThemedText>
    </View>
  );
}

function PuttingGrid({
  rows,
  byBucket,
  variant,
  fillFromBottom,
  onAdd,
  onRemove,
}: {
  rows: number;
  byBucket: Map<number, Putt[]>;
  variant: 'make' | 'miss';
  fillFromBottom: boolean;
  onAdd: (distance: number) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <View style={styles.grid}>
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <View key={rowIdx} style={styles.gridRow}>
          {BUCKETS.map((b) => {
            const putts = byBucket.get(b.value) ?? [];
            const dataIdx = fillFromBottom ? rows - 1 - rowIdx : rowIdx;
            const putt = putts[dataIdx];
            if (putt) {
              return (
                <View key={b.value} style={styles.cell}>
                  <Pressable
                    onPress={() => onRemove(putt.id)}
                    hitSlop={6}
                    style={({ pressed }) => [styles.slot, pressed && styles.slotPressed]}>
                    <PuttGlyph kind={variant} seed={putt.id} />
                  </Pressable>
                </View>
              );
            }
            return (
              <View key={b.value} style={styles.cell}>
                <Pressable
                  onPress={() => onAdd(b.value)}
                  hitSlop={6}
                  style={({ pressed }) => [styles.slot, pressed && styles.slotPressed]}>
                  <PuttGlyph kind="empty" seed={`empty-${variant}-${b.value}-${rowIdx}`} />
                </Pressable>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function PuttGlyph({ kind, seed }: { kind: 'make' | 'miss' | 'empty'; seed: string }) {
  const c = SLOT_SIZE / 2;
  const r = SLOT_SIZE * 0.38;
  const path = roughCirclePath(c, c, r, seed, { jitter: 0.06, points: 14 });
  if (kind === 'make') {
    return (
      <Svg width={SLOT_SIZE} height={SLOT_SIZE}>
        <Path d={path} fill={colors.accent} stroke={colors.accent} strokeWidth={1.2} />
      </Svg>
    );
  }
  if (kind === 'miss') {
    return (
      <Svg width={SLOT_SIZE} height={SLOT_SIZE}>
        <Path d={path} fill="none" stroke={colors.accent} strokeWidth={2} />
      </Svg>
    );
  }
  return (
    <Svg width={SLOT_SIZE} height={SLOT_SIZE}>
      <Path d={path} fill="none" stroke={colors.borderStrong} strokeWidth={1.2} strokeOpacity={0.6} />
    </Svg>
  );
}

function groupByBucket(putts: Putt[], made: boolean): Map<number, Putt[]> {
  const map = new Map<number, Putt[]>();
  for (const putt of putts) {
    if (putt.made !== made) continue;
    const list = map.get(putt.distanceFt) ?? [];
    list.push(putt);
    map.set(putt.distanceFt, list);
  }
  return map;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: 100,
  },
  header: {
    alignItems: 'center',
    gap: 2,
    paddingBottom: spacing.md,
  },
  totals: {
    fontSize: 13,
    marginTop: 2,
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  scrollContent: {
    paddingBottom: spacing.md,
  },
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  verticalLabel: {
    width: SIDE_LABEL_WIDTH,
    minHeight: 96,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  verticalLabelText: {
    width: ROTATED_TEXT_WIDTH,
    textAlign: 'center',
    fontFamily: fontFamily.serif,
    fontSize: 12,
    color: colors.textMuted,
    letterSpacing: 2,
    transform: [{ rotate: '-90deg' }],
  },
  gridArea: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  sideLabelSpacer: {
    width: SIDE_LABEL_WIDTH,
  },
  headerCells: {
    flex: 1,
    flexDirection: 'row',
  },
  bucketHeader: {
    fontFamily: fontFamily.serif,
    fontSize: 13,
    color: colors.textSecondary,
  },
  grid: {
    gap: 6,
  },
  gridRow: {
    flexDirection: 'row',
  },
  cell: {
    flex: 1,
    alignItems: 'center',
  },
  slot: {
    width: SLOT_SIZE,
    height: SLOT_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotPressed: {
    opacity: 0.5,
  },
});
