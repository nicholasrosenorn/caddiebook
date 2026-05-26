import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

/** Width of the invisible grab zone hugging the left edge. */
const EDGE_WIDTH = 24;
/** Horizontal travel (px) before a rightward drag commits to opening the menu. */
const TRIGGER_DX = 40;

/**
 * Invisible strip along the screen's left edge. A rightward drag that starts at
 * the edge opens the app menu (`/menu`) — the same target as the hamburger
 * button. Drop it as the last child inside a tab `Screen`; it positions itself
 * absolutely so it doesn't affect layout.
 *
 * The gesture only claims the touch once it moves right (`activeOffsetX`) and
 * bails on vertical movement (`failOffsetY`), so taps and scrolls in the strip
 * fall through to the content beneath it.
 */
export function EdgeSwipeOpener() {
  const pan = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX(12)
    .failOffsetY([-16, 16])
    .onEnd((e) => {
      if (e.translationX > TRIGGER_DX) {
        router.push('/menu');
      }
    });

  return (
    <GestureDetector gesture={pan}>
      <View style={styles.edge} />
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  edge: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: EDGE_WIDTH,
    zIndex: 50,
  },
});
