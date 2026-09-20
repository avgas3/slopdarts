import type { DartThrow, GameKind, PlayerProgress, Segment } from "../types";

/**
 * A notable thing a game decided happened this turn, for feedback such as
 * sounds. Games report it; nothing else needs to know their rules.
 */
export type TurnEvent = "bust" | "advance" | "finish";

/** Result of replaying some number of darts (a partial or full turn) against a player's game state. */
export interface TurnResult<G> {
  /** Set when something beyond an ordinary scoring dart happened. */
  event?: TurnEvent;
  /** Per-dart outcome for every dart passed in. */
  history: DartThrow[];
  /** The player's game-specific state as if this turn (with exactly these darts) had been committed. */
  game: G;
  /** True once the turn is definitively over — bust, finish, or the darts ran out. Further darts are blocked while the player reviews the visit before handoff. */
  turnOver: boolean;
  /** True if this turn finished the whole match for this player. */
  won: boolean;
}

export interface DisplayFields {
  layout?: "default" | "x01" | "cricket";
  big?: string;
  /** Optional secondary figure shown beside the main one. */
  small?: string;
  stat?: string;
  /** Optional custom columns for a game-specific score layout. */
  leftColumn?: string[];
  rightColumn?: string[];
  rows?: Array<{ label: string; value: string }>;
}

/** Game-specific figures kept in a game record. Plain numbers so records stay JSON. */
export type GameStats = Record<string, number>;

/** A labelled figure for display on the players screen. */
export interface StatLine {
  label: string;
  value: string;
}

/** One editable setting, rendered generically by the settings modal. */
export interface SettingsField<Settings> {
  key: keyof Settings & string;
  label: string;
  options: Array<{ value: Settings[keyof Settings & string]; label: string }>;
}

/**
 * Everything specific to one game's rules: its settings schema, how a turn
 * plays out, and how a player's progress should be displayed. Adding a new
 * game or changing an existing one should only ever touch its module.
 */
export interface GameModule<Settings, G, MatchContext = undefined> {
  kind: GameKind;
  title: string;
  description: string;
  defaultSettings: Settings;
  settingsFields: SettingsField<Settings>[];
  /** Optional, per-player overrides using the same setting schema as the match default. */
  playerSettingsFields?: SettingsField<Settings>[];
  settingsSummaryChips(settings: Settings): string[];
  /** Optional merge for a player's specific settings over the base match default. */
  resolvePlayerSettings?(baseSettings: Settings, playerSettings: Partial<Settings> | undefined): Settings;
  /** One-time, match-wide setup shared by every player, when needed. */
  createMatchContext(settings: Settings): MatchContext;
  /** A player's starting game-specific state for a fresh match. */
  initGame(settings: Settings, ctx: MatchContext): G;
  replayTurn(start: G, darts: Segment[], settings: Settings, ctx: MatchContext): TurnResult<G>;
  display(progress: PlayerProgress<G>, settings: Settings): DisplayFields;
  /** Live total shown in the turn bar while darts are still landing this turn. */
  turnTotal(darts: Segment[], start: G, settings: Settings, ctx: MatchContext): number;
  /** Figures worth keeping from one player's finished match, stored in the game record. */
  statsFromProgress(progress: PlayerProgress<G>, settings: Settings): GameStats;
  /** Rolls a player's past records for this game up into lifetime figures. */
  aggregateStats(records: GameStats[]): StatLine[];
  /** One-line result summary for a player's row in the history list. */
  recordSummary(stats: GameStats): string;
  /** Dartboard number to highlight for this player's current game state, if any. */
  highlightNumber(game: G): number | null;
  /** Optional post-turn adjustment for a module with cross-player effects, such as resets on equal scores. */
  resolveAfterTurn?(progress: Record<string, PlayerProgress<G>>, playerId: string, settings: Settings, ctx: MatchContext): Record<string, PlayerProgress<G>>;
  /** Optional game-specific end-of-match winner selector when the full contest is over. */
  winnerFromProgress?(progress: Record<string, PlayerProgress<G>>, settings: Settings, ctx: MatchContext): string | null;
}
