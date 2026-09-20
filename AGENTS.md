# AGENTS.md

Guidance for an AI coding agent working in this repository. Read this
before making changes — it covers the conventions the codebase already
follows and, in particular, exactly how to add a new game mode without
breaking the pattern the rest of the code relies on.

For a feature-level description of the app (what it does, why state lives
on the server, the sound/board/history subsystems), see [README.md](README.md).
For the remote board's HTTP API, see [API_STATE.md](API_STATE.md).

## Commands

```bash
npm ci
npm run dev         # server on :3001, Vite on :5173, both with hot reload
npm run typecheck   # tsc --noEmit — run this after any change
npm run build       # typecheck + production build (writes dist/)
npm start           # run the TypeScript server and serve dist/ (build first)
```

There is no automated test suite. Verification is: `npm run typecheck`
passes, and a manual pass through the affected screens in the browser
(`npm run dev`, then http://localhost:5173). If you can't run the app in
your environment, say so explicitly rather than reporting the change as
verified.

## The one rule that matters most

**Nothing outside a game's own file may know that game's rules.** There is
no `if (mode === "x01")` (or `switch (kind) { case "x01": ... }`) anywhere
in the reducer, the components, or the server. Every game — its settings
schema, its scoring/bust/checkout logic, its stats, what to show on a
player's panel — lives entirely inside its own file under `src/games/`,
behind the `GameModule` interface (`src/games/types.ts`). Everything else
in the app is generic over `GameModule` and does not change when a game is
added or changed.

If you find yourself writing a conditional keyed on a game's `kind` outside
`src/games/*.ts`, that's a sign the logic belongs inside a module instead —
either the existing one, or (if it's genuinely cross-game) a new method
added to the `GameModule` interface itself, implemented by every module.

## Architecture, briefly

- **The server owns the match.** `src/game/reducer.ts` is a
  synchronous state machine (`reducer(state, action) -> state`) with zero
  I/O — no `fetch` or timers. Match creation assigns an ID and timestamp;
  modules may randomize their initial game state. `server/index.ts` holds
  the one live instance, applies actions to it, persists it, and pushes
  every change to every connected client over server-sent events
  (`GET /api/game/stream`).
- **Clients are dumb.** `src/state/store.tsx` subscribes to the SSE stream
  and turns `dispatch(action)` into `POST /api/game/action`. No client
  keeps its own copy of game state beyond what the server just sent it —
  refreshing, or a second device joining, just re-attaches to the same
  match in progress.
- **Persistence is flat JSON, not a database.** `server/jsonStore.ts` is a
  small debounced, atomic (write-then-rename) file store. Four instances
  in `server/index.ts`: the in-progress match (`data/state.json`, schema
  versioned — see `GAME_STATE_VERSION` in `reducer.ts`), the player roster
  (`data/players.json`), game history (`data/history.json`), and the board
  address (`data/board.json`). This is intentional given a single writer
  and no external consumers; don't introduce a real database without a
  reason that changes those facts.
- **Only the server talks to the board.** `server/index.ts` polls
  `GET /api/state` on an interval and turns new throws into actions. If a
  client polled the board directly, every open tab would score the same
  dart again.
- **Client state that's genuinely per-device** (which local screen is open,
  whether a modal is showing, whether this device is muted) stays in React
  state / `localStorage` and never goes near the reducer.

## Code conventions already in use — follow them

- Comments explain **why**, not what — a non-obvious invariant, a constraint
  from the board's firmware, a tradeoff. Do not add comments that restate
  the code, and do not reference a specific task, session, or bug report by
  name — write as if this were an established open-source project, because
  it is one.
- No feature flags, no speculative abstraction for hypothetical future
  games, no defensive validation for inputs that can't occur (e.g. the
  client-action allowlist in `reducer.ts` is the actual boundary — code
  past it can trust the shape). Keep changes scoped to what was asked.
- Settings for a game live with that game (`defaultSettings` /
  `settingsFields` on its `GameModule`), not in a shared settings type.
  `GameSettingsModal.tsx` renders whatever fields the active module
  declares; it has no per-game knowledge of its own.
- Prefer extending the `GameModule` interface (in `src/games/types.ts`) over
  adding a special case somewhere else, even if only one game currently
  needs the new method. Every existing module has to implement it, which is
  the point — it's what keeps the "no branching" rule enforceable rather
  than aspirational.

## Adding a new game mode

Worked through concretely, adding a hypothetical "Countdown" game:

1. **Add the kind.** In `src/types.ts`, add `"countdown"` to the `GameKind`
   union:
   ```ts
   export type GameKind = "x01" | "atc" | "cricket" | "shanghai" | "gotcha" | "bobs27" | "countdown";
   ```

