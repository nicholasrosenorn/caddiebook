# Caddie Book

A golf CaddieBook for iOS & Android. The product **focus is stat tracking with a visual and spatial design language** — wherever possible, data entry is tap-first on shaped, position-aware surfaces (target maps, par-relative score grids, putt grids) rather than text inputs.

**The server is the single source of truth.** All data lives in Postgres behind the `/server` API (deployed on a VPS behind a Cloudflare Tunnel); the client renders from a persisted TanStack Query cache and writes through an ordered offline outbox. There is **no local SQLite database and no bidirectional sync engine** — both were removed in favor of this model.

## Stack

- **Expo SDK 54** (managed), TypeScript, React Native 0.81
- **Expo Router** with file-based routing and typed routes
- **TanStack Query v5** (`@tanstack/react-query` + AsyncStorage persister) for all reads; a small persisted **write outbox** (`lib/data/outbox.ts`) for all data writes
- **Backend** in `/server`: Hono + Drizzle + Postgres (Node 22, docker-compose; tests via vitest)
- No UI library — custom theme + RN primitives
- **`react-native-svg`** powers the hand-drawn visual language (targets, score glyphs, paper grain, card/button frames)
- **Fraunces** serif (`@expo-google-fonts/fraunces`, loaded in `app/_layout.tsx`) is the display/label face
- Native deps: `@react-native-community/datetimepicker`, `expo-crypto`, `react-native-safe-area-context`, `react-native-gesture-handler`, `@react-native-async-storage/async-storage`, `expo-network` (`expo-sqlite` remains only for the one-time legacy flush — see Migration)

Expo SDK 54 docs are authoritative — when in doubt see https://docs.expo.dev/versions/v54.0.0/.

**The visual + interaction language is documented in [`DESIGN.md`](./DESIGN.md)** — read it before touching any UI. This file covers architecture and data flow; `DESIGN.md` covers how it should look and feel.

## App flow

```
Rounds tab ──► + New Round (modal) ──► /round/[id]
                                          │
                                          ├─ Par picker      (page 0)
                                          ├─ Score grid      (page 1)
                                          ├─ Drive target    (page 2, par 4+)
                                          ├─ Approach target (page 3)
                                          ├─ Putting grid    (page 4)
                                          └─ Stats           (page 5)  ← final
```

A round is **one screen with 5 or 6 vertically-paged sub-pages**. Par 3 holes skip the Drive page. Navigation between holes happens via a sticky bottom nav with ‹ / › chevrons; navigation between pages within a hole happens via vertical swipe.

The round screen's nav header is hidden (`headerShown: false`); a floating X (close) button replaces it to reclaim vertical space.

### Page-by-page

