import { GAME_LIST, getGameModule, type AnyGameModule } from "../games/registry";
import type { BoardState, DartThrow, GameKind, PlayerProgress, Segment } from "../types";

/**
 * The whole shared game state. This lives on the local server so that a
 * refresh — or a second device opening the app — sees the same match in
 * progress, and so that board throws are scored exactly once.
 *
 * Purely local UI concerns (e.g. whether the settings modal is open) are
 * deliberately NOT in here; they stay in the browser.
 */
/**
 * Bumped whenever `GameState`'s shape changes incompatibly. A persisted
 * file from an older version is discarded rather than patched field by
 * field — this app has one writer and no external consumers of the file,
 * so there's nothing to migrate for. A stale shape left half-patched can
 * fail silently (an id of the wrong type just never matches) rather than
 * erroring, so a clean reset is safer than trying to reconcile old data.
 */
export const GAME_STATE_VERSION = 1;

export interface GameState {
  version: number;
  screen: "select" | "setup" | "game";
  mode: GameKind | null;
  /** Roster player ids, in throw order. Names/colours are resolved from the roster. */
  players: string[];
  /** Identity of the current match, for the history record written when it ends. */
  gameId: string | null;
  startedAt: string | null;
  /** Set once this match has been written to history, so it isn't recorded twice. */
  recorded: boolean;
  /** Per-game settings, each shaped by that game's module. */
  settings: Record<GameKind, any>;
  /** Optional per-player overrides for settings that vary by competitor. */
  playerSettings: Record<GameKind, Record<string, Record<string, unknown>>>;
  autoscoring: boolean;
  activePlayerIndex: number;
  /** Per-player bookkeeping; `game` is opaque here and only the active module reads it. */
  progress: Record<string, PlayerProgress<unknown>>;
  matchContext: unknown;
  currentTurnDarts: Segment[];
  /** Active player's game state as of the start of the current turn, replayed as darts land. */
  turnStartGame: unknown;
  /** True once no more darts may be added; the visit stays editable until handoff. */
  turnComplete: boolean;
  prevNumThrows: number;
  /**
   * True while darts from a previous turn (or from before the match) are
   * still stuck in the board. Board throws are ignored until they come out,
   * so they can't be scored against whoever is up next.
   */
  awaitingTakeout: boolean;
  /** Null whenever the board is unreachable, so the UI reports it as offline. */
  boardState: BoardState | null;
  winnerId: string | null;
  /**
   * Recent notable happenings, for client-side feedback such as sounds.
   * Emitted here rather than derived by clients so that every device plays
   * the same thing, and so a turn that ends on its third dart still
   * reports the dart as well as the change of turn.
   */
  events: GameEvent[];
  eventSeq: number;
}

export type GameEventKind = "hit" | "miss" | "bust" | "advance" | "turn" | "win";

export interface GameEvent {
  /** Monotonic, so a client can tell which events it has already played. */
  seq: number;
  kind: GameEventKind;
  /** Optional player whose sound profile should be used for this event. */
  playerId?: string | null;
}

/** Only the most recent few are kept; clients only care about what's new. */
const MAX_EVENTS = 8;

function emit(state: GameState, kinds: GameEventKind[], playerId?: string | null): GameState {
  if (kinds.length === 0) return state;
  let seq = state.eventSeq;
  const events = [...state.events];
  for (const kind of kinds) events.push({ seq: ++seq, kind, playerId: playerId ?? null });
  return { ...state, events: events.slice(-MAX_EVENTS), eventSeq: seq };
}

export type Action =
  | { type: "SELECT_MODE"; mode: GameKind }
  | { type: "BACK_TO_SELECT" }
  | { type: "SET_SETTINGS"; kind: GameKind; patch: Record<string, unknown> }
  | { type: "SET_PLAYER_SETTINGS"; kind: GameKind; playerId: string; patch: Record<string, unknown> }
  | { type: "ADD_PLAYER"; playerId: string }
  | { type: "REMOVE_PLAYER"; playerId: string }
  | { type: "REORDER_PLAYERS"; playerIds: string[] }
  | { type: "SET_AUTOSCORING"; value: boolean }
  | { type: "START_GAME" }
  | { type: "EXIT_GAME" }
  | { type: "BOARD_STATE_UPDATE"; state: BoardState }
  | { type: "BOARD_UNREACHABLE" }
  | { type: "MARK_RECORDED" }
  | { type: "MANUAL_DART"; segment: Segment }
  | { type: "EDIT_DART"; index: number; segment: Segment }
  | { type: "UNDO_DART" }
  | { type: "NEXT_TURN" };

