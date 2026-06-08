import { type ReactNode, useMemo, useState } from 'react';
import {
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  UIManager,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { spacing, type Palette } from '@/constants/theme';
import { useColors } from '@/constants/theme-context';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// A furl/unfurl section in the drawn language. The header is a serif caption
// (with an optional one-line summary of the furled state) plus a chevron that
// rotates as it opens. Body is shown/hidden with a cheap layout animation —
// no height measurement needed.
export function Collapsible({
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [open, setOpen] = useState(defaultOpen);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((v) => !v);
  };

  return (
    <View>
      <Pressable
        style={styles.header}
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}>
        <View style={styles.headerText}>
          <ThemedText type="caption">{title}</ThemedText>
          {summary && !open ? (
            <ThemedText style={styles.summary}>{summary}</ThemedText>
          ) : null}
        </View>
        <IconSymbol
          name="chevron.right"
          size={20}
          color={colors.textMuted}
          style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}
        />
      </Pressable>
      {open ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
    },
    headerText: {
      flex: 1,
      gap: 2,
    },
    summary: {
      fontSize: 13,
      color: colors.textMuted,
    },
    body: {
      gap: spacing.md,
      paddingTop: spacing.xs,
    },
  });
