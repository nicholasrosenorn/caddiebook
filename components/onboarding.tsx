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
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, AVATAR_ICONS, DEFAULT_AVATAR } from '@/components/avatar';
import { Screen } from '@/components/screen';
import { SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { fontFamily, spacing, type Palette } from '@/constants/theme';
import { useColors } from '@/constants/theme-context';
import { UsernameTakenError } from '@/lib/api/client';
import { useSync } from '@/lib/sync/provider';

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export function Onboarding() {
  return (
    <SafeAreaProvider>
      <OnboardingContent />
    </SafeAreaProvider>
  );
}

function OnboardingContent() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { updateProfile } = useSync();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  // Usernames are lowercased as you type so what you see is what's stored.
  const [username, setUsername] = useState('');
  const [avatar, setAvatar] = useState<string>(DEFAULT_AVATAR);
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
      // Success re-renders the Gate into the app — nothing else to do here.
    } catch (e) {
      if (e instanceof UsernameTakenError) {
        setError('That username is taken — try another.');
      } else {
        setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
      }
      setBusy(false);
    }
  };

  return (
    <Screen marks>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <ThemedText type="caption">CADDIE BOOK</ThemedText>
            <ThemedText style={styles.title}>Set up{'\n'}your profile.</ThemedText>
            <ThemedText type="muted" style={styles.subtitle}>
              This is how you&apos;ll show up across your devices.
            </ThemedText>
          </View>

          <View style={styles.previewRow}>
            <Avatar avatar={avatar} size={84} seed="onboarding-preview" />
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
            accessibilityLabel="Finish setup"
            onPress={submit}
            style={({ pressed }) => [!canSubmit && styles.disabled, pressed && styles.pressed]}>
            <SketchSurface
              seed="onboarding-finish"
              radius={10}
              fill={colors.accent}
              stroke={colors.accent}
              style={styles.finishButton}>
              {busy ? (
                <ActivityIndicator color={colors.accentOn} />
              ) : (
                <ThemedText style={styles.finishLabel}>Finish</ThemedText>
              )}
            </SketchSurface>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
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
      gap: spacing.lg,
    },
    hero: {
      gap: spacing.xs,
    },
    title: {
      fontFamily: fontFamily.serifBold,
      fontSize: 32,
      lineHeight: 38,
      color: colors.textPrimary,
      marginTop: spacing.xs,
    },
    subtitle: {
      fontSize: 15,
      marginTop: spacing.xs,
      maxWidth: 320,
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
    finishButton: {
      minHeight: 52,
      alignItems: 'center',
      justifyContent: 'center',
    },
    finishLabel: {
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