export const MAX_PLAYERS = 6;

function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Whether a loaded value still matches the current `GameState` shape
 * closely enough to resume from. Deliberately conservative: this only
 * needs to catch drift, not police every field, because the cost of a
 * false negative is losing one in-progress match, while the cost of a
 * false positive is a state machine fed data it doesn't understand.
 */
export function isCompatibleGameState(value: unknown): value is GameState {
  if (typeof value !== "object" || value === null) return false;
  const state = value as Partial<GameState>;
  return (
    state.version === GAME_STATE_VERSION &&
    Array.isArray(state.players) &&
    state.players.every((p) => typeof p === "string") &&
    typeof state.progress === "object" &&
    state.progress !== null
  );
}

function defaultSettings(): Record<GameKind, any> {
  const entries = GAME_LIST.map((module) => [module.kind, module.defaultSettings] as const);
  return Object.fromEntries(entries) as Record<GameKind, any>;
}

function defaultPlayerSettings(): Record<GameKind, Record<string, Record<string, unknown>>> {
  return Object.fromEntries(GAME_LIST.map((module) => [module.kind, {}])) as Record<
    GameKind,
    Record<string, Record<string, unknown>>
  >;
}

export function getPlayerSettings<T>(state: GameState, module: AnyGameModule, playerId: string): T {
  const activeKind = state.mode ?? module.kind;
  const baseSettings = state.settings[activeKind] as T;
  const playerOverrides = ((state.playerSettings ?? defaultPlayerSettings())[activeKind]?.[playerId] ?? {}) as Partial<T>;
  if (module.resolvePlayerSettings) return module.resolvePlayerSettings(baseSettings, playerOverrides);
  return { ...baseSettings, ...playerOverrides } as T;
}

export function initialState(): GameState {
  return {
    version: GAME_STATE_VERSION,
    screen: "select",
    mode: null,
    players: [],
    gameId: null,
    startedAt: null,
    recorded: true,
    settings: defaultSettings(),
    playerSettings: defaultPlayerSettings(),
    autoscoring: false,
    activePlayerIndex: 0,
    progress: {},
    matchContext: undefined,
    currentTurnDarts: [],
    turnStartGame: undefined,
    turnComplete: false,
    prevNumThrows: 0,
    awaitingTakeout: false,
    boardState: null,
    winnerId: null,
    events: [],
    eventSeq: 0,
  };
}

/** Replays the darts thrown so far this turn, without committing them. */
function replayCurrentTurn(state: GameState) {
  if (!state.mode) return null;
  const module = getGameModule(state.mode);
  const playerId = state.players[state.activePlayerIndex];
  const settings = playerId ? getPlayerSettings(state, module, playerId) : state.settings[state.mode];
  return module.replayTurn(state.turnStartGame, state.currentTurnDarts, settings, state.matchContext);
}

type TurnStart = Pick<
  GameState,
  "turnStartGame" | "currentTurnDarts" | "turnComplete" | "prevNumThrows" | "awaitingTakeout"
>;

/**
 * Begins a turn for whoever is now active. Any darts currently in the board
 * belong to the turn (or match) that just ended, so they're skipped and we
 * wait for a takeout — otherwise starting a game with darts still in the
 * board would immediately score them against the first player.
 */
function startTurnSnapshot(state: GameState): TurnStart {
  const playerId = state.players[state.activePlayerIndex];
  const dartsInBoard = state.boardState?.numThrows ?? 0;
  return {
    turnStartGame: playerId ? state.progress[playerId]?.game : undefined,
    currentTurnDarts: [],
    turnComplete: false,
    prevNumThrows: dartsInBoard,
    awaitingTakeout: dartsInBoard > 0,
  };
}

