# Caddy Book

A local-first golf caddy book for iOS & Android. The product **focus is stat tracking with a visual and spatial design language** — wherever possible, data entry is tap-first on shaped, position-aware surfaces (target maps, par-relative score grids, putt grids) rather than text inputs.

## Stack

- **Expo SDK 54** (managed), TypeScript, React Native 0.81
- **Expo Router** with file-based routing and typed routes
- **expo-sqlite** for on-device persistence (no backend yet)
- No UI library — custom theme + RN primitives
- **`react-native-svg`** powers the hand-drawn visual language (targets, score glyphs, paper grain, card/button frames)
- **Fraunces** serif (`@expo-google-fonts/fraunces`, loaded in `app/_layout.tsx`) is the display/label face
- Native deps: `@react-native-community/datetimepicker`, `expo-crypto`, `react-native-safe-area-context`, `react-native-gesture-handler`

Expo SDK 54 docs are authoritative — when in doubt see https://docs.expo.dev/versions/v54.0.0/.

**The visual + interaction language is documented in [`DESIGN.md`](./DESIGN.md)** — read it before touching any UI. This file covers architecture and data flow; `DESIGN.md` covers how it should look and feel.

## App flow

```
Rounds tab ──► + New Round (modal) ──► /round/[id]
                                          │
                                          ├─ Par picker      (page 0)
                                          ├─ Drive target    (page 1, par 4+)
                                          ├─ Approach target (page 2)
                                          ├─ Putting grid    (page 3)
                                          └─ Stats           (page 4)  ← final
```

A round is **one screen with 4 or 5 vertically-paged sub-pages**. Par 3 holes skip the Drive page. Navigation between holes happens via a sticky bottom nav with ‹ / › chevrons; navigation between pages within a hole happens via vertical swipe.

The round screen's nav header is hidden (`headerShown: false`); a floating X (close) button replaces it to reclaim vertical space.

### Page-by-page

