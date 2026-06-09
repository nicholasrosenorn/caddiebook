# Caddy Book — Design Principles

This document captures the **visual and interaction language** of Caddy Book.
It is the "why and how it should feel" companion to `CLAUDE.md` (which covers
architecture and data flow). When you add a screen, a control, or a chart, it
should look like it was drawn by the same hand as everything already here —
this doc is how you stay in that hand.

## Direction (2026): crisp editorial elegance

The app is evolving from the warm, hand-drawn "field notebook" look toward a
**crisp editorial elegance** — gentlemanly, minimal, refined. The touchstones are
**Journal18** (academic art-journal restraint), **Masters** (deep pine green,
understated luxury), and **Medium** (serif reading, generous whitespace, hairline
rules). Hierarchy comes from **type and air, not boxes**.

What this means concretely:

- **Cooler near-white page**, not warm cream — e.g. `#FAF9F5` instead of `#F1EBDC`.
- **Masters pine-green ink** — deeper, greener, e.g. `#103D2C` (vs the old `#1B4D3E`).
- **Hairline chrome.** Crisp 1px borders and rules. **No paper grain, no drawn
  jitter** — cards/buttons are clean framed surfaces (a `Plate`), dividers are 1px
  rules (a `Rule`).
- **Fraunces serif + generous whitespace** carry the page; letterspaced sans
  kickers as labels.
- **One ornament only:** the architect's **crop mark**. Everything else stays quiet.

**Unchanged:** the interaction language — tap-first, shape-encodes-meaning,
position-is-data, derived stats (P1–P4 below) — is independent of texture and still
holds.

**Status:** shipped app-wide as a **theme-identity system**. A theme is now color
**+ fonts + chrome** (`ThemeMeta` in `constants/theme.ts`), driven at runtime by
`useColors()` / `useFontSet()` / `useChrome()`. The shared `SketchSurface` / `Paper`
/ `SketchDivider` render crisp (`editorial`) or hand-drawn (`notebook`) from the
active `chrome`, so call sites never change. Six selectable identities ship —
**Augusta** (editorial pine, the default), **Broadsheet**, **Links**, **Clay**,
**Twilight** (dark), and **Field Notebook** (the original hand-drawn look,
preserved). The targets (`driver-target` / `approach-target`) stay drawn
illustrations in every theme.

## 1. The one-line brief

> A field notebook for your golf game, set like a fine journal: a cool near-white
> page, deep pine-green ink, Fraunces serif, hairline rules. Data entry is
> **tapping on shapes that mean something**, not typing into boxes.

Two ideas do all the work, and they pull in the same direction:

- **Tap-first, spatial input.** You record a round by touching shaped, position-
  aware surfaces — a fairway, a ring target, a putt grid — not by filling a form.
- **Editorial elegance.** A near-white page, deep pine-green ink, a serif display
  face, generous whitespace, and hairline rules — with the architect's crop mark as
  the lone flourish. It reads like a fine journal / course-architecture plate, not a
  SaaS dashboard. (See _Direction_ above; the older warm, hand-drawn-and-grain
  treatment is being refined out.)

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
it needs to recede, **leave it on paper**. **Direction:** restraint now leans fully
crisp — prefer hairline rules and whitespace over drawn frames and grain (see
_Direction_ at top). The line work, where it remains, is *subtle* — a precise
draftsman, not a doodle (see §5).

## 3. Palette

Themes are full identities in `constants/theme.ts` (palette + fonts + chrome). The
default is **Augusta** (editorial); the table below documents the **Field Notebook**
(hand-drawn) theme. One dark theme ships (**Twilight**) — `dark: true` flips the
status bar to light; the rest force dark content.

> **Direction note:** the default is now the **Augusta** editorial palette (cooler
> near-white page, deep Masters pine ink). The warm values in the table below are
> the **Field Notebook** theme (still selectable). Every theme supplies its own full
> `Palette` + `FontSet` + `chrome`; read tokens via `useColors()` / `useFontSet()`
> and never hardcode.

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

> **Direction note:** `SketchSurface`, `Paper`, and `SketchDivider` are now
> **chrome-aware** — in an `editorial` theme they render crisp native hairlines
> with no grain; in a `notebook` theme they render the drawn frame + grain below.
> Call sites don't change; the active theme's `chrome` decides. The seeded geometry
> still powers the **targets and score glyphs** in every theme — illustration, not
> chrome.

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
