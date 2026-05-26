# Caddy Book — App Overview

A local-first golf caddy book for iOS & Android. Caddy Book turns recording a
round into **tapping on shapes that carry meaning** — a fairway, a ring target,
a putt grid — instead of filling out forms. Its purpose is **stat tracking with
a visual, spatial design language**, presented as a printed field notebook
rather than a SaaS dashboard.

This document is a tour of *what the app does* and *the principles behind how it
looks and feels*. For implementation detail see [`CLAUDE.md`](./CLAUDE.md)
(architecture, data model) and [`DESIGN.md`](./DESIGN.md) (the full visual
language).

---

## What it is

- **Platform:** Expo SDK 54 (managed), React Native 0.81, TypeScript, Expo
  Router with file-based, typed routes.
- **Storage:** entirely on-device via `expo-sqlite`. No backend, no account —
  your data lives on your phone.
- **Look:** custom theme + RN primitives, with a hand-drawn SVG visual system
  (`react-native-svg`) and the **Fraunces** serif as the display face. No
  third-party UI kit.

---

## Features

### Recording a round
A round is a single screen of **4–5 vertically-paged sub-pages**. You move
between pages within a hole by **vertical swipe**, and between holes via a sticky
bottom nav (`‹ / ›`). Par 3 holes skip the Drive page. Everything **auto-saves
on every tap** — there are no Save buttons.

| Page | What you do |
| --- | --- |
| **Par** | Three big tap buttons (Par 3 / 4 / 5); auto-advances. |
| **Drive** | A tall fairway "oval" with LF / CF / RF lanes — tap to place your drive; fairway-hit (FIR) derives from the lane. A club-chip row records the driving club. |
| **Approach** | A concentric ring target (3/5/10/20/30 ft) with a center pin — tap to place the shot; green-in-regulation (GIR) and proximity derive from where you tapped. Club chips + a tap-first yardage ruler record the approach. |
| **Putting** | A drawn putt board with five distance lanes split into **MADE / MISS** columns. Tap to add a putt glyph (filled disc = made, open ring = miss); tap a glyph to remove it. Only distance bucket + made/miss is stored. |
| **Stats** | A tap-first form: a 3×3 par-relative score grid, count rows (putts, chips, sand, penalties), ✓/✗ toggles for FIR/GIR/U&D, and notes. A round-wide summary sits at the top. |

### Post-round flow
- **Review** (`/round/[id]/review`): a 5-question post-round reflection (most
  costly mistake, decision rating, common miss, range focus, overall rating),
  one swipeable question each.
- **Summary** (`/round/[id]/summary`): a read-only recap — score / to-par,
  GIR/FIR/U&D + putting/penalty tiles, scoring by par, score distribution,
  drive & approach dispersion targets, putting-by-distance bars, and the review
  answers, with an "Edit round" CTA.

### Lifetime Stats tab
Aggregates across **completed** rounds with two dropdown filters (hole count,
defaulting to 18; and recency). It shows scoring averages (normalized per-18
when hole counts are mixed), per-par averages, GIR/FIR/U&D + putting trio,
over-time trend sparklines, score distribution, aggregated driver/approach
dispersion, an approach-distance histogram split by green hit/missed, putting
make% by distance, per-round trouble/short-game stats, and post-round review
insights. The Stats tab is designed to **reward amassed data and tell the
golfer's story over time.**

### Practice tools (the side menu)
A slide-out menu (hamburger → `/menu`) holds standalone reference tools, plus
Settings pinned at the bottom:

- **Stock yardages** (`/tools/yardages`): your full carry per club, edited
  against a club "fan" / arc visualization, scoped to your bag.
- **Wedge grid** (`/tools/wedge-grid`): full · ¾ · ½ · ¼ carries per wedge, with
  a carry-range hero chart (dot size = swing power) above a tap-to-edit grid.
- **Tempo trainer** (`/tools/tempo`): a 3:1 swing metronome with audio + haptics
  and a pendulum animation.

