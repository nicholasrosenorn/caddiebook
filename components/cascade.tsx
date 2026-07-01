import { Children, isValidElement, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { sectionIn } from '@/lib/motion';

/**
 * Staggered reveal: lays its children out in a column and fades each valid child
 * in top-to-bottom (via `sectionIn`). Nulls/false pass through without consuming a
 * stagger slot. Entering only plays on mount, so callers replay it by remounting
 * (e.g. a `key` that changes per stats section).
 */
export function Cascade({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  let order = 0;
  return (
    <View style={style}>
      {Children.map(children, (child) => {
        if (!isValidElement(child)) return child;
        const entering = sectionIn(order);
        order += 1;
        return <Animated.View entering={entering}>{child}</Animated.View>;
      })}
    </View>
  );
}
