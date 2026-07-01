import { Easing, FadeInDown, FadeInUp, Keyframe } from 'react-native-reanimated';

/**
 * The app's motion vocabulary. Two registers:
 *
 * - First-run (intro, sign-in): `revealUp` / `revealRule` — an unhurried
 *   450ms staggered reveal. Rare, narrative surfaces earn this.
 * - In-app lists: `listItemIn` — a fast, capped stagger for everyday surfaces
 *   seen many times a day. Frequent surfaces move less.
 *
 * Reanimated skips entering animations on its own when the system Reduce
 * Motion setting is on (ReduceMotion.System is the default).
 */
const REVEAL_STAGGER_MS = 70;

/** First-run reveal: content fades up in a short stagger. */
export const revealUp = (order: number) =>
  FadeInUp.duration(450)
    .delay(order * REVEAL_STAGGER_MS)
    .easing(Easing.out(Easing.cubic))
    .withInitialValues({ transform: [{ translateY: 14 }] });

/** First-run reveal for rules: scale out from center. */
export const revealRule = (order: number) =>
  new Keyframe({
    0: { opacity: 0, transform: [{ scaleX: 0 }] },
    100: { opacity: 1, transform: [{ scaleX: 1 }], easing: Easing.out(Easing.cubic) },
  })
    .duration(420)
    .delay(order * REVEAL_STAGGER_MS);

/**
 * Everyday list entrance: quick fade-up with a delay capped after the first
 * few items, so late/paginated rows never sit waiting. List keys keep their
 * identity across refresh/refocus, so this only ever plays on first mount.
 */
export const listItemIn = (index: number) =>
  FadeInUp.duration(250)
    .delay(Math.min(index, 6) * 40)
    .easing(Easing.out(Easing.cubic))
    .withInitialValues({ transform: [{ translateY: 10 }] });

const SECTION_STAGGER_MS = 60;

/**
 * Section swap: blocks fade in drifting down (top → bottom) in a short cascade.
 * `order` is the block's position; the delay caps so long sections never crawl.
 */
export const sectionIn = (order: number) =>
  FadeInDown.duration(240)
    .delay(Math.min(order, 8) * SECTION_STAGGER_MS)
    .easing(Easing.out(Easing.cubic))
    .withInitialValues({ transform: [{ translateY: -10 }] });
