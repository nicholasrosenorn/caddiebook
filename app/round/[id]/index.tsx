import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApproachPage } from '@/components/approach-page';
import { DrivePage } from '@/components/drive-page';
import { GlassSurface } from '@/components/glass-surface';
import { HoleStatsPage } from '@/components/hole-stats-page';
import { HoleStepper } from '@/components/hole-stepper';
import { MapPage } from '@/components/map-page';
import { ParPage } from '@/components/par-page';
import { PuttingPage } from '@/components/putting-page';
import { ScorecardOverlay } from '@/components/scorecard-overlay';
import { ScorePage } from '@/components/score-page';
import { Screen } from '@/components/screen';
import { ScrollHint } from '@/components/scroll-hint';
import { StickyHoleNav } from '@/components/sticky-hole-nav';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { type Palette } from '@/constants/theme';
import { useColors } from '@/constants/theme-context';
import { useRoundFull, useUpdateRound } from '@/lib/data/rounds';

const NAV_HEIGHT = 96;

export default function RoundScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { id, hole, page } = useLocalSearchParams<{
    id: string;
    hole?: string;
    page?: string;
  }>();
  const [holeNumber, setHoleNumber] = useState(() => {
    const n = parseInt(hole ?? '', 10);
    return Number.isFinite(n) && n >= 1 ? n : 1;
  });
  const [pageHeight, setPageHeight] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [mapOpen, setMapOpen] = useState(false);
  const [scorecardOpen, setScorecardOpen] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const didInitialJump = useRef(false);
  const insets = useSafeAreaInsets();

  // One cached server read replaces the old four parallel SQLite queries. Page
  // mutations patch this cache optimistically, so every tap re-renders the
  // round on the same frame — no reload threading needed.
  const { data: detail } = useRoundFull(id);
  const updateRound = useUpdateRound();
  const round = detail?.round ?? null;
  const holes = useMemo(() => detail?.holes ?? [], [detail]);
  const shots = detail?.shots ?? [];
  const putts = detail?.putts ?? [];

  const currentHole = useMemo(
    () => holes.find((h) => h.holeNumber === holeNumber) ?? null,
    [holes, holeNumber],
  );

  const isPar3 = currentHole?.par === 3;
  const isFirstHole = holeNumber === 1;
  const isLastHole = round != null && holeNumber === round.holeCount;
  const totalPages = isPar3 ? 5 : 6;
  const isStatsPage = currentPage === totalPages - 1;

  // Deep-link (?hole=N&page=stats from the summary scorecard): once the pages
  // are measured and the target hole is loaded, jump straight to its Stats page.
  // Guarded by a ref so manual paging works freely afterwards.
  useEffect(() => {
    if (didInitialJump.current) return;
    if (pageHeight == null || !currentHole) return;
    if (page === 'stats') {
      const target = totalPages - 1;
      scrollRef.current?.scrollTo({ y: target * pageHeight, animated: false });
      setCurrentPage(target);
    }
    didInitialJump.current = true;
  }, [pageHeight, currentHole, page, totalPages]);

  const goToHole = useCallback((n: number) => {
    setHoleNumber(n);
    setCurrentPage(0);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []);

  const scrollToPage = useCallback(
    (page: number) => {
      if (pageHeight == null) return;
      scrollRef.current?.scrollTo({ y: page * pageHeight, animated: true });
    },
    [pageHeight],
  );

  const onPrevHole = () => {
    if (holeNumber > 1) goToHole(holeNumber - 1);
  };
  const onNextHole = () => {
    if (round && holeNumber < round.holeCount) goToHole(holeNumber + 1);
  };
  const onFinish = () => {
    router.replace(`/round/${id}/review` as any);
  };

  const closeNow = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/' as any);
    }
  }, []);

  const completeRound = useCallback(async () => {
    if (!id) return;
    const review = detail?.review ?? null;
    const reviewComplete =
      review != null &&
      review.mostCostly != null &&
      review.decisionMakingRating != null &&
      review.commonMiss != null &&
      review.rangeFocus != null &&
      review.overallRating != null;
    if (reviewComplete) {
      if (!round?.completedAt) {
        await updateRound(id, { completedAt: new Date().toISOString() });
      }
      router.replace(`/round/${id}/summary` as any);
    } else {
      router.replace(`/round/${id}/review` as any);
    }
  }, [id, round, detail, updateRound]);

  const onClose = () => {
    // Already-completed rounds (opened via "Edit round") just close.
    if (round?.completedAt) {
      closeNow();
      return;
    }
    Alert.alert('This round is unfinished. How would you like to proceed?', undefined, [
      { text: 'Save and finish later', onPress: closeNow },
      { text: 'Complete round', onPress: completeRound },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (pageHeight == null) return;
    const y = e.nativeEvent.contentOffset.y;
    const idx = Math.min(totalPages - 1, Math.max(0, Math.round(y / pageHeight)));
    if (idx !== currentPage) setCurrentPage(idx);
  };

  if (!id || !round || !currentHole) return <Screen />;

  return (
    <Screen padded={false}>
      <View style={[styles.flex, { paddingTop: insets.top }]}>
        <View
          style={styles.flex}
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            if (h > 0 && h !== pageHeight) setPageHeight(h);
          }}>
        {pageHeight !== null && (
          <>
            <ScrollView
              ref={scrollRef}
              pagingEnabled
              decelerationRate="fast"
              showsVerticalScrollIndicator={false}
              automaticallyAdjustKeyboardInsets
              keyboardShouldPersistTaps="handled"
              onScroll={onScroll}
              scrollEventThrottle={16}>
              <View style={{ height: pageHeight }}>
                <ParPage roundId={id} hole={currentHole} onPicked={() => scrollToPage(1)} />
              </View>
              <View style={{ height: pageHeight }}>
                <ScorePage roundId={id} hole={currentHole} onPicked={() => scrollToPage(2)} />
              </View>
              {!isPar3 && (
                <View style={{ height: pageHeight }}>
                  <DrivePage
                    roundId={id}
                    hole={currentHole}
                    shotsForRound={shots}
                    onComplete={() => scrollToPage(3)}
                  />
                </View>
              )}
              <View style={{ height: pageHeight }}>
                <ApproachPage
                  roundId={id}
                  hole={currentHole}
                  shotsForRound={shots}
                  onComplete={() => scrollToPage(isPar3 ? 3 : 4)}
                />
              </View>
              <View style={{ height: pageHeight }}>
                <PuttingPage roundId={id} hole={currentHole} putts={putts} />
              </View>
              <View style={{ height: pageHeight }}>
                <HoleStatsPage roundId={id} hole={currentHole} />
              </View>
            </ScrollView>

            <PageDots
              totalPages={totalPages}
              currentPage={currentPage}
              onJump={scrollToPage}
            />

            {isStatsPage ? (
              <StickyHoleNav
                holeNumber={holeNumber}
                par={currentHole.par}
                holeCount={round.holeCount}
                holes={holes}
                isFirstHole={isFirstHole}
                isLastHole={isLastHole}
                onPrev={onPrevHole}
                onNext={onNextHole}
                onJump={goToHole}
                onFinish={onFinish}
              />
            ) : (
              <>
                <HoleStepper
                  holeNumber={holeNumber}
                  par={currentHole.par}
                  holeCount={round.holeCount}
                  holes={holes}
                  isFirstHole={isFirstHole}
                  isLastHole={isLastHole}
                  onPrev={onPrevHole}
                  onNext={onNextHole}
                  onJump={goToHole}
                  onFinish={onFinish}
                />
                <ScrollHint
                  onPress={() => scrollToPage(Math.min(totalPages - 1, currentPage + 1))}
                />
              </>
            )}
          </>
        )}
        </View>
      </View>

      {mapOpen && (
        <View style={styles.overlay}>
          <MapPage />
        </View>
      )}

      {scorecardOpen && (
        <View style={styles.overlay}>
          <ScorecardOverlay
            round={round}
            holes={holes}
            onPressHole={(n) => {
              setScorecardOpen(false);
              goToHole(n);
            }}
          />
        </View>
      )}

      <Pressable
        onPress={() => router.push(`/menu?roundId=${id}` as any)}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Open menu"
        style={[styles.menuButton, { top: insets.top + 8 }]}>
        {({ pressed }) => (
          <>
            <GlassSurface borderRadius={18} />
            {pressed && <View style={styles.buttonPressedOverlay} pointerEvents="none" />}
            <IconSymbol name="line.3.horizontal" size={18} color={colors.textPrimary} />
          </>
        )}
      </Pressable>

      <Pressable
        onPress={() => {
          setScorecardOpen((v) => !v);
          setMapOpen(false);
        }}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={scorecardOpen ? 'Close scorecard' : 'Open scorecard'}
        style={[styles.scorecardButton, { top: insets.top + 8 }]}>
        {({ pressed }) => (
          <>
            {scorecardOpen ? (
              <View style={styles.buttonActiveFill} pointerEvents="none" />
            ) : (
              <GlassSurface borderRadius={18} />
            )}
            {pressed && <View style={styles.buttonPressedOverlay} pointerEvents="none" />}
            <IconSymbol
              name="tablecells"
              size={18}
              color={scorecardOpen ? colors.accentOn : colors.textPrimary}
            />
          </>
        )}
      </Pressable>

      <Pressable
        onPress={() => {
          setMapOpen((v) => !v);
          setScorecardOpen(false);
        }}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={mapOpen ? 'Close course map' : 'Open course map'}
        style={[styles.mapButton, { top: insets.top + 8 }]}>
        {({ pressed }) => (
          <>
            {mapOpen ? (
              <View style={styles.buttonActiveFill} pointerEvents="none" />
            ) : (
              <GlassSurface borderRadius={18} />
            )}
            {pressed && <View style={styles.buttonPressedOverlay} pointerEvents="none" />}
            <IconSymbol
              name="map.fill"
              size={18}
              color={mapOpen ? colors.accentOn : colors.textPrimary}
            />
          </>
        )}
      </Pressable>

      <Pressable
        onPress={onClose}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Close round"
        style={[styles.closeButton, { top: insets.top + 8 }]}>
        {({ pressed }) => (
          <>
            <GlassSurface borderRadius={18} />
            {pressed && <View style={styles.buttonPressedOverlay} pointerEvents="none" />}
            <IconSymbol name="xmark" size={18} color={colors.textPrimary} />
          </>
        )}
      </Pressable>
    </Screen>
  );
}

