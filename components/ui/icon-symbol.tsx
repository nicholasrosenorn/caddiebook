// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<SymbolViewProps['name'], ComponentProps<typeof MaterialIcons>['name']>;
export type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'chevron.down': 'keyboard-arrow-down',
  'arrowtriangle.down.fill': 'arrow-drop-down',
  'list.bullet': 'format-list-bulleted',
  'line.3.horizontal': 'menu',
  'chart.bar.fill': 'bar-chart',
  'plus': 'add',
  'plus.circle.fill': 'add-circle',
  'info.circle': 'info-outline',
  'lightbulb.fill': 'lightbulb',
  'sparkles': 'auto-awesome',
  'figure.golf': 'sports-golf',
  'checkmark': 'check',
  'xmark': 'close',
  'chevron.left': 'chevron-left',
  // Moderation + safety.
  'ellipsis': 'more-horiz',
  'flag': 'flag',
  'hand.raised': 'block',
  'checkmark.shield': 'verified-user',
  'doc.text': 'description',
  'envelope': 'mail-outline',
  'arrow.uturn.backward': 'undo',
  'bolt.fill': 'bolt',
  'clock': 'schedule',
  'play.fill': 'play-arrow',
  'stop.fill': 'stop',
  'gearshape': 'settings',
  'magnifyingglass': 'search',
  'trash': 'delete-outline',
  'pencil': 'edit',
  // Profile + avatar glyphs.
  'person.crop.circle': 'account-circle',
  'person.fill': 'person',
  'person.2.fill': 'groups',
  'flag.fill': 'golf-course',
  'star.fill': 'star',
  'leaf.fill': 'eco',
  'sun.max.fill': 'wb-sunny',
  'flame.fill': 'local-fire-department',
  'trophy.fill': 'emoji-events',
  'target': 'my-location',
  'location.fill': 'near-me',
  'map.fill': 'map',
  'tablecells': 'grid-on',
  'aqi.medium': 'grain',
  'mountain.2.fill': 'terrain',
  // Community.
  'bell': 'notifications-none',
  'bell.fill': 'notifications',
  'person.badge.plus': 'person-add',
  'square.and.arrow.up': 'ios-share',
  'heart': 'favorite-border',
  'heart.fill': 'favorite',
  'hand.thumbsup': 'thumb-up-off-alt',
  'hand.thumbsup.fill': 'thumb-up',
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
