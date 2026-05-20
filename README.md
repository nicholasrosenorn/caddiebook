# Caddy Book

A local-first golf caddy book for iOS and Android, built with Expo (SDK 54) +
React Native + Expo Router. You log a round by **tapping on shapes that mean
something** — a fairway, a ring target, a putt grid — not by filling in forms.
Everything is stored on-device in SQLite; there's no backend.

The app has a deliberate **editorial print aesthetic**: deep green ink on warm
paper, a serif display face, and hand-drawn line work. See
[`DESIGN.md`](./DESIGN.md) for the full visual + interaction language and
[`CLAUDE.md`](./CLAUDE.md) for architecture and data flow.

## Run it

```bash
npm install
npm run ios        # iOS simulator (requires Xcode)
npm run android    # Android emulator (requires Android Studio)
npm run start      # Metro bundler — scan QR with Expo Go, or pick a target
```

Before shipping a change: `npx tsc --noEmit && npx expo lint`.

## Stack

- **Expo SDK 54 (managed)** + TypeScript + React Native 0.81
- **Expo Router** — file-based, typed routes
- **expo-sqlite** — on-device persistence (schema in `db/schema.ts`)
- **react-native-svg** — the hand-drawn targets, score glyphs, paper grain, and
  card/button frames
- **Fraunces** serif (`@expo-google-fonts/fraunces`) — display/label face
- Custom theme — warm paper `#F1EBDC` with deep-green `#1B4D3E` ink
  (`constants/theme.ts`); no UI library

## How a round works

A round is **one screen of 4–5 vertically-paged sub-pages**. Swipe up/down to
move between pages within a hole; the sticky bottom nav's `‹ / ›` chevrons move
between holes. Everything **auto-saves on tap** — there are no Save buttons.

```
Par picker ─► Drive target ─► Approach target ─► Putting grid ─► Stats
 (page 0)      (page 1,         (page 2)           (page 3)        (page 4)
               par 4+ only)
```

Finishing a round opens a 5-question **post-round review**, then a read-only
**summary** (score, GIR/FIR/U&D, dispersion targets, distribution + putting
bars, review answers).

## Layout

```
app/                          # Screens (file-based routes)
  _layout.tsx                 # Root stack; loads fonts + runs DB init on boot
  (tabs)/
    _layout.tsx               # Bottom tabs: Rounds | Stats
    index.tsx                 # Rounds list (tap → round or summary)
    stats.tsx                 # Lifetime stat trends (placeholder)
  round/
    new.tsx                   # Start a new round (modal)
    [id]/
      index.tsx               # The round flow (thin controller, 5 paged pages)
      review.tsx              # 5-question post-round review
      summary.tsx             # Read-only round summary
components/
  par-page / drive-page /     # The five round sub-pages
    approach-page /
    putting-page / hole-stats-page
  driver-target / approach-target  # Tap-to-place dispersion targets
  score-grid                  # Par-relative circle/square score picker
  sketch.tsx                  # Drawn components: Paper, SketchSurface, ScoreGlyph, ornaments
  sticky-hole-nav, screen,    # Chrome + shared controls
    option-row, binary-choice, numeric-field, club-picker, …
constants/
  theme.ts                    # Colors, spacing, radius, typography (Fraunces)
lib/
  sketch.ts                   # Seeded hand-drawn geometry helpers
  shots.ts                    # Lane / ring math (CF edges, approach rings)
  stats.ts                    # GIR / U&D derivation, round summaries
  review.ts                   # Post-round review option sets + labels
db/
  client.ts                   # expo-sqlite open + init (CREATE TABLE + ensureColumn)
  schema.ts                   # CREATE TABLE statements
  queries.ts                  # Typed CRUD + auto-sync invariants
  types.ts                    # Row types
```

## Data model

Stored in `caddy-book.db` on device (`db/schema.ts`). Five tables:

- **`rounds`** — one row per round (course, date, hole count, `completed_at`)
- **`holes`** — one row per hole per round (par, score, putts, FIR/GIR/U&D,
  approach distance/club, chip/sand shots, penalties, notes). `fir/gir/up_and_down`
  are nullable booleans — `NULL` means "use the derived value"
- **`shots`** — driver + approach landings as normalized `(x_norm, y_norm)` in
  `[0,1]`, so dispersion scales to any screen
- **`putts`** — many per hole, bucketed by distance (`3 / 10 / 15 / 30` ft) and
  made/missed; `holes.putts` auto-syncs to the count
- **`post_round_reviews`** — most-costly / decision rating / common miss / range
  focus / overall rating

No versioned migration runner yet: `CREATE TABLE IF NOT EXISTS` handles new
tables and `ensureColumn` handles new columns on boot (`db/client.ts`). Adding a
hole column means updating `schema.ts`, `types.ts`, **and every SELECT list in
`queries.ts`** — see `CLAUDE.md` for the full checklist.

## What's next

- Cross-round dispersion overlay and lifetime trends (data is captured; the
  Stats tab is still a placeholder)
- A proper versioned migration runner before first ship
