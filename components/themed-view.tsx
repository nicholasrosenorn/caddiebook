import { View, type ViewProps } from 'react-native';

import { colors } from '@/constants/theme';

export function ThemedView({ style, ...rest }: ViewProps) {
  return <View style={[{ backgroundColor: colors.background }, style]} {...rest} />;
}