2. **Write the module.** Create `src/games/countdown.ts`. It owns every type
   and every rule specific to this game — nothing here is shared with or
   visible to `x01.ts` or `atc.ts`:
   ```ts
   import type { PlayerProgress, Segment } from "../types";
   import type { DisplayFields, GameModule, GameStats, SettingsField, StatLine, TurnResult } from "./types";

   export interface CountdownSettings { /* whatever this game needs configurable */ }
   export interface CountdownGame { /* this game's per-player state */ }
   // A MatchContext is only needed for state shared across all players at
   // match start. Existing games use `createMatchContext: () => undefined`;
   // ATC stores its random order separately in each player's game state.

   const defaultSettings: CountdownSettings = { /* ... */ };
   const settingsFields: SettingsField<CountdownSettings>[] = [ /* ... */ ];

   function initGame(settings: CountdownSettings): CountdownGame { /* ... */ }

   function replayTurn(start: CountdownGame, darts: Segment[], settings: CountdownSettings): TurnResult<CountdownGame> {
     // Replay is always from-scratch over the darts thrown so far this turn,
     // not incremental — see replayCurrentTurn in reducer.ts. This is what
     // lets a dart already thrown this turn be edited (EDIT_DART) or a
     // completed turn be reopened (undoLastTurn) for free: both just re-run
     // this function over a different dart list.
   }

   function display(progress: PlayerProgress<CountdownGame>, settings: CountdownSettings): DisplayFields { /* ... */ }
   function turnTotal(darts: Segment[], start: CountdownGame, settings: CountdownSettings): number { /* ... */ }
   function statsFromProgress(progress: PlayerProgress<CountdownGame>, settings: CountdownSettings): GameStats { /* ... */ }
   function aggregateStats(records: GameStats[]): StatLine[] { /* ... */ }
   function recordSummary(stats: GameStats): string { /* ... */ }

   export const CountdownModule: GameModule<CountdownSettings, CountdownGame> = {
     kind: "countdown",
     title: "COUNTDOWN",
     description: "...",
     defaultSettings,
     settingsFields,
     settingsSummaryChips: (settings) => [ /* short chips for the mode-select tile */ ],
     createMatchContext: () => undefined,
     initGame,
     replayTurn,
     display,
     turnTotal,
     statsFromProgress,
     aggregateStats,
     recordSummary,
     highlightNumber: (game) => null, // or a number, if the game has a "current target"
   };
   ```

3. **Register it.** In `src/games/registry.ts`:
   ```ts
   import { CountdownModule } from "./countdown";
   // ...
   export const GAME_MODULES: Record<GameKind, AnyGameModule> = {
     x01: X01Module,
     atc: AtcModule,
     cricket: CricketModule,
     shanghai: ShanghaiModule,
     gotcha: GotchaModule,
     bobs27: Bobs27Module,
     countdown: CountdownModule,
   };
   export const GAME_LIST: AnyGameModule[] = [
     X01Module, AtcModule, CricketModule, ShanghaiModule, GotchaModule, Bobs27Module, CountdownModule,
   ];
   ```

That's the whole integration surface. No other file changes:
`ModeSelect.tsx` picks it up in the mode grid automatically; `PlayerSetup`,
`GameSettingsModal`, `GameView`, `PlayerPanel`, `HistoryScreen` and
`PlayersScreen` are all written against `GameModule` and render whatever
the new module returns. The reducer blocks further darts when `replayTurn`
reports `turnOver: true` and keeps the visit editable until a button handoff
or a completed board takeout commits it, regardless of which game is active.

Helpers in `src/games/segment.ts` (`segmentValue`, `isDoubleSegment`,
`isBullSegment`, `segmentLabel`) are shared scoring primitives every game
is free to use — they're about the dartboard itself (what a `Segment`
means in points, whether it's a bull, etc.), not about any one game's
rules, which is why they don't live inside a specific game's file.

## Things that look like bugs but aren't

- **`connected: false` while the board is actively detecting.** Confirmed
  against a live board — `connected` tracks the camera hardware link, not
  the detection engine. `src/boardStatus.ts` deliberately ignores it in
  favor of `status`/`event`.
- **A turn ends before a 3rd dart in some games.** X01 ends on a bust
  or checkout; ATC ends when the last target is cleared. `turnOver` in
  `TurnResult` is the module's call, not a fixed dart count.
- **`awaitingTakeout` in `GameState`.** Darts from the previous turn (or
  from before the match started) can still be sitting in the board when a
  new turn begins; this flag makes the reducer ignore board throws until
  the board is empty and back in `Throw` status, so stale darts don't get
  scored against whoever's up next.
