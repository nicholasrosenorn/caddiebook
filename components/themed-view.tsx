import { View, type ViewProps } from 'react-native';

import { useColors } from '@/constants/theme-context';

export function ThemedView({ style, ...rest }: ViewProps) {
  const colors = useColors();
  return <View style={[{ backgroundColor: colors.background }, style]} {...rest} />;
}
