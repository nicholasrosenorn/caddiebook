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

import { DEFAULT_AVATAR } from '@/components/avatar';
import { SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { spacing, type Palette, type FontSet } from '@/constants/theme';
import { useColors, useFontSet } from '@/constants/theme-context';
import { ObjectionableLanguageError, UsernameTakenError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/provider';
import { containsProfanity } from '@/lib/moderation/profanity';

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
  footer,
  contentStyle,
}: {
  initial: ProfileFormValues;
  submitLabel: string;
  onSaved?: () => void;
  header?: React.ReactNode;
  // Rendered below the submit button — the edit screen uses it for the
  // destructive "Delete account" action; onboarding omits it.
  footer?: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const { updateProfile } = useAuth();

  const [firstName, setFirstName] = useState(initial.firstName);
  const [lastName, setLastName] = useState(initial.lastName);
  // Usernames are lowercased as you type so what you see is what's stored.
  const [username, setUsername] = useState(initial.username);
  // Avatar is no longer user-selectable; we carry the existing value through on
  // save so a previously-chosen icon (or the default) is preserved.
  const [avatar] = useState(initial.avatar || DEFAULT_AVATAR);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedFirst = firstName.trim();
  const usernameValid = USERNAME_RE.test(username);
  const canSubmit = trimmedFirst.length > 0 && usernameValid && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setError(null);
    // Pre-check so the user gets immediate feedback; the server (422) is the
    // authoritative gate for objectionable language on profile fields.
    if (
      containsProfanity(trimmedFirst) ||
      containsProfanity(lastName) ||
      containsProfanity(username)
    ) {
      setError('Let’s keep names and handles clean — please pick something else.');
      return;
    }
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
      } else if (e instanceof ObjectionableLanguageError) {
        setError('Let’s keep names and handles clean — please pick something else.');
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

        {footer}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const colors = useColors();
  const fonts = useFontSet();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  return (
    <View style={styles.field}>
      <ThemedText type="caption">{label}</ThemedText>
      <SketchSurface seed={`field-${label}`} radius={10} style={styles.inputSurface}>
        {children}
      </SketchSurface>
    </View>
  );
}

const makeStyles = (colors: Palette, fonts: FontSet) =>
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
      fontFamily: fonts.serifBold,
      fontSize: 20,
      lineHeight: 27,
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
      fontFamily: fonts.serif,
      fontSize: 17,
      lineHeight: 23,
      color: colors.textPrimary,
      paddingVertical: spacing.sm,
    },
    usernameRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    at: {
      fontFamily: fonts.serif,
      fontSize: 17,
      lineHeight: 23,
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
      fontFamily: fonts.serif,
      fontSize: 17,
      lineHeight: 23,
      color: colors.accentOn,
    },
    disabled: {
      opacity: 0.45,
    },
    pressed: {
      opacity: 0.6,
    },
  });
