import { router } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Alert, Pressable, StyleSheet } from 'react-native';

import { DEFAULT_AVATAR } from '@/components/avatar';
import { ProfileForm } from '@/components/profile-form';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { type FontSet, type Palette } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';
import { useAuth } from '@/lib/auth/provider';

export default function EditProfileScreen() {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const { session, deleteAccount } = useAuth();
  const user = session?.user;

  // Two destructive confirmations gate the permanent, irreversible delete.
  const confirmDeleteAccount = useCallback(() => {
    Alert.alert(
      'Delete account?',
      'This permanently erases your rounds, stats, journal, and friends. It cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () =>
            Alert.alert('This cannot be undone', 'Your account and all of its data will be deleted.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete account',
                style: 'destructive',
                onPress: () =>
                  void deleteAccount().catch(() =>
                    Alert.alert(
                      "Couldn't delete your account",
                      'Check your connection and try again.',
                    ),
                  ),
              },
            ]),
        },
      ],
    );
  }, [deleteAccount]);

  return (
    <Screen>
      <ProfileForm
        initial={{
          firstName: user?.firstName ?? '',
          lastName: user?.lastName ?? '',
          username: user?.username ?? '',
          avatar: user?.avatar ?? DEFAULT_AVATAR,
        }}
        submitLabel="Save changes"
        onSaved={() => router.back()}
        footer={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Delete account"
            onPress={confirmDeleteAccount}
            style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}>
            <ThemedText style={styles.deleteLabel}>Delete account</ThemedText>
          </Pressable>
        }
      />
    </Screen>
  );
}

const makeStyles = (colors: Palette, fonts: FontSet) =>
  StyleSheet.create({
    deleteButton: {
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    deleteLabel: {
      fontFamily: fonts.serif,
      fontSize: 15,
      color: colors.danger,
    },
    pressed: {
      opacity: 0.6,
    },
  });