function PageDots({
  totalPages,
  currentPage,
  onJump,
}: {
  totalPages: number;
  currentPage: number;
  onJump: (page: number) => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.dotsContainer}>
      {Array.from({ length: totalPages }).map((_, i) => (
        <Pressable
          key={i}
          onPress={() => onJump(i)}
          hitSlop={{ top: 6, bottom: 6, left: 16, right: 16 }}
          accessibilityRole="button"
          accessibilityLabel={`Go to page ${i + 1}`}>
          <View style={[styles.dot, currentPage === i && styles.dotActive]} />
        </Pressable>
      ))}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  flex: { flex: 1 },
  closeButton: {
    position: 'absolute',
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
  },
  menuButton: {
    position: 'absolute',
    left: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
  },
  scorecardButton: {
    position: 'absolute',
    left: 56,
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
  },
  mapButton: {
    position: 'absolute',
    right: 56,
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 25,
    backgroundColor: colors.background,
  },
  buttonPressedOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
    backgroundColor: colors.accentMuted,
  },
  // Toggled-on state for the scorecard/map buttons: solid ink-filled circle
  // (selection convention) so it reads as "press again to exit".
  buttonActiveFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
    backgroundColor: colors.accent,
  },
  dotsContainer: {
    position: 'absolute',
    right: 10,
    top: 0,
    bottom: NAV_HEIGHT,
    justifyContent: 'center',
    gap: 14,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.borderStrong,
  },
  dotActive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
});
