import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline, type Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/glass-surface';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { spacing, type FontSet, type Palette } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';
import { useStatsBundle } from '@/lib/data/stats';
import { bearingDeg, destinationPoint, haversineYards, type LatLng } from '@/lib/geo';
import { APPROACH_RINGS } from '@/lib/shots';

// ~quarter-mile viewport — roughly one hole.
const REGION_DELTA = 0.004;
// Camera altitude per meter of shot length: sizes the zoom so the user→target
// line fills most of the screen with surrounding context. Tune to taste.
const ALTITUDE_PER_METER = 2.5;
const MIN_ALTITUDE_M = 400;
const MAX_ALTITUDE_M = 4000;
// Approximate rendered height of the yardage chip; used as map padding so the
// camera keeps the blue dot above it.
const CHIP_AREA_HEIGHT = 76;
const METERS_PER_YARD = 0.9144;
// Target zoom mode is green-scale: ticks at 5 / 10 / 15 yds from the target
// in every direction on both axes.
const TICK_STEP_YDS = 5;
// How much ground (vertically) the entry framing shows around the target —
// the ±15 yd axes plus margin. Deliberately below MIN_ALTITUDE_M; that
// clamp is for the full-shot framing only.
const ZOOM_ENTRY_SPAN_YDS = 60;
// Zooming out past this much visible ground auto-exits zoom mode back to
// the dot → target framing.
const ZOOM_EXIT_SPAN_YDS = 120;
// Dispersion overlay: historical approaches from holes played within this
// many yards of the live target distance.
const DISPERSION_WINDOW_YDS = 15;
// Approach shots store (xNorm, yNorm) with the pin at (0.5, 0.5); the outer
// ring's normalized radius ↔ feet pair sets the physical scale.
const OUTER_RING = APPROACH_RINGS[APPROACH_RINGS.length - 1];
const FT_PER_NORM = OUTER_RING.ft / OUTER_RING.maxR;
const METERS_PER_FOOT = 0.3048;

type ApproachSample = {
  key: string;
  xNorm: number;
  yNorm: number;
  distanceYds: number;
};

type PermissionState = 'pending' | 'granted' | 'denied';