function advanceToNextPlayer(state: GameState): GameState {
  if (state.players.length === 0 || state.winnerId) return state;

  const activePlayerIndex = (state.activePlayerIndex + 1) % state.players.length;
  const nextPlayerId = state.players[activePlayerIndex] ?? null;
  const started = startTurnSnapshot({ ...state, activePlayerIndex });
  const advanced = { ...state, activePlayerIndex, ...started, turnComplete: false };
  return emit(advanced, state.players.length > 1 ? ["turn"] : [], nextPlayerId);
}

function commitTurn(state: GameState): GameState {
  const playerId = state.players[state.activePlayerIndex];
  const result = replayCurrentTurn(state);
  if (!playerId || !result) return state;

  const prev = state.progress[playerId];
  const progress: Record<string, PlayerProgress<unknown>> = {
    ...state.progress,
    [playerId]: {
      dartsThrown: prev.dartsThrown + state.currentTurnDarts.length,
      history: [...prev.history, result.history],
      game: result.game,
    },
  };

  const module = state.mode ? getGameModule(state.mode) : null;
  const resolvedProgress = module?.resolveAfterTurn?.(
    progress,
    playerId,
    state.mode ? state.settings[state.mode] : undefined,
    state.matchContext,
  ) ?? progress;

  const next: GameState = { ...state, progress: resolvedProgress, winnerId: result.won ? playerId : state.winnerId };
  if (result.won) return emit(next, ["win"], playerId);

  if (state.mode && module) {
    const resolvedWinner = module.winnerFromProgress?.(
      resolvedProgress,
      state.settings[state.mode],
      state.matchContext,
    ) ?? null;
    if (resolvedWinner) {
      return emit({ ...next, winnerId: resolvedWinner }, ["win"], resolvedWinner);
    }
  }

  return next;
}

/** Keeps completed visits available for review before they are committed at handoff. */
function addDarts(state: GameState, darts: Segment[]): GameState {
  if (state.winnerId || state.turnComplete || darts.length === 0) return state;

  let next: GameState = { ...state, currentTurnDarts: [...state.currentTurnDarts, ...darts] };
  const result = replayCurrentTurn(next);
  if (!result) return next;

  // Whether the darts just thrown counted is the game's call, not ours.
  const landed = result.history.slice(-darts.length);
  const kinds: GameEventKind[] = [landed.some((dart) => dart.hit) ? "hit" : "miss"];
  if (result.event === "bust") kinds.push("bust");
  else if (result.event === "advance") kinds.push("advance");

  const playerId = state.players[state.activePlayerIndex] ?? null;
  next = emit(next, kinds, playerId);
  return { ...next, turnComplete: result.turnOver };
}

/** Replaces one dart of the turn in progress, re-settling the turn exactly as if it had landed that way originally. */
function editDart(state: GameState, index: number, segment: Segment): GameState {
  if (index < 0 || index >= state.currentTurnDarts.length) return state;

  const currentTurnDarts = state.currentTurnDarts.map((seg, i) => (i === index ? segment : seg));
  let next: GameState = { ...state, currentTurnDarts };
  const result = replayCurrentTurn(next);
  if (!result) return next;

  const edited = result.history[index];
  const kinds: GameEventKind[] = edited ? [edited.hit ? "hit" : "miss"] : [];
  if (result.event === "bust") kinds.push("bust");
  else if (result.event === "advance") kinds.push("advance");

  const playerId = state.players[state.activePlayerIndex] ?? null;
  next = emit(next, kinds, playerId);
  return { ...next, turnComplete: result.turnOver };
}

/** Replays a player's whole turn history from scratch, e.g. to recover their score as of some earlier turn. */
function replayHistory(module: AnyGameModule, settings: unknown, ctx: unknown, turns: DartThrow[][]): unknown {
  let g = module.initGame(settings, ctx);
  for (const turn of turns) {
    g = module.replayTurn(g, turn.map((d) => d.segment), settings, ctx).game;
  }
  return g;
}

/**
 * Undoes the last *committed* turn, handing it back to whoever just threw it
 * as their turn in progress — same three darts, editable — rather than just
 * discarding one dart. Corrections remain possible after a handoff, until
 * the next player starts throwing.
 */
