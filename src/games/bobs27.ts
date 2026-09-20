import type { DartThrow, PlayerProgress, Segment } from "../types";
import type { DisplayFields, GameModule, GameStats, SettingsField, StatLine, TurnResult } from "./types";

export type Bob27Mode = "normal" | "allow-negative";
export type Bob27Order = "1-20-bull" | "1-20";

export interface Bob27Settings {
  mode: Bob27Mode;
  order: Bob27Order;
}

export interface Bob27Game {
  score: number;
  target: number;
  round: number;
  eliminated: boolean;
  complete: boolean;
}

const ROUND_ORDER: Bob27Order[] = ["1-20-bull", "1-20"];

const defaultSettings: Bob27Settings = {
  mode: "normal",
  order: "1-20-bull",
};

const settingsFields: SettingsField<Bob27Settings>[] = [];

const playerSettingsFields: SettingsField<Bob27Settings>[] = [
  {
    key: "mode",
    label: "Mode",
    options: [
      { value: "normal", label: "Normal" },
      { value: "allow-negative", label: "Allow negative score" },
    ],
  },
  {
    key: "order",
    label: "Order",
    options: [
      { value: "1-20-bull", label: "1-20-Bull" },
      { value: "1-20", label: "1-20" },
    ],
  },
];

function settingsSummaryChips(settings: Bob27Settings): string[] {
  return [settings.mode === "normal" ? "Normal" : "Allow negative", settings.order];
}

function resolvePlayerSettings(
  baseSettings: Bob27Settings,
  playerSettings: Partial<Bob27Settings> | undefined,
): Bob27Settings {
  return { ...baseSettings, ...(playerSettings ?? {}) };
}

function targetSequence(order: Bob27Order): number[] {
  const numbers = Array.from({ length: 20 }, (_, i) => i + 1);
  return order === "1-20-bull" ? [...numbers, 25] : numbers;
}

function roundValue(target: number): number {
  return target * 2;
}

function replayTurn(start: Bob27Game, darts: Segment[], settings: Bob27Settings): TurnResult<Bob27Game> {
  let score = start.score;
  let target = start.target;
  let round = start.round;
  let eliminated = start.eliminated;
  let complete = start.complete;
  const history: DartThrow[] = [];

  for (const seg of darts) {
    if (eliminated || complete) break;

    const isHit = seg.bed === "Double" && seg.number === target;
    const delta = isHit ? roundValue(target) : -roundValue(target);
    score += delta;
    history.push({ segment: seg, scoreValue: isHit ? roundValue(target) : -roundValue(target), hit: isHit });

    if (settings.mode === "normal" && score <= 0) {
      eliminated = true;
      return {
        history,
        game: { score, target, round, eliminated, complete: true },
        turnOver: true,
        won: false,
        event: "bust",
      };
    }
  }

  if (eliminated) {
    return {
      history,
      game: { score, target, round, eliminated, complete: true },
      turnOver: true,
      won: false,
    };
  }

  // Advance to the next target for the next round after a full three-dart turn.
  if (darts.length >= 3) {
    const nextRound = round + 1;
    const sequence = targetSequence(settings.order);
    const nextTarget = sequence[Math.min(nextRound, sequence.length - 1)] ?? sequence[sequence.length - 1];
    complete = nextRound >= sequence.length;
    return {
      history,
      game: {
        score,
        target: nextTarget,
        round: nextRound,
        eliminated: false,
        complete,
      },
      turnOver: true,
      won: false,
    };
  }

  return {
    history,
    game: { score, target, round, eliminated: false, complete: false },
    turnOver: false,
    won: false,
  };
}

function turnTotal(darts: Segment[], start: Bob27Game, settings: Bob27Settings): number {
  const value = roundValue(start.target);
  return darts.reduce((sum, seg) => {
    const isHit = seg.bed === "Double" && seg.number === start.target;
    return sum + (isHit ? value : -value);
  }, 0);
}

function display(progress: PlayerProgress<Bob27Game>, settings: Bob27Settings): DisplayFields {
  const targetLabel = progress.game.target === 25 ? "BULL" : String(progress.game.target);
  return {
    big: String(progress.game.score),
    small: progress.game.complete ? "Finished" : `Round ${progress.game.round}`,
    stat: progress.game.eliminated ? "Eliminated" : `Target ${targetLabel}`,
  };
}

function statsFromProgress(progress: PlayerProgress<Bob27Game>, _settings: Bob27Settings): GameStats {
  const turnScores = progress.history.map((turn) => turn.reduce((sum, dart) => sum + dart.scoreValue, 0));
  return {
    darts: progress.dartsThrown,
    points: progress.game.score,
    bestTurn: turnScores.length > 0 ? Math.max(...turnScores) : 0,
    eliminated: progress.game.eliminated ? 1 : 0,
    complete: progress.game.complete ? 1 : 0,
  };
}

function aggregateStats(records: GameStats[]): StatLine[] {
  const darts = sum(records, "darts");
  const points = sum(records, "points");
  return [
    { label: "Score", value: String(points) },
    { label: "Best turn", value: String(records.reduce((best, r) => Math.max(best, r.bestTurn ?? 0), 0)) },
    { label: "Eliminated", value: String(sum(records, "eliminated")) },
    { label: "Darts thrown", value: String(darts) },
  ];
}

function recordSummary(stats: GameStats): string {
  const points = stats.points ?? 0;
  const darts = stats.darts ?? 0;
  return `${points} pts in ${darts} darts`;
}

function sum(records: GameStats[], key: string): number {
  return records.reduce((total, r) => total + (r[key] ?? 0), 0);
}

function winnerFromProgress(
  progress: Record<string, PlayerProgress<Bob27Game>>,
  _settings: Bob27Settings,
): string | null {
  const entries = Object.entries(progress);
  if (entries.length === 0) return null;

  const remaining = entries.filter(([, playerProgress]) => !playerProgress.game.eliminated);
  const eligible = remaining.length > 0 ? remaining : entries;
  const finished = eligible.filter(([, playerProgress]) => playerProgress.game.complete);
  if (finished.length !== eligible.length) return null;

  let winnerId: string | null = null;
  let winnerScore = Number.NEGATIVE_INFINITY;

  for (const [playerId, playerProgress] of finished) {
    if (playerProgress.game.score > winnerScore) {
      winnerId = playerId;
      winnerScore = playerProgress.game.score;
    }
  }

  return winnerId;
}

export const Bobs27Module: GameModule<Bob27Settings, Bob27Game, undefined> = {
  kind: "bobs27",
  title: "BOB'S 27",
  description: "Start at 27; chase each double, miss to lose its value, and survive the full order to win",
  defaultSettings,
  settingsFields,
  playerSettingsFields,
  settingsSummaryChips,
  resolvePlayerSettings,
  createMatchContext: () => undefined,
  initGame: (settings) => ({
    score: 27,
    target: targetSequence(settings.order)[0],
    round: 0,
    eliminated: false,
    complete: false,
  }),
  replayTurn,
  display,
  turnTotal,
  statsFromProgress,
  aggregateStats,
  recordSummary,
  highlightNumber: (game) => (game.eliminated || game.complete ? null : game.target),
  winnerFromProgress,
};
