# Product

## Register

product

## Users

Dedicated amateur golfers who care about getting better. Two contexts: **on the course** (one-handed, in sun glare, between shots — data entry must be a tap, never typing) and **at home** (reviewing progress, reading their game like a journal). They are fluent in golf vocabulary (GIR, FIR, up-and-down, handicap index) — never dumb it down.

## Product Purpose

A local-first caddie book: log every round shot-by-shot on tap-first, spatial surfaces (fairway lanes, ring targets, putt grids), then let the accumulated data tell the golfer's story — dispersion, trends, handicap, mental game. Success is a golfer who logs every round because entry is effortless, and keeps coming back because the book reads like *their* story, not a spreadsheet.

## Brand Personality

Gentlemanly, minimal, editorial. The feel of a fine journal or a course-architecture plate: cool near-white page, deep pine ink, serif numerals, hairline rules, generous whitespace. Touchstones: **Journal18** (academic art-journal restraint), **the Masters** (deep pine green, understated luxury), **Medium** (serif reading, air, hairlines). Quiet confidence — the app never shouts; the golfer's numbers are the loudest thing on the page.

## Anti-references

- **SaaS-dashboard stat apps**: identical metric-card grids, hero-number tiles, multi-hue chart rainbows, boxed everything.
- **Garish golf trackers** (Arccos / 18Birdies-style): color-coded everything, gamified badges, dense data walls, red/green traffic-light scoring.
- Generic mobile UI-kit looks: filled pills, drop shadows, gradient accents, system-blue chrome.

## Design Principles

1. **Tap-first; the keyboard is the exception.** Input is a tap on a shape that means something. No Save buttons — every tap writes.
2. **Shape encodes meaning.** Circle = under par, square = over; position is data; the UI re-derives form from raw values. One shared glyph vocabulary, never two ways to show "birdie."
3. **Hierarchy from type and air, not boxes.** Serif numerals, letterspaced caption labels, hairline rules, whitespace. A card is a deliberate, rare act of emphasis.
4. **Restraint is the aesthetic.** Two inks carry everything: the theme's accent on its page. Reaching for a third color is either a chart-emphasis tint of the ink or a mistake.
5. **Quiet motion, earned delight.** Everyday surfaces get micro-feedback (pressed scale, light haptic, fast capped list stagger). Choreography is reserved for rare, narrative moments (first run, empty states).

## Accessibility & Inclusion

- Respect system Reduce Motion (Reanimated entering animations honor it by default — keep it that way).
- Pressables carry `accessibilityRole`/`accessibilityState`; decorative SVG is always `pointerEvents="none"`.
- Type floors: 11pt letterspaced captions are the minimum; body text uses `textSecondary` or darker on the page — `textMuted` is for labels, never running copy.
- One dark theme (Twilight/midnight) ships; chart tints must stay legible on its dark tracks (alpha floor ~25%).
