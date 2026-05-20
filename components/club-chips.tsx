import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { SketchSurface } from '@/components/sketch';
import { ThemedText } from '@/components/themed-text';
import { CLUB_OPTIONS, OTHER_CLUB } from '@/constants/clubs';
import { colors, fontFamily, radius, spacing } from '@/constants/theme';

type Props = {
  value: string | null;
  onChange: (next: string | null) => void;
  // The club set to offer (the player's bag). Defaults to every club.
  clubs?: readonly string[];
};

// Inline, tap-first club selector: a horizontal strip of chips (selection
// convention — filled green when active, paper + drawn outline otherwise).
export function ClubChips({ value, onChange, clubs = CLUB_OPTIONS }: Props) {
  const isStandard = value != null && (CLUB_OPTIONS as readonly string[]).includes(value);
  const showOther = value != null && !isStandard;
  // If a previously-saved standard club isn't in the bag, still show it so the
  // existing selection stays visible/selectable.
  const displayClubs =
    isStandard && value != null && !clubs.includes(value) ? [value, ...clubs] : clubs;

  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.row}>
        {displayClubs.map((club) => (
          <Chip
            key={club}
            label={club}
            selected={value === club}
            // tapping the selected chip again clears it
            onPress={() => onChange(value === club ? null : club)}
          />
        ))}
        <Chip
          label={OTHER_CLUB}
          selected={showOther}
          onPress={() => onChange(showOther ? null : '')}
        />
      </ScrollView>

      {showOther ? (
        <TextInput
          autoFocus
          value={value ?? ''}
          onChangeText={onChange}
          placeholder="Type club name"
          placeholderTextColor={colors.textMuted}
          style={styles.otherInput}
          returnKeyType="done"
        />
      ) : null}
    </View>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      <SketchSurface
        seed={`club-${label}`}
        radius={radius.pill}
        fill={selected ? colors.accent : colors.surface}
        stroke={selected ? colors.accent : colors.borderStrong}
        grain={selected}
        style={styles.chip}>
        <ThemedText style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
          {label}
        </ThemedText>
      </SketchSurface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: 2,
    paddingRight: spacing.md,
  },
  chip: {
    minWidth: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipLabel: {
    fontFamily: fontFamily.serif,
    fontSize: 16,
    color: colors.textPrimary,
  },
  chipLabelSelected: {
    color: colors.accentOn,
  },
  pressed: {
    opacity: 0.6,
  },
  otherInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 16,
    color: colors.textPrimary,
  },
});
