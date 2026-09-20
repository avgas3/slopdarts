// Shapes returned by GET /api/state — see API_STATE.md at the repo root.

export type Bed =
  | "Single"
  | "SingleInner"
  | "SingleOuter"
  | "Double"
  | "Triple"
  | "Outside";

export interface Segment {
  name: string;
  number: number | null;
  bed: Bed;
  multiplier: number;
}

export interface Coords {
  x: number;
  y: number;
}

export interface BoardThrow {
  segment: Segment;
  coords: Coords;
}

export type BoardStatus =
  | "Offline"
  | "Starting"
  | "Running"
  | "Stopping"
  | "Stopped"
  | "Throw"
  | "Takeout"
  | "Takeout in progress"
  | "Calibrating"
  | "Setup"
  | "Error";

export interface BoardState {
  connected: boolean;
  running: boolean;
  status: BoardStatus;
  event: string;
  numThrows: number;
  throws: BoardThrow[];
}

// --- App-level game types -------------------------------------------------

/** Registered games. Adding a game means adding its kind here and to the module registry. */
export type GameKind = "x01" | "atc" | "cricket" | "shanghai" | "gotcha" | "bobs27";

/**
 * A player in the shared roster. Persisted independently of any match, so
 * stats and history can be attributed across games.
 */
export interface RosterPlayer {
  id: string;
  name: string;
  /** Primary hex colour that themes the app while it's this player's turn. */
  color: string;
  /** Second gradient stop; from the chosen preset, or derived from a custom colour. */
  accent: string;
  /** Sound effect package to play for this player's events. */
  soundTheme: string;
  createdAt: string;
}

/** A player's line in a recorded game. Names/colours are snapshotted so history survives edits and deletions. */
export interface GameRecordPlayer {
  playerId: string;
  name: string;
  color: string;
  accent: string;
  /** Game-specific figures produced by that game's module. */
  stats: Record<string, number>;
}

export interface GameRecord {
  id: string;
  kind: GameKind;
  settings: unknown;
  startedAt: string;
  finishedAt: string;
  /** False when a match was abandoned before anyone won. */
  completed: boolean;
  winnerId: string | null;
  players: GameRecordPlayer[];
}

export interface DartThrow {
  segment: Segment;
  scoreValue: number; // whatever the game counts for this dart — points, hits, etc.
  hit: boolean; // whether the game counted this dart as a success
}

/**
 * Bookkeeping every game shares, wrapping the game-specific state `G` that
 * only that game's module understands.
 */
export interface PlayerProgress<G> {
  dartsThrown: number;
  history: DartThrow[][]; // one array per completed turn
  game: G;
}