| Page | File | Purpose |
| --- | --- | --- |
| Par | `components/par-page.tsx` | Three big tap buttons (Par 3 / 4 / 5) → `useUpdateHole`. Auto-advances to next page on selection. |
| Score | `components/score-page.tsx` | Centered dedicated score entry: the shared 3×3 `ScoreGrid` (par-relative circle/square glyphs) writing `hole.score` via `useUpdateHole`. Auto-advances on selection (not on tap-again deselect). Mirrors the Par page's layout. |
| Drive | `components/drive-page.tsx` | Tall fairway "oval" with **LF / CF / RF** lanes. Tap to place the drive. CF zone is the inner 40% (0.3–0.7 x-normalized). Tap → `useUpsertShot({ shotType: 'driver', holePatch: { fir } })` — one command carrying the shot **and** the derived `fir`, applied atomically server-side. Below: a **club chip row** (`ClubChips`, fed from the bag sorted longest→shortest via `sortByDriveLength`) writing `hole.driveClub`. |
| Approach | `components/approach-page.tsx` | Concentric ring target (3 / 5 / 10 / 20 / 30 ft) with a pin at center. Tap places shot; computes `onGreen` + `proximityFt`. Tap → `useUpsertShot({ shotType: 'approach', holePatch: { gir } })`. Below the target: an inline **club chip row** (`ClubChips`, fed from the player's bag via `useBag()`, falling back to all clubs) + tap-first **yardage chips** (snaps to 5 yds, parks at 125). |
| Putting | `components/putting-page.tsx` | A drawn beige-green **putt board** (fringe + stipple, same palette as the targets): five horizontal distance lanes `25+ / 15–25 / 10–15 / 3–10 / <3 ft` ordered far→near with the cup + flag at the bottom. Each lane is split into a **MADE** and a **MISS** tap column; tapping a column appends a putt glyph there (filled disc = made, open ring = miss) with a live count. Tap a glyph to remove it. Distance + made/miss is all that's stored — no putt coordinates. Each tap is `useCreatePutt`/`useDeletePutt`; the hole's putt count recomputes in the optimistic cache update and again in the server transaction. |
| Stats | `components/hole-stats-page.tsx` | Tap-first form, **autofilled from the earlier pages** (score from Score, putts from Putting, FIR from Drive, GIR from Approach) and still editable here: score grid (3×3, par-relative indicators — single/double circle for birdie/eagle, "Par" label, single/double/triple square for bogey/double/triple), count rows for Putts/Chip Shots/Greenside Sand/Penalties, ✓/✗ toggles for FIR/GIR/U&D, notes. Round-wide summary bar at top. |

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

### The data layer (`lib/data/`)

The server's `/data` REST API is the only store. The client pieces:

- **`lib/data/query-client.ts`** — the app-wide `QueryClient`: persisted to AsyncStorage (`buster` = signed-in user id, so an account switch never rehydrates another account's cache), `focusManager` wired to AppState (foreground = refetch = how a second device stays current), `onlineManager` wired to `expo-network`. Queries with pending outbox commands are **excluded** from focus/reconnect refetches so a server response can't clobber optimistic taps.
- **`lib/data/keys.ts`** — query key factory; every key is `['u', userId, …]`.
- **`lib/data/api.ts` + `lib/data/types.ts`** — typed `/data` fetchers and the snake_case wire ↔ camelCase domain mappers. Domain types live in `lib/data/models.ts`.
- **`lib/data/outbox.ts`** — the write path. Every data mutation is an idempotent `PUT`/`DELETE` keyed by a client UUID: the hook applies it to the query cache **optimistically** (same-frame UI), then enqueues the command in a persisted FIFO (`outbox:v1:<userId>` in AsyncStorage). A single drain loop replays strictly in order (head-of-line blocking is the correctness model) with 5s→60s backoff; when the queue empties, every touched query is invalidated so server truth reconciles the cache. A dead zone mid-round therefore never loses a tap, and there is **no merge logic, no pull cursor, no dirty flags**.
- **Feature hooks** — `lib/data/rounds.ts` (`useRounds`, `useRoundFull`, `useCreateRound`, `useUpdateHole`, `useUpsertShot`, `useCreatePutt`, …), `lib/data/stats.ts` (`useStatsBundle` — the whole lifetime-stats corpus in one request), `lib/data/courses.ts`, `lib/data/journal.ts`, `lib/data/settings.ts` (bag / club yardages / wedge partials / generic keys over one settings query).
- **`lib/local/prefs.ts`** — device-local AsyncStorage prefs (`theme`, `intro_seen`): needed before sign-in, never account data.
- **`lib/auth/provider.tsx`** — `AuthProvider`/`useAuth()`: session, Apple/Google sign-in, sign-out (bounded outbox drain → push-token unregister → server logout → clear outbox + query cache + persister), profile updates, and it mounts `PersistQueryClientProvider`. `useUserId()` feeds the key factory.

Client-generated UUIDs are kept end-to-end (the server keys rows by `(user_id, id)`), which is what makes every outbox command replay-safe and lets a round be **started** offline — `useCreateRound` mints the round + hole ids, seeds the cache, and enqueues one `PUT` carrying the embedded holes.

### Controller pattern

`app/round/[id]/index.tsx` is the thin **controller**. It owns:
- One query: `useRoundFull(id)` → `{ round, holes, shots, putts, review, goals }` (replaces the old four parallel reads). Page mutations patch this cache optimistically, so every tap re-renders the round on the same frame — there is no reload threading.
- The page-paging machinery: `pageHeight` (measured via `onLayout`), `pagingEnabled` `ScrollView`, `snapToOffsets`, `scrollRef`.
- The current `holeNumber`, `currentPage` (for the right-side dot indicator).
- Navigation callbacks (`onPrevHole`, `onNextHole`, `onFinish`).

The page components are dumb children — they receive `{ roundId, hole, shotsForRound | putts }` and call their own mutation hooks from `lib/data/rounds.ts`.

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

### Tables (Postgres, `server/src/db/schema.ts`)

Every user-data table is keyed `(user_id, id)` with client-generated UUID ids; all data columns are nullable (the server is a tolerant store). `updated_at` is **server-stamped** on every `/data` write.

| Table | Key columns | Notes |
| --- | --- | --- |
| `rounds` | `id`, `course_name`, `date_played`, `hole_count`, `completed_at`, `tee_name`, `course_rating`, `slope_rating`, `include_in_handicap`, `exclude_from_sharing`, `created_at` | One row per round. `completed_at` landing non-null triggers the "friend finished a round" push (idempotent via the `round_share_notifications` ledger). |
| `holes` | `id`, `round_id`, `hole_number`, `par`, `score`, `putts`, `fir`, `gir`, `up_and_down`, `approach_distance_yds`, `approach_club`, `drive_club`, `chip_shots`, `sand_shots`, `penalties`, `green_blocked`, `notes` | Created with the round (embedded in the round `PUT`). Unique on `(user_id, round_id, hole_number)` — hole writes upsert against that slot. `fir/gir/up_and_down/green_blocked` are nullable 0/1 (NULL = unset → use derived; see `resolveGir`/`resolveUpAndDown` in `lib/stats.ts`). `green_blocked` = "couldn't reach the green": excluded from GIR, approach-execution stats, **and** U&D. Clubs live on the hole, not the shot. |
| `shots` | `id`, `round_id`, `hole_number`, `shot_type` (`'driver'` \| `'approach'`), `x_norm`, `y_norm`, `intended_x_norm`, `intended_y_norm`, `notes` | One drive + one approach per hole — unique on `(user_id, round_id, hole_number, shot_type)`; the shot `PUT` upserts the slot and can carry a `hole` patch (fir/gir) applied in the same transaction. |
| `putts` | `id`, `round_id`, `hole_number`, `distance_ft`, `made`, `created_at` | Many per hole. `distance_ft` is the bucket upper bound: `3, 10, 15, 25, 50` (the `50` bucket is the open-ended `25+ ft`). The canonical bucket set is `PUTT_BUCKETS` in `lib/stats.ts` (consumed by the summaries and `lib/lifetime-stats.ts`); `components/putting-page.tsx` (`BANDS`) mirrors the same values in reversed board order with abbreviated labels. The putt `PUT`/`DELETE` transactionally recounts `holes.putts`, and a new made putt replaces any other made putt on the hole. |
| `post_round_reviews`, `pre_round_goals` | `id`, `round_id`, … | One per round — unique on `(user_id, round_id)`; the round-scoped `PUT` upserts. |
| `courses`, `tees` | `id` / `id`, `course_id`, rating/slope/par | Saved-course autofill for the new-round modal; find-or-create resolves client-side over the cached list. |
| `journal_entries` | `id`, `tag`, `body`, `created_at` | Standalone notes. |
| `app_settings` | `(user_id, key)`, `value` | Account-level key/value: `bag`, `club_yardages`, `wedge_partials`, tempo, etc. Device prefs (`theme`, `intro_seen`) are **not** here — they're in `lib/local/prefs.ts`. |

Server-owned (non-data) tables: `users`, `refresh_tokens`, `friendships`, `friend_requests`, `round_likes`, `push_tokens`, `round_share_notifications`.

### The /data API (`server/src/data/`)

Request/response CRUD, all idempotent (the outbox replays commands freely):

- Reads: `GET /data/rounds` (list + embedded holes), `GET /data/rounds/:id/full` (everything the round flow renders), `GET /data/stats` (the lifetime-stats corpus, flat arrays), `GET /data/courses`, `GET /data/journal`, `GET /data/settings`.
- Writes: `PUT /data/rounds/:id` (optionally with embedded `holes[]` — round creation is one command), `DELETE /data/rounds/:id` (**hard delete**, cascades to children + likes), `PUT /data/rounds/:rid/holes/:n`, `PUT|DELETE …/holes/:n/shots/:shotType` (with optional `hole` patch), `PUT|DELETE /data/putts/:id`, `PUT …/review`, `PUT …/goals`, `PUT|DELETE /data/journal/:id`, `PUT /data/settings/:key`, `PUT /data/courses/:id`, `PUT /data/tees/:id`.
- Column allowlists come from `server/src/sync/tables.ts` (`TABLE_SPECS`); rate bucket `data` = 600/min/user (sized for an offline 18-hole round replaying on reconnect).

Schema changes are drizzle migrations in `server/migrations/` (`npx drizzle-kit generate`, applied on container start). When you add a hole/round column: server schema + migration + `TABLE_SPECS` allowlist + the `SELECT` column lists in `server/src/data/service.ts`, then client `lib/data/models.ts`, the wire type + mapper in `lib/data/types.ts`, and (for holes) `HOLE_FIELD_TO_COLUMN` in `lib/data/rounds.ts`.

### Invariants (now server transactions + mirrored optimistic updates)

- **`putts` ↔ `holes.putts`**: the putt `PUT`/`DELETE` recounts inside one transaction; `useCreatePutt`/`useDeletePutt` mirror the recount (and the made-putt replacement) in the cache so the UI is right immediately.
- **`shots` ↔ `holes.fir / gir`**: the shot command carries the derived value as a `hole` patch, applied atomically. Manual override on the Stats page still wins (plain hole write).
- The server tests (`server/test/data.test.ts`) are the contract for these; the drain-complete invalidation converges any optimistic drift.

### Legacy migration (one release only)

`lib/migration/legacy-flush.ts` handles upgrades from the old local-first builds: at cold start it copies `theme`/`intro_seen` out of the old SQLite `app_settings` into prefs, and once signed in it pushes any `dirty = 1` rows through the retained `POST /sync/push`, then deletes `caddy-book.db`. `expo-sqlite` and the server's `/sync/*` routes exist only for this path — remove both (plus this module) once existing installs have upgraded.

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
| `/(tabs)/stats` | **Built.** Lifetime stats across **completed** rounds. Two **dropdown** filters (`components/dropdown-select.tsx`): hole count (All / 18 / 9, **defaults to 18**) and recency (last 20 / 40 / 60 / All). A muted sample-size caption (`N rounds · N holes`) replaces the old corpus card. Sections: scoring (adapts to filter — real scoring avg when a single hole count is selected, fair per-18 to-par when mixed), per-par averages, GIR/FIR/U&D + putting trio, over-time trend sparklines (scoring, GIR%, putts), score distribution, aggregate driver & approach dispersion (small muted pins), approach-distance histogram (bars split by green-hit/missed via GIR), putting make% by distance, trouble/short-game (**per-round** penalties/chips/sand), and post-round review insights. Logic in `lib/lifetime-stats.ts`; one cached server read via `useStatsBundle()` (`lib/data/stats.ts`); sparkline in `components/trend-chart.tsx`. |
| `/round/new` | Modal: course name, date, 9/18, **your bag** (`BagPicker` multi-select; persists to the account settings via `useSetBag`, pre-filled with all clubs first time). On submit: `useCreateRound` (mints round + hole UUIDs, seeds the cache, queues one PUT — works offline) → `router.replace('/round/[id]')`. |
| `/round/[id]` | The whole round flow (5 vertically-paged sub-pages). Hidden nav header. "Finish" → `/round/[id]/review`. |
| `/round/[id]/review` | **Built.** 5-question post-round review (most costly / decision rating / common miss / range focus / overall rating), one vertically-paged question each. On submit: `useUpsertReview` + `useUpdateRound({ completedAt })` (first time only) → `/round/[id]/summary`. |
| `/round/[id]/summary` | **Built.** Read-only round summary: score/to-par card, GIR/FIR/U&D + putting/penalty tiles, scoring-by-par, score distribution bars, drive & approach dispersion targets, putting-by-distance bars, post-round review answers, "Edit round" CTA. |

## Conventions

- **TypeScript strict.** No `any` in new code unless escaping a typed-routes friction (cast on `router.push/replace` paths only).
- **Auto-save on every interaction.** No "Save" buttons inside the round flow. Tap toggles / numeric commits / `onBlur` for text — each calls a mutation hook that patches the query cache optimistically and enqueues the command. Never `await` the network before updating the UI.
- **All data writes go through the outbox** (a mutation hook in `lib/data/*` that does `setQueryData` + `enqueue`). Direct `authedRequest` calls are reserved for profile, community/social actions, and push tokens — request/response features where the server's answer *is* the result.
- **Page wrappers always `height: pageHeight`.** The outer `ScrollView` uses `pagingEnabled`; do not put naturally-sized content directly inside it without a fixed-height wrapper or it will be paginated as multiple virtual pages.
- **Targets stay tap-first.** When adding a new shot type (chip target, putt-stroke arc, etc.), reuse the `DriverTarget` / `ApproachTarget` pattern: a centered visual + `Pressable` capturing `nativeEvent.locationX/Y` normalized to the layout, decorative children set to `pointerEvents="none"`.
- **Lint and types must pass.** `npx tsc --noEmit && npx expo lint` before shipping; `npm run typecheck && npm test` in `/server` for backend changes (tests need the docker-compose Postgres on `localhost:5433`).

## Common edits — where to look

| Task | File(s) |
| --- | --- |
| Add a new stat field on a hole | `server/src/db/schema.ts` + a drizzle migration + `TABLE_SPECS` (`server/src/sync/tables.ts`) + SELECT lists in `server/src/data/service.ts`; client: `lib/data/models.ts`, `lib/data/types.ts` (wire type + mapper), `HOLE_FIELD_TO_COLUMN` in `lib/data/rounds.ts`, then `hole-stats-page.tsx` or a new component |
| Add a new page in the round flow | New `components/<name>-page.tsx`, add to `app/round/[id]/index.tsx` (controller render + adjust `totalPages`) |
| Change CF lane width | `lib/shots.ts` (`CF_LEFT_EDGE` / `CF_RIGHT_EDGE`) — used by both the math and the visual lanes in `driver-target.tsx` |
| Change ring proximity thresholds | `lib/shots.ts` (`APPROACH_RINGS`) — shared by `approach-target.tsx` visuals and `approachResult` math |
| Tweak GIR / U&D derivation | `lib/stats.ts` (`deriveGir`, `resolveGir`, `deriveUpAndDown`, `resolveUpAndDown`) — both `computeRoundSummary` and the stats page rows consume these |
| Adjust the sticky bottom nav | `components/sticky-hole-nav.tsx` (uses `useSafeAreaInsets` for the home indicator) |
| Give a card/button/input the drawn border | Wrap it in `SketchSurface` (`components/sketch.tsx`) — don't add `borderWidth`/`borderColor` |
| Add/adjust a new hand-drawn shape | `lib/sketch.ts` (seeded geometry) + a component in `components/sketch.tsx` |
| Change the paper grain / registration marks | `Paper` in `components/sketch.tsx` (mounted in `components/screen.tsx`) |
| Tune the post-round summary | `app/round/[id]/summary.tsx`; review question flow → `app/round/[id]/review.tsx` + `lib/review.ts` |

## Pending cleanup (next release, after existing installs upgrade)

The server **is deployed** on the VPS (docker compose + Cloudflare Tunnel; deploy with `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build` in `/server`). Auth (refresh-token rotation + reuse detection), the community/social API, push notifications, and the `/data` CRUD layer are all live.

Once existing installs have run the legacy flush:
- Remove `server/src/sync/` (routes/push/pull) and its tests; relocate `tables.ts` into `server/src/data/`.
- Drizzle migration to drop the `deleted_at` columns + the `server_seq` sequence/triggers; strip the `deleted_at IS NULL` filters from `server/src/community/routes.ts` and `server/src/data/service.ts`.
- Remove `lib/migration/legacy-flush.ts`, `pushChanges` in `lib/api/client.ts`, the sync wire types in `lib/api/types.ts`, and the `expo-sqlite` dependency.
- `lib/dev-seed.ts` batches through `/sync/push` — give it a bulk `/data` path (or drop it) when the sync routes go.
