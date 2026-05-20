import { StyleSheet, View, type ViewProps } from 'react-native';

import { colors, spacing } from '@/constants/theme';

type ScreenProps = ViewProps & {
  padded?: boolean;
};

export function Screen({ children, padded = true, style, ...rest }: ScreenProps) {
  return (
    <View style={[styles.screen, padded && styles.padded, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  padded: {
    paddingHorizontal: spacing.md,
  },
});
