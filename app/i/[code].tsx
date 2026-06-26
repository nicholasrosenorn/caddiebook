import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { PressableScale } from '@/components/pressable-scale';
import { Screen } from '@/components/screen';
import { SketchSurface, TopoChip } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { spacing, type FontSet, type Palette } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';
import { redeemInvite } from '@/lib/api/client';
import type { PublicProfile, RedeemInviteResponse } from '@/lib/api/types';
import { useAuth } from '@/lib/auth/provider';

type State =
  | { phase: 'loading' }
  | { phase: 'done'; result: RedeemInviteResponse }
  | { phase: 'error' };

// Landing screen for an opened invite link (https://…/i/<code>). Redeems the code
// on mount — which auto-friends both accounts — and shows the outcome.
export default function RedeemInviteScreen() {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const { code } = useLocalSearchParams<{ code: string }>();
  const { session } = useAuth();
  const [state, setState] = useState<State>({ phase: 'loading' });
  const ran = useRef(false);

  useEffect(() => {
    // Wait for a session (the redeem endpoint is authenticated) and run once.
    if (ran.current || !session || !code) return;
    ran.current = true;
    redeemInvite(code)
      .then((result) => setState({ phase: 'done', result }))
      .catch(() => setState({ phase: 'error' }));
  }, [session, code]);

  const goToClubhouse = () => router.replace('/(tabs)/(community)/community' as any);

  if (state.phase === 'loading') {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
          <ThemedText type="muted">Connecting…</ThemedText>
        </View>
      </Screen>
    );
  }

  if (state.phase === 'error') {
    return (
      <Screen>
        <View style={styles.center}>
          <TopoChip seed="invite-error" />
          <ThemedText type="subtitle">That link didn’t work</ThemedText>
          <ThemedText type="muted" style={styles.copy}>
            The invite may have been removed. Try asking your friend for a fresh link.
          </ThemedText>
          <CtaButton label="Go to Clubhouse" onPress={goToClubhouse} colors={colors} styles={styles} />
        </View>
      </Screen>
    );
  }

  const { result } = state;
  const friend: PublicProfile | null = result.status === 'self' ? null : result.friend;
  const name = friend?.firstName || (friend?.username ? `@${friend.username}` : 'your friend');
  const heading =
    result.status === 'self'
      ? 'This is your invite link'
      : result.status === 'already'
        ? `You’re already friends with ${name}`
        : `You’re now friends with ${name}`;
  const body =
    result.status === 'self'
      ? 'Share it with friends so they can connect with you.'
      : 'Their rounds will show up in your Clubhouse feed.';

  return (
    <Screen>
      <View style={styles.center}>
        {friend ? (
          <Avatar avatar={friend.avatar} size={88} seed={`invite-av-${friend.id}`} />
        ) : (
          <TopoChip seed="invite-self" />
        )}
        <ThemedText type="subtitle" style={styles.heading}>
          {heading}
        </ThemedText>
        <ThemedText type="muted" style={styles.copy}>
          {body}
        </ThemedText>
        <CtaButton label="Go to Clubhouse" onPress={goToClubhouse} colors={colors} styles={styles} />
      </View>
    </Screen>
  );
}

function CtaButton({
  label,
  onPress,
  colors,
  styles,
}: {
  label: string;
  onPress: () => void;
  colors: Palette;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" style={styles.ctaWrap}>
      <SketchSurface
        seed="invite-cta"
        fill={colors.accent}
        stroke={colors.accent}
        radius={10}
        style={styles.cta}>
        <ThemedText style={styles.ctaLabel}>{label}</ThemedText>
      </SketchSurface>
    </PressableScale>
  );
}

const makeStyles = (colors: Palette, fonts: FontSet) =>
  StyleSheet.create({
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    heading: {
      textAlign: 'center',
    },
    copy: {
      textAlign: 'center',
      maxWidth: 300,
    },
    ctaWrap: {
      marginTop: spacing.md,
      minHeight: 48,
      alignSelf: 'stretch',
    },
    cta: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 48,
    },
    ctaLabel: {
      fontFamily: fonts.serif,
      fontSize: 16,
      lineHeight: 22,
      color: colors.accentOn,
    },
  });
