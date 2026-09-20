import type { DartThrow, PlayerProgress, Segment } from "../types";
import { isBullSegment } from "./segment";
import type { DisplayFields, GameModule, GameStats, SettingsField, StatLine, TurnResult } from "./types";

export type AtcMode = "Full" | "OuterSingle" | "Single" | "Double" | "Triple";
export type AtcOrder = "1-20-Bull" | "20-1-Bull" | "Random-Bull";

export interface AtcSettings {
  mode: AtcMode;
  order: AtcOrder;
  hitsRequired: 1 | 2 | 3;
  doubleTripleAsValue: boolean;
  mercyRule: 0 | 3 | 6 | 9 | 12;
}

export interface AtcGame {
  target: number; // 1-20, then 25 for bull
  hitsOnTarget: number;
  finished: boolean;
  order: number[];
}

export type AtcMatchContext = undefined;

const MODES: AtcMode[] = ["Full", "OuterSingle", "Single", "Double", "Triple"];
const MODE_LABELS: Record<AtcMode, string> = {
  Full: "Full",
  OuterSingle: "Outer Single",
  Single: "Single",
  Double: "Double",
  Triple: "Triple",
};
const ORDERS: AtcOrder[] = ["1-20-Bull", "20-1-Bull", "Random-Bull"];
const HIT_OPTIONS: Array<1 | 2 | 3> = [1, 2, 3];
const MERCY_RULE_OPTIONS: Array<0 | 3 | 6 | 9 | 12> = [0, 3, 6, 9, 12];

const defaultSettings: AtcSettings = {
  mode: "Full",
  order: "1-20-Bull",
  hitsRequired: 1,
  doubleTripleAsValue: false,
  mercyRule: 0,
};

const settingsFields: SettingsField<AtcSettings>[] = [
  {
    key: "mode",
    label: "Mode",
    options: MODES.map((v) => ({ value: v, label: MODE_LABELS[v] })),
  },
  {
    key: "order",
    label: "Order",
    options: ORDERS.map((v) => ({ value: v, label: v })),
  },
  {
    key: "hitsRequired",
    label: "Hits",
    options: HIT_OPTIONS.map((v) => ({ value: v, label: String(v) })),
  },
  {
    key: "doubleTripleAsValue",
    label: "Double / Triple",
    options: [
      { value: false, label: "1 hit" },
      { value: true, label: "2 / 3 hits" },
    ],
  },
  {
    key: "mercyRule",
    label: "Mercy rule",
    options: [
      { value: 0, label: "Off" },
      { value: 3, label: "3" },
      { value: 6, label: "6" },
      { value: 9, label: "9" },
      { value: 12, label: "12" },
    ],
  },
];

function settingsSummaryChips(settings: AtcSettings): string[] {
  const chips = [
    MODE_LABELS[settings.mode],
    settings.order,
    `${settings.hitsRequired} Hit${settings.hitsRequired > 1 ? "s" : ""}`,
    settings.doubleTripleAsValue ? "D/T = 2/3" : "D/T = 1",
  ];
  if (settings.mercyRule > 0) chips.push(`Mercy ${settings.mercyRule}`);
  return chips;
}

/** Target sequence for a game of Around The Clock. 25 stands for "Bull". */
function targetSequence(order: AtcOrder): number[] {
  const numbers = Array.from({ length: 20 }, (_, i) => i + 1);
  switch (order) {
    case "1-20-Bull":
      return [...numbers, 25];
    case "20-1-Bull":
      return [...numbers.reverse(), 25];
    case "Random-Bull": {
      const shuffled = [...numbers];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return [...shuffled, 25];
    }
  }
}

/** Whether a dart satisfies the current target under the given ATC mode. */
function dartHitsTarget(seg: Segment, target: number, mode: AtcMode): boolean {
  if (target === 25) return isBullSegment(seg);
  if (seg.bed === "Outside" || seg.number !== target) return false;

  switch (mode) {
    case "Full":
      return true;
    case "OuterSingle":
      return seg.bed === "SingleOuter";
    case "Single":
      return seg.bed === "Single" || seg.bed === "SingleInner" || seg.bed === "SingleOuter";
    case "Double":
      return seg.bed === "Double";
    case "Triple":
      return seg.bed === "Triple";
  }
}

function dartHitValue(seg: Segment, settings: AtcSettings): number {
  if (!settings.doubleTripleAsValue) return 1;
  if (seg.bed === "Double") return 2;
  if (seg.bed === "Triple") return 3;
  return 1;
}

function createMatchContext(_settings: AtcSettings): AtcMatchContext {
  return undefined;
}

function initGame(settings: AtcSettings): AtcGame {
  const order = targetSequence(settings.order);
  return { target: order[0], hitsOnTarget: 0, finished: false, order };
}

