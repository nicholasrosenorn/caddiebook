# Caddy Book — Design Principles

This document captures the **visual and interaction language** of Caddy Book.
It is the "why and how it should feel" companion to `CLAUDE.md` (which covers
architecture and data flow). When you add a screen, a control, or a chart, it
should look like it was drawn by the same hand as everything already here —
this doc is how you stay in that hand.

## 1. The one-line brief

> A field notebook for your golf game: warm paper, deep-green ink, drawn by a
> precise hand. Data entry is **tapping on shapes that mean something**, not
> typing into boxes.

Two ideas do all the work, and they pull in the same direction:

- **Tap-first, spatial input.** You record a round by touching shaped, position-
  aware surfaces — a fairway, a ring target, a putt grid — not by filling a form.
- **Editorial print aesthetic.** Two colors, a serif display face, hand-drawn
  line work, registration marks, and a faint paper grain. It reads like a
  printed scorecard / course-architecture plate, not a SaaS dashboard.

If a change makes the app feel more like a spreadsheet or more like a generic
mobile UI kit, it's wrong even if it "works."

## 2. Core principles

### P1 — Tap-first; the keyboard is the exception
`Pressable` on a meaningful shape is the default input. A `TextInput` is a
fallback reserved for genuinely free-form text (hole notes, course name in the
new-round modal, "other" club). Everything else is a tap on a target, a grid
cell, a glyph, or a count button. There are **no "Save" buttons inside the round
flow** — every tap, numeric commit, and `onBlur` writes immediately.

### P2 — Shape encodes meaning
The form of a thing carries its data, and the UI re-derives that form on every
render from raw stored values:

| Meaning | Shape |
| --- | --- |
| Score under par | **circle** (double circle = eagle+) |
| Score over par | **square** (double/triple square = double/triple bogey) |
| Score at par | the word **Par**, no shape |
| Drive result | a **lane** by x-position (LF / CF / RF) |
| Approach result | **distance from the pin** (concentric rings) |
| Putt | a **column** (distance bucket) and a **side** (made / missed) |
| Made putt | **filled** rough disc |
| Missed putt | **open** rough ring |

This vocabulary is shared. The score circle/square in the stats grid, the round
list, and the summary are the *same glyphs* — see `ScoreGlyph` in
`components/sketch.tsx`. Don't invent a second way to show "birdie."

### P3 — Position is data
Shots store normalized `(x_norm, y_norm)` in `[0,1]` relative to the target's
bounding box, so a dispersion overlay scales to any screen. Targets capture
`nativeEvent.locationX/Y` and normalize on tap; pins re-project on render. Other
shots in the round render as **muted** pins beneath the current prominent one.