function undoLastTurn(state: GameState): GameState {
  if (!state.mode || state.players.length === 0) return state;

  const activePlayerIndex = (state.activePlayerIndex - 1 + state.players.length) % state.players.length;
  const playerId = state.players[activePlayerIndex];
  const prev = state.progress[playerId];
  if (!prev || prev.history.length === 0) return state;

  const module = getGameModule(state.mode);
  const settings = getPlayerSettings(state, module, playerId);
  const lastTurn = prev.history[prev.history.length - 1];
  const history = prev.history.slice(0, -1);
  const currentTurnDarts = lastTurn.map((d) => d.segment);
  const turnStartGame = replayHistory(module, settings, state.matchContext, history);

  const progress: Record<string, PlayerProgress<unknown>> = {
    ...state.progress,
    [playerId]: { dartsThrown: prev.dartsThrown - currentTurnDarts.length, history, game: turnStartGame },
  };

  return {
    ...state,
    progress,
    activePlayerIndex,
    currentTurnDarts,
    turnStartGame,
    turnComplete: module.replayTurn(turnStartGame, currentTurnDarts, settings, state.matchContext).turnOver,
    winnerId: null,
    // If that turn was the winning one, it needs recording again once redone.
    recorded: state.winnerId === playerId ? false : state.recorded,
  };
}

