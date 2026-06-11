import { useCallback, useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import { BagPicker } from '@/components/bag-picker';
import { BagFan, ClubArc, clubLoft, xToCarry } from '@/components/club-arc';
import { InfoHint } from '@/components/info-hint';
import { Screen } from '@/components/screen';
import { SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { CLUB_OPTIONS, sortByDriveLength } from '@/constants/clubs';
import { spacing, type Palette, type FontSet } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';
import {
  useBag,
  useClubYardages,
  useSetBag,
  useSetClubYardage,
} from '@/lib/data/settings';

const DEFAULT_YDS = 100;
const BAND_HEIGHT = 76;
const FAN_HEIGHT = 132;
// Extra vertical room around the arc that still counts as "on the flag" — keeps
// the drag from being lost when the finger drifts off the line a little.
const BAND_TOUCH_SLOP = 28;

// Derive the in-play club list (Putter excluded, longest → shortest) from a bag.
function clubsFromBag(bag: string[]): string[] {
  const inBag = new Set(bag);
  return sortByDriveLength(CLUB_OPTIONS.filter((c) => c !== 'Putter' && inBag.has(c)));
}

export default function YardagesScreen() {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  // The cached settings query is the source of truth: the setters patch the
  // cache synchronously (optimistic) so the UI updates on the same frame.
  const { bag: storedBag } = useBag();
  const { yardages } = useClubYardages();
  const setBag = useSetBag();
  const setClubYardage = useSetClubYardage();

  // Empty/unset bag means "all clubs" everywhere else, so show that here too.
  const bag = useMemo(
    () => (storedBag.length > 0 ? storedBag : [...CLUB_OPTIONS]),
    [storedBag],
  );
  const clubs = useMemo(() => clubsFromBag(bag), [bag]);

  const onBagChange = useCallback(
    async (next: string[]) => {
      await setBag(next);
    },
    [setBag],
  );

  const onCommit = useCallback(
    async (club: string, next: number | null) => {
      await setClubYardage(club, next);
    },
    [setClubYardage],
  );

  const fanItems = useMemo(
    () =>
      clubs
        .filter((c) => yardages[c] != null)
        .map((c) => ({ carry: yardages[c], loft: clubLoft(c) })),
    [clubs, yardages],
  );

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>

        <BagPicker value={bag} onChange={onBagChange} label="My bag" />

        {fanItems.length >= 2 && <BagPlate items={fanItems} />}

        <View style={styles.introRow}>
          <ThemedText type="muted" style={styles.intro}>
            Drag a flag to set a carry distance. Long-press a yardage to clear it.
          </ThemedText>
          <InfoHint
            title="Setting your yardages"
            message="Drag the flag along each club's arc to set its typical carry. Once two or more clubs have a number, the full-bag fan plots them together. Long-press a yardage to clear it."
          />
        </View>

        {clubs.map((club) => (
          <ArcCard
            key={club}
            club={club}
            yards={yardages[club] ?? null}
            onCommit={(next) => onCommit(club, next)}
          />
        ))}
      </ScrollView>
    </Screen>
  );
}

// The whole-bag silhouette plate: nested trajectories at a glance.
function BagPlate({ items }: { items: { carry: number; loft: number }[] }) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w !== width) setWidth(w);
  };
  const carries = items.map((i) => i.carry);
  const lo = Math.min(...carries);
  const hi = Math.max(...carries);

  return (
    <SketchSurface seed="bag-fan" radius={12} style={styles.fanCard}>
      <ThemedText type="label" style={styles.fanKicker}>
        Full bag
      </ThemedText>
      <View style={styles.fanBand} onLayout={onLayout}>
        {width > 0 && <BagFan width={width} height={FAN_HEIGHT} items={items} />}
      </View>
      <ThemedText type="muted" style={styles.fanCaption}>
        {lo}–{hi} yds across {items.length} clubs
      </ThemedText>
    </SketchSurface>
  );
}

