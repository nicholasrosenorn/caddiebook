import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
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
import { HoleStatsPage } from '@/components/hole-stats-page';
import { HoleStepper } from '@/components/hole-stepper';
import { ParPage } from '@/components/par-page';
import { PuttingPage } from '@/components/putting-page';
import { Screen } from '@/components/screen';
import { ScrollHint } from '@/components/scroll-hint';
import { StickyHoleNav } from '@/components/sticky-hole-nav';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { type Palette } from '@/constants/theme';
import { useColors } from '@/constants/theme-context';
import {
  getHolesForRound,
  getPuttsForRound,
  getRound,
  getShotsForRound,
} from '@/db/queries';
import type { Hole, Putt, Round, Shot } from '@/db/types';

const NAV_HEIGHT = 96;

export default function RoundScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const [round, setRound] = useState<Round | null>(null);
  const [holes, setHoles] = useState<Hole[]>([]);
  const [shots, setShots] = useState<Shot[]>([]);
  const [putts, setPutts] = useState<Putt[]>([]);
  const [holeNumber, setHoleNumber] = useState(1);
  const [pageHeight, setPageHeight] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
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
  const totalPages = isPar3 ? 4 : 5;
  const isStatsPage = currentPage === totalPages - 1;

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
  const onClose = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/' as any);
    }
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

            <PageDots totalPages={totalPages} currentPage={currentPage} />

            {isStatsPage ? (
              <StickyHoleNav
                holeNumber={holeNumber}
                par={currentHole.par}
                isFirstHole={isFirstHole}
                isLastHole={isLastHole}
                onPrev={onPrevHole}
                onNext={onNextHole}
                onFinish={onFinish}
              />
            ) : (
              <>
                <HoleStepper
                  holeNumber={holeNumber}
                  par={currentHole.par}
                  isFirstHole={isFirstHole}
                  isLastHole={isLastHole}
                  onPrev={onPrevHole}
                  onNext={onNextHole}
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
        onPress={() => router.push('/menu')}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Open menu"
        style={({ pressed }) => [
          styles.menuButton,
          { top: insets.top + 8 },
          pressed && styles.closeButtonPressed,
        ]}>
        <IconSymbol name="line.3.horizontal" size={18} color={colors.textPrimary} />
      </Pressable>

      <Pressable
        onPress={onClose}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Close round"
        style={({ pressed }) => [
          styles.closeButton,
          { top: insets.top + 8 },
          pressed && styles.closeButtonPressed,
        ]}>
        <IconSymbol name="xmark" size={18} color={colors.textPrimary} />
      </Pressable>
    </Screen>
  );
}

function PageDots({
  totalPages,
  currentPage,
}: {
  totalPages: number;
  currentPage: number;
}) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.dotsContainer} pointerEvents="none">
      {Array.from({ length: totalPages }).map((_, i) => (
        <View
          key={i}
          style={[styles.dot, currentPage === i && styles.dotActive]}
        />
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
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
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
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
  },
  closeButtonPressed: {
    backgroundColor: colors.accentMuted,
  },
  dotsContainer: {
    position: 'absolute',
    right: 10,
    top: 0,
    bottom: NAV_HEIGHT,
    justifyContent: 'center',
    gap: 8,
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
