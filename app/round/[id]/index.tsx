import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
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
import { ParPage } from '@/components/par-page';
import { PuttingPage } from '@/components/putting-page';
import { ScorePage } from '@/components/score-page';
import { Screen } from '@/components/screen';
import { ScrollHint } from '@/components/scroll-hint';
import { StickyHoleNav } from '@/components/sticky-hole-nav';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { type Palette } from '@/constants/theme';
import { useColors } from '@/constants/theme-context';
import {
  getHolesForRound,
  getPuttsForRound,
  getReview,
  getRound,
  getShotsForRound,
  setRoundCompletedAt,
} from '@/db/queries';
import type { Hole, Putt, Round, Shot } from '@/db/types';

const NAV_HEIGHT = 96;

export default function RoundScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { id, hole, page } = useLocalSearchParams<{
    id: string;
    hole?: string;
    page?: string;
  }>();
  const [round, setRound] = useState<Round | null>(null);
  const [holes, setHoles] = useState<Hole[]>([]);
  const [shots, setShots] = useState<Shot[]>([]);
  const [putts, setPutts] = useState<Putt[]>([]);
  const [holeNumber, setHoleNumber] = useState(() => {
    const n = parseInt(hole ?? '', 10);
    return Number.isFinite(n) && n >= 1 ? n : 1;
  });
  const [pageHeight, setPageHeight] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const didInitialJump = useRef(false);
  const insets = useSafeAreaInsets();

  const load = useCallback(async () => {
    if (!id) return;
    const [r, hs, ss, ps] = await Promise.all([
      getRound(id),
      getHolesForRound(id),
      getShotsForRound(id),
      getPuttsForRound(id),
    ]);
    setRound(r);
    setHoles(hs);
    setShots(ss);
    setPutts(ps);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

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
    const review = await getReview(id);
    const reviewComplete =
      review != null &&
      review.mostCostly != null &&
      review.decisionMakingRating != null &&
      review.commonMiss != null &&
      review.rangeFocus != null &&
      review.overallRating != null;
    if (reviewComplete) {
      if (!round?.completedAt) {
        await setRoundCompletedAt(id, new Date().toISOString());
      }
      router.replace(`/round/${id}/summary` as any);
    } else {
      router.replace(`/round/${id}/review` as any);
    }
  }, [id, round]);

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
                <ParPage
                  roundId={id}
                  hole={currentHole}
                  onChange={load}
                  onPicked={() => scrollToPage(1)}
                />
              </View>
              <View style={{ height: pageHeight }}>
                <ScorePage
                  roundId={id}
                  hole={currentHole}
                  onChange={load}
                  onPicked={() => scrollToPage(2)}
                />
              </View>
              {!isPar3 && (
                <View style={{ height: pageHeight }}>
                  <DrivePage
                    roundId={id}
                    hole={currentHole}
                    shotsForRound={shots}
                    onChange={load}
                  />
                </View>
              )}
              <View style={{ height: pageHeight }}>
                <ApproachPage
                  roundId={id}
                  hole={currentHole}
                  shotsForRound={shots}
                  onChange={load}
                />
              </View>
              <View style={{ height: pageHeight }}>
                <PuttingPage
                  roundId={id}
                  hole={currentHole}
                  putts={putts}
                  onChange={load}
                />
              </View>
              <View style={{ height: pageHeight }}>
                <HoleStatsPage
                  roundId={id}
                  hole={currentHole}
                  holes={holes}
                  onChange={load}
                />
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
  buttonPressedOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
    backgroundColor: colors.accentMuted,
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