export function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "SELECT_MODE":
      return { ...state, mode: action.mode, screen: "setup" };

    case "BACK_TO_SELECT":
      return { ...state, screen: "select", mode: null };

    case "SET_SETTINGS":
      return {
        ...state,
        settings: { ...state.settings, [action.kind]: { ...state.settings[action.kind], ...action.patch } },
      };

    case "SET_PLAYER_SETTINGS": {
      const byKind = (state.playerSettings ?? defaultPlayerSettings())[action.kind] ?? {};
      const current = byKind[action.playerId] ?? {};
      const baseSettings = state.settings[action.kind] as Record<string, unknown>;
      const next = { ...current };
      for (const [key, value] of Object.entries(action.patch)) {
        if (value === baseSettings[key]) delete next[key];
        else next[key] = value;
      }
      const nextByKind = { ...byKind };
      if (Object.keys(next).length === 0) delete nextByKind[action.playerId];
      else nextByKind[action.playerId] = next;
      return {
        ...state,
        playerSettings: {
          ...(state.playerSettings ?? defaultPlayerSettings()),
          [action.kind]: nextByKind,
        },
      };
    }

    case "ADD_PLAYER": {
      // The line-up is fixed once a match starts: `progress` is only built
      // at START_GAME, so a player added afterward would have no progress
      // entry and would show as broken in the game and in its history
      // record. This is reachable in normal use, not just hypothetically —
      // state is shared across every open tab, so a second tab still on
      // the setup screen can dispatch this after the match has already
      // started elsewhere.
      if (state.screen !== "setup") return state;
      if (state.players.length >= MAX_PLAYERS || state.players.includes(action.playerId)) return state;
      return { ...state, players: [...state.players, action.playerId] };
    }

    case "REMOVE_PLAYER":
      if (state.screen !== "setup") return state;
      if (!state.players.includes(action.playerId)) return state;
      return { ...state, players: state.players.filter((id) => id !== action.playerId) };

    case "REORDER_PLAYERS": {
      if (state.screen !== "setup") return state;
      // Only a permutation of the current line-up is allowed.
      const same =
        action.playerIds.length === state.players.length &&
        action.playerIds.every((id) => state.players.includes(id));
      return same ? { ...state, players: action.playerIds } : state;
    }

    case "SET_AUTOSCORING":
      return { ...state, autoscoring: action.value };

    case "START_GAME": {
      if (!state.mode || state.players.length === 0) return state;
      const module = getGameModule(state.mode);
      const settings = state.settings[state.mode];
      const matchContext = module.createMatchContext(settings);
      const progress: Record<string, PlayerProgress<unknown>> = {};
      for (const playerId of state.players) {
        const playerSettings = getPlayerSettings(state, module, playerId);
        progress[playerId] = { dartsThrown: 0, history: [], game: module.initGame(playerSettings, matchContext) };
      }
      const started: GameState = {
        ...state,
        screen: "game",
        progress,
        matchContext,
        activePlayerIndex: 0,
        winnerId: null,
        gameId: makeId(),
        startedAt: new Date().toISOString(),
        recorded: false,
      };
      return { ...started, ...startTurnSnapshot(started) };
    }

    case "EXIT_GAME":
      return { ...state, screen: "select", mode: null, winnerId: null };

    case "MARK_RECORDED":
      return state.recorded ? state : { ...state, recorded: true };

    case "BOARD_UNREACHABLE":
      return state.boardState === null ? state : { ...state, boardState: null };

    case "BOARD_STATE_UPDATE": {
      const board = action.state;
      const seen: GameState = { ...state, boardState: board };

      const scoringFromBoard = state.screen === "game" && state.mode && state.autoscoring && !state.winnerId;
      if (!scoringFromBoard) {
        // With autoscoring off the board is telemetry and nothing more: no
        // darts, no takeouts, no turn changes, no events. The snapshot is
        // still kept so the lobby can show the connection, and the dart
        // counters are kept in step so switching autoscoring on mid-match
        // doesn't retroactively score whatever is already in the board.
        return { ...seen, prevNumThrows: board.numThrows, awaitingTakeout: board.numThrows > 0 };
      }

      const takingOut = board.status === "Takeout" || board.status === "Takeout in progress";
      const cleared = board.numThrows === 0 && board.status === "Throw" && board.event !== "Offline";
      if (cleared && (state.awaitingTakeout || state.prevNumThrows > 0)) {
        const ready = { ...seen, prevNumThrows: 0, awaitingTakeout: false };
        // A button handoff already started the next player's empty turn.
        // Clearing those old darts must not advance a second time.
        if (ready.currentTurnDarts.length === 0) return ready;
        return advanceToNextPlayer(commitTurn(ready));
      }

      if (state.awaitingTakeout) {
        return { ...seen, prevNumThrows: Math.max(state.prevNumThrows, board.numThrows) };
      }

      let next = seen;
      if (board.numThrows > state.prevNumThrows) {
        const newDarts = board.throws.slice(state.prevNumThrows, board.numThrows);
        for (const dart of newDarts) next = addDarts(next, [dart.segment]);
      }

      return {
        ...next,
        prevNumThrows: board.numThrows,
        // Counts can drop while removal is still in progress. Keep the
        // visit visible until the board is both empty and ready to throw.
        awaitingTakeout: takingOut || board.numThrows < state.prevNumThrows,
      };
    }

    case "MANUAL_DART":
      return addDarts(state, [action.segment]);

    case "EDIT_DART":
      return editDart(state, action.index, action.segment);

    case "UNDO_DART":
      if (state.currentTurnDarts.length > 0) {
        const next = { ...state, currentTurnDarts: state.currentTurnDarts.slice(0, -1) };
        return { ...next, turnComplete: replayCurrentTurn(next)?.turnOver ?? false };
      }
      return undoLastTurn(state);

    case "NEXT_TURN":
      if (state.winnerId || state.currentTurnDarts.length === 0) return state;
      return advanceToNextPlayer(commitTurn(state));

    default:
      return state;
  }
}

const ACTION_TYPES = new Set<Action["type"]>([
  "SELECT_MODE",
  "BACK_TO_SELECT",
  "SET_SETTINGS",
  "SET_PLAYER_SETTINGS",
  "ADD_PLAYER",
  "REMOVE_PLAYER",
  "REORDER_PLAYERS",
  "SET_AUTOSCORING",
  "START_GAME",
  "EXIT_GAME",
  "MANUAL_DART",
  "EDIT_DART",
  "UNDO_DART",
  "NEXT_TURN",
]);

/**
 * Whether an action arriving over HTTP is one a client is allowed to send.
 * Board-sourced actions are excluded — only the server's poller produces those.
 */
export function isClientAction(value: unknown): value is Action {
  if (typeof value !== "object" || value === null) return false;
  const type = (value as { type?: unknown }).type;
  return typeof type === "string" && ACTION_TYPES.has(type as Action["type"]);
}
