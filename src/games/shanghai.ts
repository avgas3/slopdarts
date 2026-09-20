import type { DartThrow, PlayerProgress, Segment } from "../types";
import { segmentValue } from "./segment";
import type { DisplayFields, GameModule, GameStats, SettingsField, StatLine, TurnResult } from "./types";

export type ShanghaiTargetRange = 7 | 20;

export interface ShanghaiSettings {
  targetMax: ShanghaiTargetRange;
}

export interface ShanghaiGame {
  score: number;
  target: number;
  finished: boolean;
}

const defaultSettings: ShanghaiSettings = {
  targetMax: 20,
};

const settingsFields: SettingsField<ShanghaiSettings>[] = [
  {
    key: "targetMax",
    label: "Round range",
    options: [
      { value: 7, label: "1-7" },
      { value: 20, label: "1-20" },
    ],
  },
];

function settingsSummaryChips(settings: ShanghaiSettings): string[] {
  return [settings.targetMax === 7 ? "1-7" : "1-20"];
}

function isTargetHit(seg: Segment, target: number): boolean {
  return seg.bed !== "Outside" && seg.number === target;
}

function isSingle(seg: Segment): boolean {
  return seg.bed === "Single" || seg.bed === "SingleInner" || seg.bed === "SingleOuter";
}

function isShanghai(darts: Segment[], target: number): boolean {
  let hasSingle = false;
  let hasDouble = false;
  let hasTriple = false;

  for (const seg of darts) {
    if (!isTargetHit(seg, target)) continue;
    if (isSingle(seg)) hasSingle = true;
    if (seg.bed === "Double") hasDouble = true;
    if (seg.bed === "Triple") hasTriple = true;
  }

  return hasSingle && hasDouble && hasTriple;
}

function replayTurn(start: ShanghaiGame, darts: Segment[], settings: ShanghaiSettings): TurnResult<ShanghaiGame> {
  const history: DartThrow[] = [];
  let score = start.score;

  for (const seg of darts) {
    if (!isTargetHit(seg, start.target)) {
      history.push({ segment: seg, scoreValue: 0, hit: false });
      continue;
    }

    const value = segmentValue(seg);
    score += value;
    history.push({ segment: seg, scoreValue: value, hit: true });
  }

  if (darts.length > 0 && isShanghai(darts, start.target)) {
    return {
      history,
      game: { score, target: start.target, finished: true },
      turnOver: true,
      won: true,
      event: "finish",
    };
  }

  if (darts.length < 3) {
    return {
      history,
      game: { score, target: start.target, finished: false },
      turnOver: false,
      won: false,
    };
  }

  const nextTarget = start.target + 1;
  const finished = nextTarget > settings.targetMax;

  return {
    history,
    game: {
      score,
      target: finished ? settings.targetMax + 1 : nextTarget,
      finished,
    },
    turnOver: true,
    won: false,
    event: finished ? "finish" : undefined,
  };
}

function display(progress: PlayerProgress<ShanghaiGame>, settings: ShanghaiSettings): DisplayFields {
  const targetText = progress.game.finished ? "FINISH" : String(progress.game.target);
  return {
    big: targetText,
    small: `Score ${progress.game.score}`,
    stat: progress.game.finished ? `Final ${settings.targetMax}` : `Round ${Math.min(progress.game.target, settings.targetMax)}`,
  };
}

function turnTotal(darts: Segment[], start: ShanghaiGame): number {
  return darts.reduce((sum, seg) => (isTargetHit(seg, start.target) ? sum + segmentValue(seg) : sum), 0);
}

function statsFromProgress(progress: PlayerProgress<ShanghaiGame>, _settings: ShanghaiSettings): GameStats {
  const turnScores = progress.history.map((turn) => turn.reduce((sum, dart) => sum + dart.scoreValue, 0));
  return {
    darts: progress.dartsThrown,
    points: progress.game.score,
    bestTurn: turnScores.length > 0 ? Math.max(...turnScores) : 0,
    completed: progress.game.finished ? 1 : 0,
  };
}

function aggregateStats(records: GameStats[]): StatLine[] {
  const darts = sum(records, "darts");
  const points = sum(records, "points");
  return [
    { label: "Score", value: String(points) },
    { label: "Best turn", value: String(records.reduce((best, r) => Math.max(best, r.bestTurn ?? 0), 0)) },
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
  progress: Record<string, PlayerProgress<ShanghaiGame>>,
  _settings: ShanghaiSettings,
): string | null {
  const entries = Object.entries(progress);
  if (entries.length === 0) return null;
  if (!entries.every(([, playerProgress]) => playerProgress.game.finished)) return null;

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

export const ShanghaiModule: GameModule<ShanghaiSettings, ShanghaiGame> = {
  kind: "shanghai",
  title: "SHANGHAI",
  description: "Hit the round number for points; land single, double, and triple in one round to win instantly",
  defaultSettings,
  settingsFields,
  settingsSummaryChips,
  createMatchContext: () => undefined,
  initGame: () => ({ score: 0, target: 1, finished: false }),
  replayTurn,
  display,
  turnTotal,
  statsFromProgress,
  aggregateStats,
  recordSummary,
  highlightNumber: (game) => (game.finished ? null : game.target),
  winnerFromProgress,
};