### Your bag & settings
- **Bag**: a multi-select club list persisted globally (`app_settings`). It
  feeds the club chips in the round flow and scopes the practice tools. Set on
  first round creation and editable from the tools.
- **Themes**: five complete two-color presets — *Pinehurst* (deep green on warm
  paper, the default), *Links* (navy on sand), *Clay* (terracotta on bone),
  *Charcoal* (near-black on cream), and *Midnight* (light sage on dark). Picked
  in Settings; recolors the entire app at runtime.

---

## Design principles

The interaction and visual language rest on two ideas pulling the same
direction: **tap-first spatial input** and an **editorial print aesthetic**.

### 1. Tap-first; the keyboard is the exception
A `Pressable` on a meaningful shape is the default input. A `TextInput` is a
fallback reserved for genuinely free-form text (notes, course name, a custom
club). Every tap, numeric commit, and `onBlur` writes to SQLite immediately and
refreshes state — no "Save" buttons anywhere in the round flow.

### 2. Shape encodes meaning
The form of a thing carries its data, re-derived on every render from raw stored
values: a score under par is a **circle** (double = eagle+), over par a
**square** (double/triple = double/triple bogey), at par the word **Par**; a
drive is a **lane** (x-position); an approach is **distance from the pin**; a
putt is a **column** (distance) and a **side** (made/missed). This vocabulary is
shared — the same `ScoreGlyph` appears in the grid, the rounds list, and the
summary.

### 3. Position is data
Shots store normalized `(x_norm, y_norm)` in `[0,1]` relative to the target's
bounding box, so dispersion overlays scale to any screen. Targets capture the
tap location and normalize it; other shots in a round render as **muted** pins
beneath the current prominent one — a built-in dispersion view.

### 4. Derived stats are first-class, override is one tap away
GIR auto-derives from `(score − putts) ≤ par − 2`; U&D from
`(missed GIR) ∧ (score ≤ par)`. The derived value shows by default with a hint;
tapping the toggle writes a manual override straight to the column. You're never
blocked waiting on the app to compute something.

### 5. Restraint is the aesthetic
Two colors carry everything (ink on paper). No extra hues, drop shadows,
gradients, or a third border weight. To emphasize a surface, **fill it with the
accent**; to make it recede, **leave it on paper**. The non-default
`danger`/`warning`/`info` colors exist **for chart categories only** — never for
chrome.

### 6. The drawn line
All hand-drawn geometry is **deterministic** — seeded by a string so a shape
looks sketched but never reflows between renders (`lib/sketch.ts`,
`components/sketch.tsx`). A faint paper grain and corner registration marks
(`Paper`) sit under every screen; cards, buttons, and inputs get their frame
from `SketchSurface` rather than `borderWidth`. The line is a *precise
draftsman*, not a doodle.

### 7. Editorial typography
**Fraunces** (serif) is the display and label face — titles, hole headers, and
every numeral that represents a score, par, or stat. System sans is for running
body text only. Captions are sans, small, uppercase, and letter-spaced — the
"stamped label" look.

### Selection convention
Consistent everywhere: **selected = filled accent + sand grain**;
**unselected = paper + a drawn outline**. Pressed state is opacity on the
wrapping `Pressable`, never a background swap.

---

## How it hangs together

- **Controller pattern:** `app/round/[id]/index.tsx` is a thin controller owning
  round state (`round`, `holes`, `shots`, `putts`) and the paging machinery; the
  five page components are dumb children that mutate the DB directly and call
  `onChange` to reload.
- **Runtime theming:** components read the active palette via `useColors()` /
  `useTheme()` (theme context) and build styles with `makeStyles(colors)` —
  never importing the static `colors` object in UI.
- **Schema evolution:** no versioned migration runner yet; `db/client.ts`
  handles new tables (`CREATE TABLE IF NOT EXISTS`) and new columns
  (`ensureColumn` → `ALTER TABLE`) on boot.

---

## Not built yet
- Versioned migrations (acceptable while pre-launch).
- A backend / sync (intentionally local-first for now).