function ArcCard({
  club,
  yards,
  onCommit,
}: {
  club: string;
  yards: number | null;
  onCommit: (next: number | null) => void;
}) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const [bandW, setBandW] = useState(0);
  const [drag, setDrag] = useState<number | null>(null);
  const display = drag ?? yards;
  const loft = useMemo(() => clubLoft(club), [club]);

  // Keep the latest band width / value in refs so the (stable) PanResponder
  // always reads current values without being recreated on every render.
  const widthRef = useRef(0);
  widthRef.current = bandW;
  const yardsRef = useRef(yards);
  yardsRef.current = yards;

  const pan = useMemo(
    () =>
      PanResponder.create({
        // Don't steal the touch on start — let the list scroll. Claim only once
        // the gesture is clearly horizontal, then track the flag under the finger.
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_e, g) =>
          Math.abs(g.dx) > Math.abs(g.dy) && Math.abs(g.dx) > 3,
        // Once we own the gesture, don't let the parent ScrollView reclaim it
        // mid-drag — the flag should stay glued to the finger until release.
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => setDrag(xToCarry(e.nativeEvent.locationX, widthRef.current)),
        onPanResponderMove: (e) => setDrag(xToCarry(e.nativeEvent.locationX, widthRef.current)),
        onPanResponderRelease: (e) => {
          const next = xToCarry(e.nativeEvent.locationX, widthRef.current);
          setDrag(null);
          if (next !== yardsRef.current) onCommit(next);
        },
        onPanResponderTerminate: () => setDrag(null),
      }),
    [onCommit],
  );

  const onBandLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w !== bandW) setBandW(w);
  };

  return (
    <SketchSurface seed={`yds-${club}`} radius={12} style={styles.card}>
      <View style={styles.head}>
        <ThemedText style={styles.club}>{club}</ThemedText>
        <Pressable
          onLongPress={() => onCommit(null)}
          disabled={yards == null}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`${club} carry${yards != null ? `, ${yards} yards, long-press to clear` : ''}`}>
          {display != null ? (
            <ThemedText style={[styles.yards, drag != null && styles.yardsActive]}>
              {display} <ThemedText style={styles.unit}>yds</ThemedText>
            </ThemedText>
          ) : (
            <ThemedText style={styles.empty}>drag to set</ThemedText>
          )}
        </Pressable>
      </View>

      <View style={styles.band} onLayout={onBandLayout} {...pan.panHandlers}>
        {bandW > 0 && (
          <ClubArc
            width={bandW}
            height={BAND_HEIGHT}
            carry={display}
            active={drag != null || yards != null}
            loft={loft}
            parkedAt={DEFAULT_YDS}
          />
        )}
      </View>
    </SketchSurface>
  );
}

const makeStyles = (colors: Palette, fonts: FontSet) =>
  StyleSheet.create({
  content: {
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  introRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    paddingBottom: spacing.sm,
  },
  intro: {
    flex: 1,
    fontSize: 13,
  },
  fanCard: {
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    marginBottom: spacing.xs,
  },
  fanKicker: {
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xs,
  },
  fanBand: {
    height: FAN_HEIGHT,
  },
  fanCaption: {
    fontSize: 12,
    textAlign: 'center',
    paddingTop: 2,
    paddingBottom: spacing.xs,
  },
  card: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  club: {
    fontFamily: fonts.serif,
    fontSize: 18,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  yards: {
    fontFamily: fonts.serifBold,
    fontSize: 18,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  yardsActive: {
    color: colors.accent,
  },
  unit: {
    fontFamily: fonts.serif,
    fontSize: 12,
    color: colors.textSecondary,
  },
  empty: {
    fontFamily: fonts.serif,
    fontSize: 14,
    color: colors.textMuted,
  },
  band: {
    // Touch area is taller than the visible arc, but negative margins keep the
    // arc's on-screen position and the card's layout unchanged.
    height: BAND_HEIGHT + BAND_TOUCH_SLOP * 2,
    paddingVertical: BAND_TOUCH_SLOP,
    marginVertical: -BAND_TOUCH_SLOP,
    justifyContent: 'center',
  },
});