| Page | File | Purpose |
| --- | --- | --- |
| Par | `components/par-page.tsx` | Three big tap buttons (Par 3 / 4 / 5). Auto-advances to next page on selection. |
| Drive | `components/drive-page.tsx` | Tall fairway "oval" with **LF / CF / RF** lanes. Tap to place the drive. CF zone is the inner 40% (0.3–0.7 x-normalized). Tap → `upsertShot('driver')` + write-through `hole.fir = isFairwayHit(lane)`. |
| Approach | `components/approach-page.tsx` | Concentric ring target (3 / 5 / 10 / 20 / 30 ft) with a pin at center. Tap places shot; computes `onGreen` + `proximityFt`. Tap → `upsertShot('approach')` + write-through `hole.gir`. Below the target: an inline **club chip row** (`ClubChips`, fed from the player's bag via `getBag()`, falling back to all clubs) + a tap-first **yardage ruler** (`YardageRuler`, snaps to 5 yds, parks at 125). |
| Putting | `components/putting-page.tsx` | A drawn beige-green **putt board** (fringe + stipple, same palette as the targets): five horizontal distance lanes `25+ / 15–25 / 10–15 / 3–10 / <3 ft` ordered far→near with the cup + flag at the bottom. Each lane is split into a **MADE** and a **MISS** tap column; tapping a column appends a putt glyph there (filled disc = made, open ring = miss) with a live count. Tap a glyph to remove it. Distance + made/miss is all that's stored — no putt coordinates. Each tap inserts/deletes a `putts` row and auto-syncs `hole.putts` count. |
| Stats | `components/hole-stats-page.tsx` | Tap-first form: score grid (3×3, par-relative indicators — single/double circle for birdie/eagle, "Par" label, single/double/triple square for bogey/double/triple), count rows for Putts/Chip Shots/Greenside Sand/Penalties, ✓/✗ toggles for FIR/GIR/U&D, notes. Round-wide summary bar at top. |

### Visual + spatial design principles

> Full treatment — palette, typography, the drawn-line system, and a per-PR
> checklist — lives in [`DESIGN.md`](./DESIGN.md). Summary below.

1. **Tap-first.** Pressables are the default; keyboard-driven `TextInput` is a fallback (notes only, and the new-round modal).
2. **Shape encodes meaning.** A par-relative score gets a *circle* (under par) or *square* (over par); a drive gets a lane via x-position; an approach gets proximity via distance from a center point; a putt gets a column (distance) and a side (made/missed). The data model stores raw values; the UI re-derives the visualization on every render.
3. **Position is data.** Shots store `(x_norm, y_norm)` in `[0, 1]` normalized to the target's bounding box, so dispersion overlays scale to any screen. Other drives in the round render as **muted** pins under the current hole's prominent accent pin (built-in per-round dispersion overlay).
4. **Derived stats are first-class.** GIR auto-derives from `(score − putts) ≤ par − 2`; U&D auto-derives from `(missed GIR) ∧ (score ≤ par)`. Manual override is always possible by tapping the toggle (writes to the column directly). See `lib/stats.ts`.
5. **Editorial print aesthetic.** Two colors only (deep green on warm paper), Fraunces serif numerals/labels, hand-drawn line work, registration marks, and a faint paper grain. Selected = filled green + sand grain; unselected = paper + a drawn outline.

### The drawn-line toolbox

Every hand-drawn shape is **deterministic** (seeded by a string so it looks sketched but never reflows between renders). Reuse these — do not hand-roll SVG paths:

- `lib/sketch.ts` — seeded geometry: `roughCirclePath`, `roughRectPath`, `sketchDividerPath`, `bunkerPath`, `fairwayPath`, `wavyLines`, `stippleInEllipse`/`stippleInRect`, `topoRings`.
- `components/sketch.tsx` — drawn React components:
  - `Paper` — full-bleed grain + corner registration marks; mounted once in `Screen`, so every screen inherits it (density capped + memoized for perf).
  - `SketchSurface` — **the workhorse**: a view framed by a `roughRectPath`. Reach for it instead of `borderWidth`/`borderColor` on any card, button, or input. Props: `fill`, `stroke`, `radius`, `grain`.
  - `ScoreGlyph` — the shared circle/square score vocabulary (used by the score grid, rounds list, summary).
  - `SketchDivider`, `CornerDots`, `Crosshair`, `PlusMark`, `TickPair`, `BunkerBlob`, `TopoChip` — ornaments; always `pointerEvents="none"`.

## Architecture

### Controller pattern

`app/round/[id]/index.tsx` is the thin **controller**. It owns:
- The 4 pieces of round state: `round`, `holes`, `shots`, `putts` (refetched via `load()` on every focus and after every mutation).
- The page-paging machinery: `pageHeight` (measured via `onLayout`), `pagingEnabled` `ScrollView`, `snapToOffsets`, `scrollRef`.
- The current `holeNumber`, `currentPage` (for the right-side dot indicator).
- Navigation callbacks (`onPrevHole`, `onNextHole`, `onFinish`).

The five page components are dumb children — they receive `{ roundId, hole, shotsForRound | putts, onChange }` and mutate the DB directly via queries, then call `onChange` (= `load`) to reload.

### Layout (round screen)

```
Screen (Stack.Screen options={{ headerShown: false }})
└── View {paddingTop: insets.top}              ← status-bar offset
    └── View flex:1 onLayout                   ← measured wrapper; pageHeight = its height
        ├── ScrollView pagingEnabled            ← outer paging between 5 pages
        │   ├── View {height: pageHeight} ParPage
        │   ├── View {height: pageHeight} DrivePage      (par 4+ only)
        │   ├── View {height: pageHeight} ApproachPage
        │   ├── View {height: pageHeight} PuttingPage
        │   └── View {height: pageHeight}
        │       └── HoleStatsPage              ← internal ScrollView for tall form
        ├── PageDots                            ← absolute right, zIndex 10
        └── StickyHoleNav                       ← absolute bottom, zIndex 20
└── Pressable closeButton                       ← absolute top-right of Screen, zIndex 30
```

The **paddingTop is on an outer wrapper**, the inner wrapper is what's measured — this keeps `pageHeight` equal to the `ScrollView`'s actual frame height so paging snap intervals stay aligned. Don't merge them.

The **stats page is the only one that scrolls internally** (its content is taller than viewport). It uses its own `ScrollView` with `nestedScrollEnabled`. The outer paged `ScrollView` snaps cleanly to the top of stats; inner scroll then handles the form.

## Data model

### Tables (`db/schema.ts`)

| Table | Key columns | Notes |
| --- | --- | --- |
| `rounds` | `id`, `course_name`, `date_played`, `hole_count`, `created_at` | One row per round. |
| `holes` | `id`, `round_id` FK, `hole_number`, `par`, `score`, `putts`, `fir`, `gir`, `up_and_down`, `approach_distance_yds`, `approach_club`, `chip_shots`, `sand_shots`, `penalties`, `notes` | Pre-created on round insert (1 row per hole). `fir/gir/up_and_down` are nullable booleans (0/1, NULL = unset → use derived). |
| `shots` | `id`, `round_id` FK, `hole_number`, `shot_type` (`'driver'` \| `'approach'`), `x_norm`, `y_norm`, `intended_x_norm`, `intended_y_norm`, `notes` | One drive + one approach per hole (replaced via `upsertShot`). |
| `putts` | `id`, `round_id` FK, `hole_number`, `distance_ft`, `made`, `created_at` | Many per hole. `distance_ft` is the bucket upper bound: `3, 10, 15, 25, 50` (the `50` bucket is the open-ended `25+ ft`). The bucket set lives in `components/putting-page.tsx` (`BANDS`) and `app/round/[id]/summary.tsx` (`PUTT_BUCKETS`) — keep them in sync. |
| `post_round_reviews` | `id`, `round_id` FK, `tactical/technical/mental`, `went_well`, `didnt_go_well`, `will_work_on` | Schema in place; no UI yet. |
| `app_settings` | `key` PK, `value` | Global key/value store (not per-round). Currently holds the player's **bag** under key `bag` (JSON array of club names). `getBag()`/`setBag()` in `db/queries.ts`; empty/unset = treat as all clubs. |

### Migration strategy

No formal versioned migration runner yet. Schema evolution is handled by two complementary mechanisms in `db/client.ts:initDb`:
1. `CREATE TABLE IF NOT EXISTS …` runs on every boot — handles new tables.
2. `ensureColumn(db, table, column, ddlFragment)` does `PRAGMA table_info` then `ALTER TABLE … ADD COLUMN` if missing — handles new columns on existing tables.

When you add a column: update **all four** of `db/schema.ts`, `db/types.ts`, `db/queries.ts` (`HoleRow` type, `rowToHole`, `FIELD_TO_COLUMN`, **and the column lists in every SELECT statement**), and add an `ensureColumn` call. Missing the SELECT list is the easiest bug to introduce — the UI will silently appear inert because writes succeed but reads return `undefined`.

### Auto-sync invariants

- **`putts` table ↔ `holes.putts`**: every `createPutt` / `deletePutt` runs inside a transaction that recomputes and writes `holes.putts = COUNT(putts WHERE round_id=? AND hole_number=?)`. The Stats page's Putts row stays accurate without explicit syncing.
- **`shots` ↔ `holes.fir / gir`**: every shot upsert also calls `updateHole` with the derived value (`isFairwayHit(lane)` for drives, `onGreen` for approaches). Manual override on the Stats page beats the shot value (writes directly to the column).

## Theme

Single warm light palette in `constants/theme.ts` (see `DESIGN.md` §3 for the full table and usage rules):
- Background `#F1EBDC` (warm paper), surface `#F7F1E2`, surfaceAlt `#EBE3CC` (recessed)
- Borders: `#D9CFB5` (hairline), `#B7A98A` (drawn outlines, grain, registration marks)
- Accent `#1B4D3E` (deep green — the ink), accentMuted `#1B4D3E14`, accentOn `#F1EBDC`
- Text: `#1A1A1A` primary, `#5A5346` secondary, `#8E8674` muted
- `danger`/`warning`/`info` exist **for chart categories only** — never for chrome

Typography: **Fraunces** serif for display/labels/numerals (`fontFamily.serif` / `serifBold`), system sans for body, letter-spaced uppercase captions. No dark mode; the status bar is forced to `dark` content.

## Routing

| Route | Notes |
| --- | --- |
| `/` (default tab) | Rounds list. Header has a + button → modal. Tapping a round opens `/round/[id]` if in-progress, or `/round/[id]/summary` if completed; long-press to delete. |
| `/(tabs)/stats` | **Built.** Lifetime stats across **completed** rounds. Two **dropdown** filters (`components/dropdown-select.tsx`): hole count (All / 18 / 9, **defaults to 18**) and recency (last 20 / 40 / 60 / All). A muted sample-size caption (`N rounds · N holes`) replaces the old corpus card. Sections: scoring (adapts to filter — real scoring avg when a single hole count is selected, fair per-18 to-par when mixed), per-par averages, GIR/FIR/U&D + putting trio, over-time trend sparklines (scoring, GIR%, putts), score distribution, aggregate driver & approach dispersion (small muted pins), approach-distance histogram (bars split by green-hit/missed via GIR), putting make% by distance, trouble/short-game (**per-round** penalties/chips/sand), and post-round review insights. Logic in `lib/lifetime-stats.ts`; batch reads via `getAll*` in `db/queries.ts`; sparkline in `components/trend-chart.tsx`. |
| `/round/new` | Modal: course name, date, 9/18, **your bag** (`BagPicker` multi-select; persists globally via `setBag`, pre-filled with all clubs first time). On submit: `createRound` → `router.replace('/round/[id]')`. |
| `/round/[id]` | The whole round flow (5 vertically-paged sub-pages). Hidden nav header. "Finish" → `/round/[id]/review`. |
| `/round/[id]/review` | **Built.** 5-question post-round review (most costly / decision rating / common miss / range focus / overall rating), one vertically-paged question each. On submit: `upsertReview` + `setRoundCompletedAt` (first time only) → `/round/[id]/summary`. |
| `/round/[id]/summary` | **Built.** Read-only round summary: score/to-par card, GIR/FIR/U&D + putting/penalty tiles, scoring-by-par, score distribution bars, drive & approach dispersion targets, putting-by-distance bars, post-round review answers, "Edit round" CTA. |

## Conventions

- **TypeScript strict.** No `any` in new code unless escaping a typed-routes friction (cast on `router.push/replace` paths only).
- **Auto-save on every interaction.** No "Save" buttons inside the round flow. Tap toggles / numeric commits / `onBlur` for text — each writes immediately and calls `onChange` to refresh state.
- **Page wrappers always `height: pageHeight`.** The outer `ScrollView` uses `pagingEnabled`; do not put naturally-sized content directly inside it without a fixed-height wrapper or it will be paginated as multiple virtual pages.
- **Targets stay tap-first.** When adding a new shot type (chip target, putt-stroke arc, etc.), reuse the `DriverTarget` / `ApproachTarget` pattern: a centered visual + `Pressable` capturing `nativeEvent.locationX/Y` normalized to the layout, decorative children set to `pointerEvents="none"`.
- **Lint and types must pass.** `npx tsc --noEmit && npx expo lint` before shipping.

## Common edits — where to look

| Task | File(s) |
| --- | --- |
| Add a new stat field on a hole | `db/schema.ts` + `db/client.ts ensureColumn` + `db/types.ts` + `db/queries.ts` (HoleRow, rowToHole, FIELD_TO_COLUMN, **all SELECT lists**) + new component or update `hole-stats-page.tsx` |
| Add a new page in the round flow | New `components/<name>-page.tsx`, add to `app/round/[id]/index.tsx` (controller render + adjust `totalPages`) |
| Change CF lane width | `lib/shots.ts` (`CF_LEFT_EDGE` / `CF_RIGHT_EDGE`) — used by both the math and the visual lanes in `driver-target.tsx` |
| Change ring proximity thresholds | `lib/shots.ts` (`APPROACH_RINGS`) — shared by `approach-target.tsx` visuals and `approachResult` math |
| Tweak GIR / U&D derivation | `lib/stats.ts` (`deriveGir`, `resolveGir`, `deriveUpAndDown`, `resolveUpAndDown`) — both `computeRoundSummary` and the stats page rows consume these |
| Adjust the sticky bottom nav | `components/sticky-hole-nav.tsx` (uses `useSafeAreaInsets` for the home indicator) |
| Give a card/button/input the drawn border | Wrap it in `SketchSurface` (`components/sketch.tsx`) — don't add `borderWidth`/`borderColor` |
| Add/adjust a new hand-drawn shape | `lib/sketch.ts` (seeded geometry) + a component in `components/sketch.tsx` |
| Change the paper grain / registration marks | `Paper` in `components/sketch.tsx` (mounted in `components/screen.tsx`) |
| Tune the post-round summary | `app/round/[id]/summary.tsx`; review question flow → `app/round/[id]/review.tsx` + `lib/review.ts` |

## What's not built yet

- **Versioned migrations.** Acceptable while pre-launch; add a proper runner before the first ship.

(The per-round summary, post-round review, and the lifetime Stats tab — including cross-round dispersion and over-time trends — are now **built**; see the routing table.)
