import { useMemo } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { Paper } from '@/components/sketch';
import { spacing, type Palette } from '@/constants/theme';
import { useColors } from '@/constants/theme-context';

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
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={[styles.screen, style]} {...rest}>
      {paper && <Paper marks={marks} />}
      <View style={[styles.content, padded && styles.padded]}>{children}</View>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
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
