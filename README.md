# Caddy Book

A local-first golf caddy book for iOS and Android, built with Expo (SDK 54) + React Native + Expo Router.

## Run it

```bash
npm install
npm run ios        # iOS simulator (requires Xcode)
npm run android    # Android emulator (requires Android Studio)
npm run start      # Metro bundler — scan QR with Expo Go, or pick a target
```

## Stack

- **Expo (managed)** with TypeScript
- **Expo Router** for file-based navigation
- **expo-sqlite** for on-device persistence (schema in `db/schema.ts`)
- Custom theme — offwhite/grey background with `#1B4D3E` accent (`constants/theme.ts`)

## Layout

```
app/                        # Screens (file-based routes)
  _layout.tsx               # Root stack, runs DB init on boot
  (tabs)/
    _layout.tsx             # Bottom tabs: Rounds | Stats
    index.tsx               # Rounds list
    stats.tsx               # Lifetime stat trends
  round/
    new.tsx                 # Start a new round (modal)
    [id]/
      index.tsx             # Round overview / per-round summary
      hole/[holeNumber].tsx # Per-hole stat entry
      shots.tsx             # Shot dispersion tracker
      review.tsx            # Post-round review
components/
  screen.tsx                # Safe-area screen wrapper
  themed-text.tsx           # Typography primitive
  themed-view.tsx           # Background primitive
  haptic-tab.tsx            # Tab bar button with haptic feedback
  ui/icon-symbol.{ios,}.tsx # Cross-platform icons
constants/
  theme.ts                  # Colors, spacing, radius, typography
db/
  client.ts                 # expo-sqlite open + init
  schema.ts                 # CREATE TABLE statements
  types.ts                  # TypeScript types for rows
```

## Data model

Stored in `caddy-book.db` on device. Four tables:

- `rounds` — one row per round (course, date)
- `holes` — one row per hole per round (par, FIR, GIR, U&D, score, putts, approach distance/club, notes)
- `shots` — driver and approach shot landings, normalized 0–1 coordinates so dispersion scales to any screen
- `post_round_reviews` — tactical, technical, mental notes + went well / didn't go well / will work on

Migrations are not yet wired in. When the schema changes, bump `SCHEMA_VERSION` and add migration logic in `db/client.ts`.

## What's next

This is the scaffold only — no feature logic yet. Screens render placeholder content. Wire up CRUD against `db/client.ts` to start logging real rounds.
