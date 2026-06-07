import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { fontFamily, spacing, type Palette } from '@/constants/theme';
import { useColors } from '@/constants/theme-context';
import { useSync } from '@/lib/sync/provider';

export default function ProfileScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { session } = useSync();
  const user = session?.user;

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();

  return (
    <Screen>
      <View style={styles.content}>
        <Avatar avatar={user?.avatar} size={120} seed="profile-avatar" />
        <View style={styles.identity}>
          <ThemedText style={styles.name}>{fullName || 'Golfer'}</ThemedText>
          {user?.username ? (
            <ThemedText type="muted" style={styles.handle}>
              @{user.username}
            </ThemedText>
          ) : null}
          {user?.email ? (
            <ThemedText type="muted" style={styles.email}>
              {user.email}
            </ThemedText>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    content: {
      alignItems: 'center',
      gap: spacing.md,
      paddingTop: spacing.xl,
    },
    identity: {
      alignItems: 'center',
      gap: spacing.xs,
    },
    name: {
      fontFamily: fontFamily.serifBold,
      fontSize: 26,
      color: colors.textPrimary,
    },
    handle: {
      fontSize: 16,
    },
    email: {
      fontSize: 13,
      color: colors.textMuted,
    },
  });