### P4 — Derived stats are first-class, override is always one tap away
GIR auto-derives from `(score − putts) ≤ par − 2`; U&D from `(missed GIR) ∧
(score ≤ par)`. The derived value shows by default with a hint ("Auto from
score − putts"); tapping the toggle writes a manual override straight to the
column. The user is never blocked waiting on us to compute something.

### P5 — Restraint is the aesthetic
Two colors carry everything. Resist adding hues, drop shadows, gradients, or a
third weight of border. When a surface needs emphasis, **fill it green**; when
it needs to recede, **leave it on paper**. The hand-drawn line work is *subtle* —
a precise draftsman, not a doodle (see §5).

## 3. Palette

Single warm light theme (`constants/theme.ts`). No dark mode; the status bar is
forced to dark content.

| Token | Value | Use |
| --- | --- | --- |
| `background` | `#F1EBDC` | App canvas (warm paper) |
| `surface` | `#F7F1E2` | Cards, buttons, inputs (slightly lighter paper) |
| `surfaceAlt` | `#EBE3CC` | Recessed fills (bar tracks) |
| `border` | `#D9CFB5` | Hairlines |
| `borderStrong` | `#B7A98A` | Drawn outlines, grain dots, registration marks |
| `accent` | `#1B4D3E` | Deep green — the ink. Greens, fills, selection, pins |
| `accentPressed` | `#143A2F` | Pressed accent |
| `accentMuted` | `#1B4D3E14` | Faint green wash |
| `accentOn` | `#F1EBDC` | Text/marks on a green fill |
| `textPrimary/Secondary/Muted` | `#1A1A1A` / `#5A5346` / `#8E8674` | Ink hierarchy |
| `danger` / `warning` / `info` | `#9B3B2E` / `#B58A2A` / `#4A6B7A` | **Charts only.** Never for chrome or to signal "error" in the round flow |

**Rule of thumb:** if you're reaching for a color outside green-on-paper, it's
either a chart category or it's a mistake.

## 4. Typography

- **Fraunces** (serif) is the display + label face: titles, hole headers, big
  numerals (par, score, stat values), button labels, control labels. Loaded via
  `@expo-google-fonts/fraunces` (`Fraunces_500Medium`, `Fraunces_700Bold`).
- **System sans** is for running text and body copy only.
- **Captions** are sans, 11px, uppercase, letter-spaced `~1.4` — the "stamped
  label" look (`SCORE`, `PUTTING`, section kickers).

Use the `typography` tokens / `ThemedText` types; reach for `fontFamily.serif`
or `serifBold` directly only inside a component's own `StyleSheet` for numerals
and labels. **Numbers that represent a score, par, or stat are serif.** Plain
`fontWeight: '700'` sans for a big number is a tell that a screen predates the
language — fix it.

## 5. The drawn line — visual chrome

All hand-drawn geometry is **deterministic**: seeded by a string so a shape
looks sketched but never reflows or re-randomizes between renders. The seeded
PRNG and geometry live in `lib/sketch.ts`; the React components in
`components/sketch.tsx`. Reuse them; do not hand-roll new SVG paths.

### Geometry helpers (`lib/sketch.ts`)
- `roughCirclePath` — irregular ring / disc (greens, putt glyphs, score circles)
- `roughRectPath` — barely-irregular rounded rect (card / button / input frames).
  **Keep jitter low** — this is the "crisp draftsman" line, not a sketch.
- `sketchDividerPath` — a near-straight divider with a faint waver
- `bunkerPath` — peanut / kidney bunker silhouette
- `fairwayPath` — tall tapered "surfboard" fairway
- `wavyLines` — vertical grain inside the fairway
- `stippleInEllipse` / `stippleInRect` — sand / paper grain dots
- `topoRings` — concentric contour rings for the map chip

### Components (`components/sketch.tsx`)
- `Paper` — full-bleed faint grain field + optional corner registration marks.
  Mounted once in `Screen`; **density is capped and memoized** so big screens
  stay cheap. This is what makes every screen read as paper.
- `SketchSurface` — the workhorse. A view framed by a `roughRectPath`. Props:
  `fill`, `stroke`, `radius`, `grain` (sand stipple inside, used on selected
  state). **This is how you give any card / button / input the drawn border** —
  reach for it before `borderWidth` + `borderColor`.
- `SketchDivider`, `CornerDots`, `Crosshair`, `PlusMark`, `TickPair` —
  registration / ornament marks. Use them sparingly as the "this was printed and
  trimmed" punctuation; they are decorative and always `pointerEvents="none"`.
- `BunkerBlob`, `TopoChip` — decorative hazards / map detail.
- `ScoreGlyph` — the shared circle/square score vocabulary (see P2).

### Selection convention
A selected control is **filled green with sand grain** (`fill={accent}
stroke={accent} grain`); an unselected one is **paper with a `borderStrong`
drawn outline**. Pressed state is `opacity` on the wrapping `Pressable`, not a
background swap. This is consistent across par buttons, count rows, yes/no,
binary ✓/✗, segmented controls, chips, and rating tiles.

## 6. Layout & motion

- **A round is one screen of 5–6 vertically-paged sub-pages** (Par → Score →
  Drive → Approach → Putting → Stats; Par 3 skips Drive). Pages within a hole change by
  **vertical swipe**; holes change via the sticky bottom nav's `‹ / ›` chevrons.
- The round screen hides its nav header and uses a floating **X** to reclaim
  vertical space.
- Decorative SVG children are always `pointerEvents="none"` so taps fall through
  to the capture surface beneath.
- Bunkers and ornaments **hug edges and corners** — they must never sit on a
  label or cross an active lane / ring. (They are the margin doodles, not the
  content.)

## 7. Decision checklist for new work

Before shipping a new surface, ask:

1. **Can this be a tap on a shape** instead of a text field or stepper? (P1)
2. **Does the shape already mean something** in the vocabulary, and am I reusing
   `ScoreGlyph` / the targets rather than inventing? (P2)
3. **Two colors only** — is every non-chart color green-on-paper? (P5)
4. **Is it on paper** — does the surface use `SketchSurface` / inherit `Paper`,
   not a flat `borderWidth` rectangle? (§5)
5. **Are the numerals and labels serif?** (§4)
6. **Selected = filled green + grain; unselected = paper + drawn outline?** (§5)
7. **Does it auto-save** with no Save button, and refresh via `onChange`? (P1)
8. **Lint and types pass** (`npx tsc --noEmit && npx expo lint`), and did you
   **look at it on a device/simulator** — not just trust that it compiles?

## 8. Where things live

| Concern | File |
| --- | --- |
| Palette, spacing, radius, typography | `constants/theme.ts` |
| Seeded geometry helpers | `lib/sketch.ts` |
| Drawn components (`Paper`, `SketchSurface`, glyphs, ornaments) | `components/sketch.tsx` |
| The two targets | `components/driver-target.tsx`, `components/approach-target.tsx` |
| Score vocabulary in the form | `components/score-grid.tsx` |
| Derivation rules | `lib/stats.ts` |
| Architecture / data model | `CLAUDE.md` |
