import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Avatar, AVATAR_ICONS, DEFAULT_AVATAR } from '@/components/avatar';
import { SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamily, spacing, type Palette } from '@/constants/theme';
import { useColors } from '@/constants/theme-context';
import { UsernameTakenError } from '@/lib/api/client';
import { useSync } from '@/lib/sync/provider';

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export type ProfileFormValues = {
  firstName: string;
  lastName: string;
  username: string;
  avatar: string;
};

// Shared account-profile editor used by both onboarding and the settings "Edit
// profile" screen. Owns field state, validation, and the server write (with
// username-uniqueness handling); each host provides its own chrome via `header`
// and `contentStyle`. `onSaved` fires after a successful write — onboarding
// omits it (the Gate re-renders on the updated session), the edit screen uses it
// to navigate back.
export function ProfileForm({
  initial,
  submitLabel,
  onSaved,
  header,
  contentStyle,
}: {
  initial: ProfileFormValues;
  submitLabel: string;
  onSaved?: () => void;
  header?: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { updateProfile } = useSync();

  const [firstName, setFirstName] = useState(initial.firstName);
  const [lastName, setLastName] = useState(initial.lastName);
  // Usernames are lowercased as you type so what you see is what's stored.
  const [username, setUsername] = useState(initial.username);
  const [avatar, setAvatar] = useState(initial.avatar || DEFAULT_AVATAR);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedFirst = firstName.trim();
  const usernameValid = USERNAME_RE.test(username);
  const canSubmit = trimmedFirst.length > 0 && usernameValid && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setError(null);
    setBusy(true);
    try {
      await updateProfile({
        firstName: trimmedFirst,
        lastName: lastName.trim() || null,
        username,
        avatar,
      });
      onSaved?.();
    } catch (e) {
      if (e instanceof UsernameTakenError) {
        setError('That username is taken — try another.');
      } else {
        setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.content, contentStyle]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {header}

        <View style={styles.previewRow}>
          <Avatar avatar={avatar} size={84} seed="profile-form-preview" />
          <View style={styles.previewText}>
            <ThemedText style={styles.previewName}>
              {trimmedFirst || 'Your name'} {lastName.trim()}
            </ThemedText>
            <ThemedText type="muted" style={styles.previewHandle}>
              {usernameValid ? `@${username}` : '@username'}
            </ThemedText>
          </View>
        </View>

        <View style={styles.fields}>
          <Field label="FIRST NAME">
            <TextInput
              value={firstName}
              onChangeText={setFirstName}
              placeholder="Jordan"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              autoCapitalize="words"
              returnKeyType="next"
            />
          </Field>

          <Field label="LAST NAME">
            <TextInput
              value={lastName}
              onChangeText={setLastName}
              placeholder="Spieth"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              autoCapitalize="words"
              returnKeyType="next"
            />
          </Field>

          <Field label="USERNAME">
            <View style={styles.usernameRow}>
              <ThemedText style={styles.at}>@</ThemedText>
              <TextInput
                value={username}
                onChangeText={(t) => setUsername(t.toLowerCase().replace(/\s/g, ''))}
                placeholder="birdiemaker"
                placeholderTextColor={colors.textMuted}
                style={[styles.input, styles.usernameInput]}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={20}
                returnKeyType="done"
                onSubmitEditing={submit}
              />
            </View>
          </Field>
          <ThemedText type="muted" style={styles.hint}>
            3–20 characters: lowercase letters, numbers, underscore.
          </ThemedText>
        </View>

        <View style={styles.section}>
          <ThemedText type="caption">CHOOSE AN ICON</ThemedText>
          <View style={styles.iconGrid}>
            {AVATAR_ICONS.map((name) => {
              const selected = name === avatar;
              return (
                <Pressable
                  key={name}
                  onPress={() => setAvatar(name)}
                  accessibilityRole="button"
                  accessibilityLabel={`Avatar ${name}`}
                  accessibilityState={{ selected }}
                  style={({ pressed }) => pressed && styles.pressed}>
                  <SketchSurface
                    seed={`icon-${name}`}
                    radius={28}
                    fill={selected ? colors.accent : colors.surface}
                    stroke={selected ? colors.accent : colors.borderStrong}
                    strokeWidth={selected ? 2 : 1.3}
                    style={styles.iconTile}>
                    <IconSymbol
                      name={name}
                      size={26}
                      color={selected ? colors.accentOn : colors.textSecondary}
                    />
                  </SketchSurface>
                </Pressable>
              );
            })}
          </View>
        </View>

        {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

        <Pressable
          disabled={!canSubmit}
          accessibilityRole="button"
          accessibilityLabel={submitLabel}
          onPress={submit}
          style={({ pressed }) => [!canSubmit && styles.disabled, pressed && styles.pressed]}>
          <SketchSurface
            seed="profile-form-submit"
            radius={10}
            fill={colors.accent}
            stroke={colors.accent}
            style={styles.submitButton}>
            {busy ? (
              <ActivityIndicator color={colors.accentOn} />
            ) : (
              <ThemedText style={styles.submitLabel}>{submitLabel}</ThemedText>
            )}
          </SketchSurface>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.field}>
      <ThemedText type="caption">{label}</ThemedText>
      <SketchSurface seed={`field-${label}`} radius={10} style={styles.inputSurface}>
        {children}
      </SketchSurface>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    flex: { flex: 1 },
    content: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.lg,
      gap: spacing.lg,
    },
    previewRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    previewText: {
      flex: 1,
      gap: 2,
    },
    previewName: {
      fontFamily: fontFamily.serifBold,
      fontSize: 20,
      color: colors.textPrimary,
    },
    previewHandle: {
      fontSize: 14,
    },
    fields: {
      gap: spacing.sm,
    },
    field: {
      gap: 4,
    },
    inputSurface: {
      paddingHorizontal: spacing.md,
      justifyContent: 'center',
      minHeight: 50,
    },
    input: {
      fontFamily: fontFamily.serif,
      fontSize: 17,
      color: colors.textPrimary,
      paddingVertical: spacing.sm,
    },
    usernameRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    at: {
      fontFamily: fontFamily.serif,
      fontSize: 17,
      color: colors.textMuted,
    },
    usernameInput: {
      flex: 1,
      marginLeft: 2,
    },
    hint: {
      fontSize: 12,
      marginTop: 2,
    },
    section: {
      gap: spacing.sm,
    },
    iconGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    iconTile: {
      width: 56,
      height: 56,
      alignItems: 'center',
      justifyContent: 'center',
    },
    error: {
      color: colors.danger,
      fontSize: 14,
    },
    submitButton: {
      minHeight: 52,
      alignItems: 'center',
      justifyContent: 'center',
    },
    submitLabel: {
      fontFamily: fontFamily.serif,
      fontSize: 17,
      color: colors.accentOn,
    },
    disabled: {
      opacity: 0.45,
    },
    pressed: {
      opacity: 0.6,
    },
  });
