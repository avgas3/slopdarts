import type { DartThrow, PlayerProgress, Segment } from "../types";
import { segmentValue } from "./segment";
import type { DisplayFields, GameModule, GameStats, SettingsField, StatLine, TurnResult } from "./types";

export interface CricketSettings {}

export interface CricketGame {
  score: number;
  marks: Record<number, number>;
  closed: Record<number, boolean>;
}

const TARGETS = [20, 19, 18, 17, 16, 15, 25] as const;
const TARGET_SET = new Set<number>(TARGETS);

const defaultSettings: CricketSettings = {};
const settingsFields: SettingsField<CricketSettings>[] = [];

function settingsSummaryChips(_settings: CricketSettings): string[] {
  return ["Standard"];
}

function initMarks(): Record<number, number> {
  return Object.fromEntries(TARGETS.map((target) => [target, 0])) as Record<number, number>;
}

function initClosed(): Record<number, boolean> {
  return Object.fromEntries(TARGETS.map((target) => [target, false])) as Record<number, boolean>;
}

function allClosed(closed: Record<number, boolean>): boolean {
  return TARGETS.every((target) => closed[target]);
}

function numberForSegment(seg: Segment): number | null {
  if (seg.bed === "Outside") return null;
  if (seg.name === "25" || seg.name === "50") return 25;
  if (seg.number !== null && TARGET_SET.has(seg.number)) return seg.number;
  return null;
}

function replayTurn(start: CricketGame, darts: Segment[], _settings: CricketSettings): TurnResult<CricketGame> {
  const marks = { ...start.marks };
  const closed = { ...start.closed };
  let score = start.score;
  const history: DartThrow[] = [];

  for (const seg of darts) {
    const target = numberForSegment(seg);

    if (target === null) {
      history.push({ segment: seg, scoreValue: 0, hit: false });
      continue;
    }

    const currentMarks = marks[target] ?? 0;
    if (!closed[target]) {
      // In cricket, each open target gains 1/2/3 marks from single/double/triple hits.
      const nextMarks = Math.min(3, currentMarks + seg.multiplier);
      marks[target] = nextMarks;
      if (nextMarks >= 3) closed[target] = true;
      history.push({ segment: seg, scoreValue: 0, hit: true });
      continue;
    }

    const added = segmentValue(seg);
    score += added;
    history.push({ segment: seg, scoreValue: added, hit: true });
  }

  const won = allClosed(closed);

  return {
    history,
    game: { score, marks, closed },
    turnOver: won || darts.length >= 3,
    won,
    event: won ? "finish" : undefined,
  };
}

function formatMarks(marks: number): string {
  if (marks <= 0) return "—";
  if (marks === 1) return "/";
  if (marks === 2) return "X";
  return "⨂";
}

function display(progress: PlayerProgress<CricketGame>, _settings: CricketSettings): DisplayFields {
  const closedCount = TARGETS.filter((target) => progress.game.closed[target]).length;
  return {
    layout: "cricket",
    big: String(progress.game.score),
    small: `${closedCount}/${TARGETS.length}`,
    stat: closedCount === TARGETS.length ? "Closed" : `${TARGETS.length - closedCount} left`,
    rows: TARGETS.map((target) => ({
      label: target === 25 ? "BULL" : String(target),
      value: formatMarks(progress.game.marks[target] ?? 0),
    })),
  };
}

function turnTotal(darts: Segment[], start: CricketGame, _settings: CricketSettings): number {
  return replayTurn(start, darts, _settings).history.reduce((total, dart) => total + dart.scoreValue, 0);
}

function statsFromProgress(progress: PlayerProgress<CricketGame>, _settings: CricketSettings): GameStats {
  const turnScores = progress.history.map((turn) => turn.reduce((sum, dart) => sum + dart.scoreValue, 0));
  const closedCount = TARGETS.filter((target) => progress.game.closed[target]).length;
  return {
    darts: progress.dartsThrown,
    points: progress.game.score,
    bestTurn: turnScores.length > 0 ? Math.max(...turnScores) : 0,
    closed: closedCount,
    completed: allClosed(progress.game.closed) ? 1 : 0,
  };
}

function aggregateStats(records: GameStats[]): StatLine[] {
  const darts = sum(records, "darts");
  const points = sum(records, "points");
  return [
    { label: "Score", value: String(points) },
    { label: "Best turn", value: String(records.reduce((best, r) => Math.max(best, r.bestTurn ?? 0), 0)) },
    { label: "Closed", value: String(sum(records, "closed")) },
    { label: "Darts thrown", value: String(darts) },
  ];
}

function recordSummary(stats: GameStats): string {
  const points = stats.points ?? 0;
  const closed = stats.closed ?? 0;
  return `${points} pts · ${closed}/${TARGETS.length} closed`;
}

function sum(records: GameStats[], key: string): number {
  return records.reduce((total, r) => total + (r[key] ?? 0), 0);
}

export const CricketModule: GameModule<CricketSettings, CricketGame> = {
  kind: "cricket",
  title: "CRICKET",
  description: "Close 15 to 20 and bull, then score on the closed numbers",
  defaultSettings,
  settingsFields,
  settingsSummaryChips,
  createMatchContext: () => undefined,
  initGame: () => ({
    score: 0,
    marks: initMarks(),
    closed: initClosed(),
  }),
  replayTurn,
  display,
  turnTotal,
  statsFromProgress,
  aggregateStats,
  recordSummary,
  highlightNumber: () => null,
};
