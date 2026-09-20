import type { DartThrow, PlayerProgress, Segment } from "../types";
import { isDoubleSegment, segmentValue } from "./segment";
import type { DisplayFields, GameModule, GameStats, SettingsField, StatLine, TurnResult } from "./types";

export type X01Start = 121 | 170 | 301 | 501 | 701 | 901;
export type X01Out = "Straight" | "Double";

export interface X01Settings {
  startScore: X01Start;
  out: X01Out;
}

export interface X01Game {
  remaining: number;
}

const STARTS: X01Start[] = [121, 170, 301, 501, 701, 901];
const OUT_OPTIONS: X01Out[] = ["Straight", "Double"];

const defaultSettings: X01Settings = {
  startScore: 501,
  out: "Double",
};

const settingsFields: SettingsField<X01Settings>[] = [
  {
    key: "startScore",
    label: "Starting Score",
    options: STARTS.map((v) => ({ value: v, label: String(v) })),
  },
  {
    key: "out",
    label: "Out",
    options: OUT_OPTIONS.map((v) => ({ value: v, label: v })),
  },
];

function settingsSummaryChips(settings: X01Settings): string[] {
  return [String(settings.startScore), `${settings.out} Out`];
}

function initGame(settings: X01Settings): X01Game {
  return { remaining: settings.startScore };
}

function isValidCheckoutDart(seg: Segment, outRule: X01Out): boolean {
  if (outRule === "Straight") return true;
  return isDoubleSegment(seg);
}

/**
 * Standard X01 bust rules: overshooting zero, or landing on exactly zero
 * without a qualifying checkout dart, voids the whole turn — the player's
 * remaining score reverts to its start-of-turn value.
 */
function replayTurn(start: X01Game, darts: Segment[], settings: X01Settings): TurnResult<X01Game> {
  let running = start.remaining;
  const history: DartThrow[] = [];

  for (const seg of darts) {
    const value = segmentValue(seg);
    const next = running - value;

    if (next < 0 || (next === 0 && !isValidCheckoutDart(seg, settings.out))) {
      history.push({ segment: seg, scoreValue: 0, hit: false });
      return { history, game: start, turnOver: true, won: false, event: "bust" };
    }

    history.push({ segment: seg, scoreValue: value, hit: true });
    running = next;

    if (running === 0) {
      return { history, game: { remaining: 0 }, turnOver: true, won: true, event: "finish" };
    }
  }

  return {
    history,
    game: { remaining: running },
    turnOver: darts.length >= 3,
    won: false,
  };
}

function display(progress: PlayerProgress<X01Game>, settings: X01Settings): DisplayFields {
  const totalScored = progress.history.flat().reduce((sum, d) => sum + d.scoreValue, 0);
  const avg = progress.dartsThrown > 0 ? ((totalScored / progress.dartsThrown) * 3).toFixed(1) : "0.0";

  const leftColumn = progress.history.map((turn) => String(turn.reduce((sum, dart) => sum + dart.scoreValue, 0)));
  let running = settings.startScore;
  const rightColumn = progress.history.map((turn) => {
    const turnScore = turn.reduce((sum, dart) => sum + dart.scoreValue, 0);
    running -= turnScore;
    return String(running);
  });

  return {
    layout: "x01",
    big: String(progress.game.remaining),
    stat: `Avg ${avg}`,
    leftColumn: leftColumn.length > 0 ? leftColumn : [String(settings.startScore)],
    rightColumn: rightColumn.length > 0 ? rightColumn : [String(settings.startScore)],
  };
}

function turnTotal(darts: Segment[]): number {
  return darts.reduce((sum, seg) => sum + segmentValue(seg), 0);
}

function statsFromProgress(progress: PlayerProgress<X01Game>): GameStats {
  const turnScores = progress.history.map((turn) => turn.reduce((sum, d) => sum + d.scoreValue, 0));
  return {
    darts: progress.dartsThrown,
    points: turnScores.reduce((sum, score) => sum + score, 0),
    bestTurn: turnScores.length > 0 ? Math.max(...turnScores) : 0,
    // A checkout leaves exactly zero; anything else means they didn't finish.
    checkouts: progress.game.remaining === 0 ? 1 : 0,
  };
}

function aggregateStats(records: GameStats[]): StatLine[] {
  const darts = sum(records, "darts");
  const points = sum(records, "points");
  return [
    { label: "3-dart avg", value: darts > 0 ? ((points / darts) * 3).toFixed(1) : "—" },
    { label: "Best turn", value: String(records.reduce((best, r) => Math.max(best, r.bestTurn ?? 0), 0)) },
    { label: "Checkouts", value: String(sum(records, "checkouts")) },
    { label: "Darts thrown", value: String(darts) },
  ];
}

function recordSummary(stats: GameStats): string {
  const darts = stats.darts ?? 0;
  const points = stats.points ?? 0;
  const avg = darts > 0 ? ((points / darts) * 3).toFixed(1) : "—";
  return `${points} pts in ${darts} darts · ${avg} avg`;
}

function sum(records: GameStats[], key: string): number {
  return records.reduce((total, r) => total + (r[key] ?? 0), 0);
}

export const X01Module: GameModule<X01Settings, X01Game> = {
  kind: "x01",
  title: "X01",
  description: "Race from a set score down to exactly zero",
  defaultSettings,
  settingsFields,
  settingsSummaryChips,
  createMatchContext: () => undefined,
  initGame,
  replayTurn,
  display,
  turnTotal,
  statsFromProgress,
  aggregateStats,
  recordSummary,
  highlightNumber: () => null,
};
