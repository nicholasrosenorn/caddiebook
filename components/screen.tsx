import { StyleSheet, View, type ViewProps } from 'react-native';

import { Paper } from '@/components/sketch';
import { colors, spacing } from '@/constants/theme';

type ScreenProps = ViewProps & {
  padded?: boolean;
  /** Show corner registration marks on the paper backdrop. */
  marks?: boolean;
  /** Render the paper grain backdrop. */
  paper?: boolean;
};

export function Screen({
  children,
  padded = true,
  marks = false,
  paper = true,
  style,
  ...rest
}: ScreenProps) {
  return (
    <View style={[styles.screen, style]} {...rest}>
      {paper && <Paper marks={marks} />}
      <View style={[styles.content, padded && styles.padded]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  padded: {
    paddingHorizontal: spacing.md,
  },
});