function replayTurn(
  start: AtcGame,
  darts: Segment[],
  settings: AtcSettings,
  ctx: AtcMatchContext,
): TurnResult<AtcGame> {
  const order = start.order;
  const startIndex = Math.max(order.indexOf(start.target), 0);
  let targetIndex = startIndex;
  let hits = start.hitsOnTarget;
  let misses = 0;
  let finished = start.finished;
  const history: DartThrow[] = [];

  for (const seg of darts) {
    if (finished) break;
    const currentTarget = order[targetIndex];
    const isHit = dartHitsTarget(seg, currentTarget, settings.mode);
    const value = isHit ? dartHitValue(seg, settings) : 0;
    history.push({ segment: seg, scoreValue: value, hit: isHit });

    if (!isHit) {
      misses++;
      if (settings.mercyRule > 0 && misses >= settings.mercyRule) {
        targetIndex++;
        misses = 0;
        hits = 0;
        if (targetIndex >= order.length) finished = true;
      }
      continue;
    }

    misses = 0;
    hits += value;
    if (hits >= settings.hitsRequired) {
      targetIndex++;
      hits = 0;
      if (targetIndex >= order.length) finished = true;
    }
  }

  return {
    history,
    game: {
      target: order[Math.min(targetIndex, order.length - 1)],
      hitsOnTarget: hits,
      finished,
      order,
    },
    turnOver: finished || darts.length >= 3,
    won: finished,
    event: finished ? "finish" : targetIndex > startIndex ? "advance" : undefined,
  };
}

/**
 * A player's "score" in ATC is simply the number they're on. In multi-hit
 * variants the hits banked against that number are shown alongside it
 * (target 4 with 2 hits reads "4 · 2"). In the 1-hit variant the counter
 * resets the moment a target is cleared, so it would always read 0 —
 * hence it's left off entirely.
 */
function display(progress: PlayerProgress<AtcGame>, settings: AtcSettings): DisplayFields {
  const totalHits = progress.history.flat().reduce((sum, dart) => sum + (dart.hit ? dart.scoreValue : 0), 0);
  const pct = progress.dartsThrown > 0 ? ((totalHits / progress.dartsThrown) * 100).toFixed(1) : "0.0";
  return {
    big: progress.game.target === 25 ? "BULL" : String(progress.game.target),
    small: settings.hitsRequired > 1 ? String(progress.game.hitsOnTarget) : undefined,
    stat: `Hit% ${pct}%`,
  };
}

/** Darts this turn that actually counted toward the player's target. */
function turnTotal(darts: Segment[], start: AtcGame, settings: AtcSettings, ctx: AtcMatchContext): number {
  return replayTurn(start, darts, settings, ctx).history.reduce((sum, dart) => sum + dart.scoreValue, 0);
}

function statsFromProgress(progress: PlayerProgress<AtcGame>, settings: AtcSettings): GameStats {
  const hits = progress.history.flat().reduce((sum, dart) => sum + (dart.hit ? dart.scoreValue : 0), 0);
  return {
    darts: progress.dartsThrown,
    hits,
    // Every hit counts toward the current target and it advances every
    // `hitsRequired` hits, so this is exact without needing the order.
    targetsCleared: Math.floor(hits / settings.hitsRequired),
    completed: progress.game.finished ? 1 : 0,
  };
}

function aggregateStats(records: GameStats[]): StatLine[] {
  const darts = sum(records, "darts");
  const hits = sum(records, "hits");
  return [
    { label: "Hit %", value: darts > 0 ? `${((hits / darts) * 100).toFixed(1)}%` : "—" },
    { label: "Boards finished", value: String(sum(records, "completed")) },
    { label: "Targets cleared", value: String(sum(records, "targetsCleared")) },
    { label: "Darts thrown", value: String(darts) },
  ];
}

function recordSummary(stats: GameStats): string {
  const darts = stats.darts ?? 0;
  const hits = stats.hits ?? 0;
  const targetsCleared = stats.targetsCleared ?? 0;
  const pct = darts > 0 ? ((hits / darts) * 100).toFixed(0) : "0";
  return `${targetsCleared} targets · ${hits}/${darts} hits (${pct}%)`;
}

function sum(records: GameStats[], key: string): number {
  return records.reduce((total, r) => total + (r[key] ?? 0), 0);
}

export const AtcModule: GameModule<AtcSettings, AtcGame, AtcMatchContext> = {
  kind: "atc",
  title: "AROUND THE CLOCK",
  description: "Hit numbers in order from 1 to 20 to win",
  defaultSettings,
  settingsFields,
  playerSettingsFields: settingsFields,
  settingsSummaryChips,
  resolvePlayerSettings: (baseSettings, playerSettings) => ({ ...baseSettings, ...(playerSettings ?? {}) }),
  createMatchContext,
  initGame,
  replayTurn,
  display,
  turnTotal,
  statsFromProgress,
  aggregateStats,
  recordSummary,
  highlightNumber: (game) => game.target,
};
