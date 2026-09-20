import type { DartThrow, PlayerProgress, Segment } from "../types";
import { segmentValue } from "./segment";
import type { DisplayFields, GameModule, GameStats, SettingsField, StatLine, TurnResult } from "./types";

export type GotchaTargetScore = 301 | 401 | 501 | 601 | 701;
export type GotchaOutMode = "straight" | "double" | "master";
export type GotchaMaxRounds = 80 | 50 | 20 | 15;

export interface GotchaSettings {
  maxRounds: GotchaMaxRounds;
  targetScore: GotchaTargetScore;
  outMode: GotchaOutMode;
}

export interface GotchaGame {
  score: number;
  rounds: number;
}

const TARGET_SCORE_OPTIONS: GotchaTargetScore[] = [301, 401, 501, 601, 701];
const OUT_MODE_OPTIONS: GotchaOutMode[] = ["straight", "double", "master"];
const ROUND_OPTIONS: GotchaMaxRounds[] = [80, 50, 20, 15];

const defaultSettings: GotchaSettings = {
  maxRounds: 80,
  targetScore: 301,
  outMode: "straight",
};

const settingsFields: SettingsField<GotchaSettings>[] = [
  {
    key: "maxRounds",
    label: "Max rounds",
    options: ROUND_OPTIONS.map((value) => ({ value, label: String(value) })),
  },
];

const playerSettingsFields: SettingsField<GotchaSettings>[] = [
  {
    key: "targetScore",
    label: "Target score",
    options: TARGET_SCORE_OPTIONS.map((value) => ({ value, label: String(value) })),
  },
  {
    key: "outMode",
    label: "Out mode",
    options: OUT_MODE_OPTIONS.map((value) => ({ value, label: value[0].toUpperCase() + value.slice(1) })),
  },
];

function settingsSummaryChips(settings: GotchaSettings): string[] {
  return [`Max ${settings.maxRounds}`, `Target ${settings.targetScore}`, `Out ${settings.outMode}`];
}

function resolvePlayerSettings(
  baseSettings: GotchaSettings,
  playerSettings: Partial<GotchaSettings> | undefined,
): GotchaSettings {
  return { ...baseSettings, ...(playerSettings ?? {}) };
}

function scoreForSegment(seg: Segment, outMode: GotchaOutMode): number {
  if (seg.bed === "Outside") return 0;
  if (outMode === "straight") return segmentValue(seg);
  if (outMode === "double") return seg.bed === "Double" || seg.name === "50" ? segmentValue(seg) : 0;
  if (outMode === "master") return seg.bed === "Double" || seg.bed === "Triple" || seg.name === "50" ? segmentValue(seg) : 0;
  return 0;
}

function replayTurn(start: GotchaGame, darts: Segment[], settings: GotchaSettings): TurnResult<GotchaGame> {
  const history: DartThrow[] = [];
  let score = start.score;

  for (const seg of darts) {
    const value = scoreForSegment(seg, settings.outMode);
    history.push({ segment: seg, scoreValue: value, hit: value > 0 });
    score += value;
  }

  const target = settings.targetScore;
  const won = score >= target;
  const next: GotchaGame = {
    score,
    rounds: start.rounds + 1,
  };

  return {
    history,
    game: next,
    turnOver: darts.length >= 3,
    won,
    event: won ? "finish" : undefined,
  };
}

function turnTotal(darts: Segment[], _start: GotchaGame, settings: GotchaSettings): number {
  return darts.reduce((sum, seg) => sum + scoreForSegment(seg, settings.outMode), 0);
}

function display(progress: PlayerProgress<GotchaGame>, settings: GotchaSettings): DisplayFields {
  return {
    big: String(progress.game.score),
    small: `Round ${progress.game.rounds}/${settings.maxRounds}`,
    stat: progress.game.score >= settings.targetScore ? "Target reached" : `Need ${Math.max(0, settings.targetScore - progress.game.score)}`,
  };
}

function statsFromProgress(progress: PlayerProgress<GotchaGame>, settings: GotchaSettings): GameStats {
  const turnScores = progress.history.map((turn) => turn.reduce((sum, dart) => sum + dart.scoreValue, 0));
  return {
    darts: progress.dartsThrown,
    points: progress.game.score,
    bestTurn: turnScores.length > 0 ? Math.max(...turnScores) : 0,
    rounds: progress.game.rounds,
    targetReached: progress.game.score >= settings.targetScore ? 1 : 0,
  };
}

function aggregateStats(records: GameStats[]): StatLine[] {
  const darts = sum(records, "darts");
  const points = sum(records, "points");
  return [
    { label: "Score", value: String(points) },
    { label: "Best turn", value: String(records.reduce((best, r) => Math.max(best, r.bestTurn ?? 0), 0)) },
    { label: "Rounds", value: String(sum(records, "rounds")) },
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

function resolveAfterTurn(
  progress: Record<string, PlayerProgress<GotchaGame>>,
  playerId: string,
  _settings: GotchaSettings,
  _ctx: undefined,
): Record<string, PlayerProgress<GotchaGame>> {
  const currentScore = progress[playerId]?.game.score ?? 0;
  if (currentScore <= 0) return progress;

  const nextProgress = { ...progress };
  for (const [otherId, otherProgress] of Object.entries(progress)) {
    if (otherId === playerId) continue;
    if (otherProgress.game.score === currentScore) {
      nextProgress[otherId] = {
        ...otherProgress,
        game: { ...otherProgress.game, score: 0 },
      };
    }
  }

  return nextProgress;
}

function winnerFromProgress(progress: Record<string, PlayerProgress<GotchaGame>>, settings: GotchaSettings): string | null {
  const entries = Object.entries(progress);
  if (entries.length === 0) return null;

  const targetReached = entries.find(([, playerProgress]) => playerProgress.game.score >= settings.targetScore);
  if (targetReached) return targetReached[0];

  const roundsReached = entries.every(([, playerProgress]) => playerProgress.game.rounds >= settings.maxRounds);
  if (!roundsReached) return null;

  let winnerId: string | null = null;
  let winnerScore = Number.NEGATIVE_INFINITY;
  for (const [playerId, playerProgress] of entries) {
    if (playerProgress.game.score > winnerScore) {
      winnerId = playerId;
      winnerScore = playerProgress.game.score;
    }
  }
  return winnerId;
}

export const GotchaModule: GameModule<GotchaSettings, GotchaGame, undefined> = {
  kind: "gotcha",
  title: "GOTCHA",
  description: "Race to the target score by round; matching another player's score resets them to zero",
  defaultSettings,
  settingsFields,
  playerSettingsFields,
  settingsSummaryChips,
  resolvePlayerSettings,
  createMatchContext: () => undefined,
  initGame: (settings) => ({ score: 0, rounds: 0 }),
  replayTurn,
  display,
  turnTotal,
  statsFromProgress,
  aggregateStats,
  recordSummary,
  highlightNumber: () => null,
  resolveAfterTurn,
  winnerFromProgress,
};
