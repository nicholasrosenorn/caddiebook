import { Alert, Pressable } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColors } from '@/constants/theme-context';

// A discreet (i) icon that surfaces a one-off explanation on tap. Keeps help
// text out of the layout until the user reaches for it.
export function InfoHint({
  title,
  message,
  size = 18,
  color,
}: {
  title: string;
  message: string;
  size?: number;
  color?: string;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={() => Alert.alert(title, message)}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={title}>
      <IconSymbol name="info.circle" size={size} color={color ?? colors.textMuted} />
    </Pressable>
  );
}