export function MapPage() {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const insets = useSafeAreaInsets();
  const overlayBottom = insets.bottom + spacing.lg;
  const mapRef = useRef<MapView>(null);
  const [permission, setPermission] = useState<PermissionState>('pending');
  const [initialRegion, setInitialRegion] = useState<Region | null>(null);
  const [userLoc, setUserLoc] = useState<LatLng | null>(null);
  // Ephemeral PoC: the target lives in component state only — nothing persists.
  const [target, setTarget] = useState<LatLng | null>(null);
  // Target zoom mode ("green view"): camera tight on the target with
  // crosshair axes for reading long/short and left/right misses.
  const [zoomedIn, setZoomedIn] = useState(false);
  const [dispersionOn, setDispersionOn] = useState(false);
  const { data: statsData } = useStatsBundle();

  const requestLocation = useCallback(async () => {
    setPermission('pending');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setPermission('denied');
        return;
      }
      setPermission('granted');
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coord = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      };
      setUserLoc(coord);
      setInitialRegion({
        ...coord,
        latitudeDelta: REGION_DELTA,
        longitudeDelta: REGION_DELTA,
      });
    } catch (err) {
      console.error(err);
      setPermission('denied');
    }
  }, []);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  // Historical approach shots from completed rounds, joined to their hole's
  // approach distance — the corpus the zoom-mode dispersion overlay windows.
  // Derived from the shared cached stats bundle (one server read app-wide).
  const history = useMemo<ApproachSample[]>(() => {
    if (!statsData) return [];
    const { rounds, holes, shots } = statsData;
    const completed = new Set(rounds.filter((r) => r.completedAt != null).map((r) => r.id));
    const holeByKey = new Map(holes.map((h) => [`${h.roundId}:${h.holeNumber}`, h]));
    const samples: ApproachSample[] = [];
    for (const shot of shots) {
      if (shot.shotType !== 'approach') continue;
      if (!completed.has(shot.roundId)) continue;
      const hole = holeByKey.get(`${shot.roundId}:${shot.holeNumber}`);
      if (!hole || hole.approachDistanceYds == null || hole.greenBlocked) continue;
      samples.push({
        key: shot.id,
        xNorm: shot.xNorm,
        yNorm: shot.yNorm,
        distanceYds: hole.approachDistanceYds,
      });
    }
    return samples;
  }, [statsData]);

  // Frame the full shot: rotate so the player looks "up" the line (blue dot
  // below, pin above), center on the midpoint, and zoom to fit the shot
  // length. Altitude is Apple Maps' zoom control; Android's Google provider
  // would need a `zoom` value instead.
  const frameShot = (coord: LatLng) => {
    if (!userLoc) return;
    const meters = haversineYards(userLoc, coord) * METERS_PER_YARD;
    mapRef.current?.animateCamera(
      {
        heading: bearingDeg(userLoc, coord),
        center: {
          latitude: (userLoc.latitude + coord.latitude) / 2,
          longitude: (userLoc.longitude + coord.longitude) / 2,
        },
        altitude: Math.min(MAX_ALTITUDE_M, Math.max(MIN_ALTITUDE_M, meters * ALTITUDE_PER_METER)),
      },
      { duration: 350 },
    );
  };

  const placeTarget = (coord: LatLng) => {
    setTarget(coord);
    if (!userLoc) return;
    if (zoomedIn) {
      // Stay zoomed: re-center on the new target at the current pinch level.
      mapRef.current?.animateCamera(
        { heading: bearingDeg(userLoc, coord), center: coord },
        { duration: 350 },
      );
    } else {
      frameShot(coord);
    }
  };

  const enterZoom = () => {
    if (!userLoc || !target) return;
    setZoomedIn(true);
    mapRef.current?.animateCamera(
      {
        heading: bearingDeg(userLoc, target),
        center: target,
        altitude: ZOOM_ENTRY_SPAN_YDS * METERS_PER_YARD * ALTITUDE_PER_METER,
      },
      { duration: 350 },
    );
  };

  const exitZoom = () => {
    setZoomedIn(false);
    if (target) frameShot(target);
  };

  const recenter = () => {
    if (!userLoc) return;
    mapRef.current?.animateToRegion(
      { ...userLoc, latitudeDelta: REGION_DELTA, longitudeDelta: REGION_DELTA },
      300,
    );
  };

  const distanceYds =
    userLoc && target ? Math.round(haversineYards(userLoc, target)) : null;

  // Zoom-mode crosshair axes through the target: the depth axis runs along
  // the shot line, the lateral axis perpendicular. Both carry ticks at
  // 5 / 10 / 15 yds from the target — a short dash crossing the axis with a
  // white number beside it.
  const zoomGrid = useMemo(() => {
    if (!zoomedIn || !userLoc || !target) return null;
    const bearing = bearingDeg(userLoc, target);
    const stepM = TICK_STEP_YDS * METERS_PER_YARD;
    const extentM = 3.4 * stepM;
    const dashHalfM = 1 * METERS_PER_YARD;
    const along = (m: number) => destinationPoint(target, bearing, m);
    const across = (m: number) => destinationPoint(target, bearing + 90, m);
    const offsets = [-3, -2, -1, 1, 2, 3];
    return {
      axes: [
        [along(-extentM), along(extentM)],
        [across(-extentM), across(extentM)],
      ],
      ticks: [
        // Depth (shot-line) ticks: labels sit to the right of the axis.
        ...offsets.map((i) => {
          const point = along(i * stepM);
          return {
            key: `d${i}`,
            point,
            dash: [
              destinationPoint(point, bearing + 90, -dashHalfM),
              destinationPoint(point, bearing + 90, dashHalfM),
            ],
            label: `${Math.abs(i) * TICK_STEP_YDS}`,
            labelOffset: { x: 18, y: 0 },
          };
        }),
        // Lateral ticks: labels sit below the axis.
        ...offsets.map((i) => {
          const point = across(i * stepM);
          return {
            key: `l${i}`,
            point,
            dash: [
              destinationPoint(point, bearing, -dashHalfM),
              destinationPoint(point, bearing, dashHalfM),
            ],
            label: `${Math.abs(i) * TICK_STEP_YDS}`,
            labelOffset: { x: 0, y: 18 },
          };
        }),
      ],
    };
  }, [zoomedIn, userLoc, target]);

  // Project historical approach misses around the live target: each stored
  // (xNorm, yNorm) converts to long/short + left/right feet relative to the
  // pin, rotated so "long" runs along the shot bearing.
  const dispersion = useMemo(() => {
    if (!zoomedIn || !dispersionOn || !userLoc || !target || distanceYds == null) {
      return null;
    }
    const inWindow = history.filter(
      (s) => Math.abs(s.distanceYds - distanceYds) <= DISPERSION_WINDOW_YDS,
    );
    if (inWindow.length === 0) return null;
    const bearing = bearingDeg(userLoc, target);
    return {
      count: inWindow.length,
      lo: Math.max(0, distanceYds - DISPERSION_WINDOW_YDS),
      hi: distanceYds + DISPERSION_WINDOW_YDS,
      points: inWindow.map((s) => {
        const dxM = (s.xNorm - 0.5) * FT_PER_NORM * METERS_PER_FOOT;
        const dyM = (0.5 - s.yNorm) * FT_PER_NORM * METERS_PER_FOOT;
        return {
          key: s.key,
          point: destinationPoint(destinationPoint(target, bearing, dyM), bearing + 90, dxM),
        };
      }),
    };
  }, [zoomedIn, dispersionOn, userLoc, target, distanceYds, history]);

  // Zooming out even a little past the entry framing dismisses zoom mode
  // back to the standard dot → target framing.
  const onRegionChangeComplete = (region: Region) => {
    if (!zoomedIn) return;
    const spanYds = region.latitudeDelta * 111132 * 1.09361;
    if (spanYds > ZOOM_EXIT_SPAN_YDS) exitZoom();
  };

  if (permission === 'denied') {
    return (
      <View style={styles.fallback}>
        <ThemedText type="caption">GPS</ThemedText>
        <ThemedText type="title">Location unavailable</ThemedText>
        <ThemedText type="muted" style={styles.fallbackHint}>
          Allow location access to see live yardages on the course map. If you
          previously declined, enable it in Settings.
        </ThemedText>
        <Pressable
          onPress={requestLocation}
          style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
          <ThemedText style={styles.retryLabel}>Allow location</ThemedText>
        </Pressable>
      </View>
    );
  }

  if (initialRegion == null) {
    return (
      <View style={styles.fallback}>
        <ThemedText type="muted">Locating…</ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        mapType="satellite"
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        rotateEnabled={false}
        pitchEnabled={false}
        // Apple Maps clamps satellite zoom to imagery availability, which in
        // rural areas stops well short of green scale; explicitly allowing a
        // close camera distance overrides that (tiles upscale past native
        // resolution).
        cameraZoomRange={{ minCenterCoordinateDistance: 60 }}
        // Treat the yardage-chip strip and the status bar / Dynamic Island
        // area as obstructed so camera centering (snap-to-target, recenter)
        // frames the shot between them.
        mapPadding={{
          top: insets.top,
          left: 0,
          right: 0,
          bottom: overlayBottom + CHIP_AREA_HEIGHT,
        }}
        onUserLocationChange={(e) => {
          const c = e.nativeEvent.coordinate;
          if (c) setUserLoc({ latitude: c.latitude, longitude: c.longitude });
        }}
        onRegionChangeComplete={onRegionChangeComplete}
        onPress={(e) => {
          // Marker taps (e.g. tick pills) also fire the map's onPress —
          // ignore them so they don't retarget.
          if ((e.nativeEvent as { action?: string }).action === 'marker-press') return;
          placeTarget(e.nativeEvent.coordinate);
        }}>
        {userLoc && target && (
          <Polyline
            coordinates={[userLoc, target]}
            strokeColor="rgba(255,255,255,0.9)"
            strokeWidth={2}
          />
        )}
        {target && (
          <Marker
            coordinate={target}
            anchor={{ x: 0.5, y: 0.5 }}
            draggable
            onDrag={(e) => setTarget(e.nativeEvent.coordinate)}
            onDragEnd={(e) => placeTarget(e.nativeEvent.coordinate)}>
            <View style={styles.crosshair} pointerEvents="none">
              <View style={styles.crosshairRing} />
              <View style={styles.crosshairDot} />
            </View>
          </Marker>
        )}
        {zoomGrid && (
          <>
            {zoomGrid.axes.map((coords, i) => (
              <Polyline
                key={`axis-${i}`}
                coordinates={coords}
                strokeColor="rgba(255,255,255,0.85)"
                strokeWidth={1.5}
              />
            ))}
            {zoomGrid.ticks.map((t) => (
              <Polyline
                key={`${t.key}-dash`}
                coordinates={t.dash}
                strokeColor="rgba(255,255,255,0.9)"
                strokeWidth={1.5}
              />
            ))}
            {zoomGrid.ticks.map((t) => (
              <Marker
                key={t.key}
                coordinate={t.point}
                anchor={{ x: 0.5, y: 0.5 }}
                centerOffset={t.labelOffset}>
                <ThemedText style={styles.tickText} pointerEvents="none">
                  {t.label}
                </ThemedText>
              </Marker>
            ))}
          </>
        )}
        {dispersion?.points.map((p) => (
          <Marker key={p.key} coordinate={p.point} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.dispersionDot} pointerEvents="none" />
          </Marker>
        ))}
      </MapView>

      <View style={[styles.chip, { bottom: overlayBottom }]} pointerEvents="none">
        <GlassSurface borderRadius={14} />
        {distanceYds != null ? (
          <>
            <View style={styles.chipReadout}>
              <ThemedText style={styles.chipNumber}>{distanceYds}</ThemedText>
              <ThemedText style={styles.chipUnit}>yds</ThemedText>
            </View>
            {dispersion != null && (
              <ThemedText style={styles.chipCaption}>
                {dispersion.count} {dispersion.count === 1 ? 'shot' : 'shots'} ·{' '}
                {dispersion.lo}–{dispersion.hi} yds
              </ThemedText>
            )}
          </>
        ) : (
          <ThemedText type="muted" style={styles.chipHint}>
            Tap the map to set a target
          </ThemedText>
        )}
      </View>

      <Pressable
        onPress={recenter}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Recenter on my location"
        style={[styles.recenterButton, { bottom: overlayBottom }]}>
        {({ pressed }) => (
          <>
            <GlassSurface borderRadius={20} />
            {pressed && <View style={styles.pressedOverlay} pointerEvents="none" />}
            <IconSymbol name="location.fill" size={18} color={colors.textPrimary} />
          </>
        )}
      </Pressable>

      {zoomedIn && (
        <Pressable
          onPress={() => setDispersionOn((v) => !v)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={dispersionOn ? 'Hide shot dispersion' : 'Show shot dispersion'}
          style={[styles.dispersionButton, { bottom: overlayBottom + 48 }]}>
          {({ pressed }) => (
            <>
              <GlassSurface borderRadius={20} />
              {pressed && <View style={styles.pressedOverlay} pointerEvents="none" />}
              <IconSymbol
                name="aqi.medium"
                size={18}
                color={dispersionOn ? colors.accent : colors.textPrimary}
              />
            </>
          )}
        </Pressable>
      )}

      {target != null && (
        <Pressable
          onPress={zoomedIn ? exitZoom : enterZoom}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={zoomedIn ? 'Exit target zoom' : 'Zoom to target'}
          style={[styles.zoomButton, { bottom: overlayBottom }]}>
          {({ pressed }) => (
            <>
              <GlassSurface borderRadius={20} />
              {pressed && <View style={styles.pressedOverlay} pointerEvents="none" />}
              <IconSymbol
                name="magnifyingglass"
                size={18}
                color={zoomedIn ? colors.accent : colors.textPrimary}
              />
            </>
          )}
        </Pressable>
      )}
    </View>
  );
}

const makeStyles = (colors: Palette, fonts: FontSet) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    fallback: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
      paddingBottom: 100,
      gap: spacing.sm,
    },
    fallbackHint: {
      textAlign: 'center',
    },
    retryButton: {
      marginTop: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: 999,
      backgroundColor: colors.accent,
    },
    retryLabel: {
      color: colors.accentOn,
      fontWeight: '600',
    },
    pressed: {
      opacity: 0.7,
    },
    crosshair: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    crosshairRing: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: 18,
      borderWidth: 2,
      borderColor: colors.accentOn,
    },
    crosshairDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.accentOn,
    },
    chip: {
      position: 'absolute',
      alignSelf: 'center',
      alignItems: 'center',
      gap: 2,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: 14,
      overflow: 'hidden',
    },
    chipReadout: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: spacing.xs,
    },
    chipNumber: {
      fontFamily: fonts.serif,
      fontSize: 30,
      lineHeight: 36,
      color: colors.accent,
    },
    chipUnit: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    chipHint: {
      paddingVertical: spacing.xs,
    },
    chipCaption: {
      fontSize: 11,
      lineHeight: 14,
      color: colors.textSecondary,
    },
    recenterButton: {
      position: 'absolute',
      left: spacing.md,
      width: 40,
      height: 40,
      borderRadius: 20,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },
    zoomButton: {
      position: 'absolute',
      right: spacing.md,
      width: 40,
      height: 40,
      borderRadius: 20,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },
    dispersionButton: {
      position: 'absolute',
      right: spacing.md,
      width: 40,
      height: 40,
      borderRadius: 20,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },
    dispersionDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.accent,
      borderWidth: 1,
      borderColor: '#FFFFFF',
      opacity: 0.55,
    },
    tickText: {
      fontFamily: fonts.serif,
      fontSize: 11,
      lineHeight: 14,
      color: '#FFFFFF',
      textShadowColor: 'rgba(0,0,0,0.6)',
      textShadowRadius: 3,
    },
    pressedOverlay: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: 20,
      backgroundColor: colors.accentMuted,
    },
  });
