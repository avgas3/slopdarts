import express, { type Response } from "express";
import fs from "node:fs";
import path from "node:path";
import {
  initialState,
  isClientAction,
  isCompatibleGameState,
  reducer,
  type Action,
  type GameState,
} from "../src/game/reducer";
import { getGameModule } from "../src/games/registry";
import { DEFAULT_THEME, lighten, PLAYER_THEMES } from "../src/theme";
import { DEFAULT_SOUND_THEME, resolveSoundTheme, SOUND_THEMES } from "../src/soundThemes";
import type { BoardState, GameRecord, GameRecordPlayer, RosterPlayer } from "../src/types";
import { loadEnv } from "./env";
import { JsonStore } from "./jsonStore";

loadEnv();

const PORT = Number(process.env.PORT ?? 3001);
const DATA_DIR = process.env.DATA_DIR ?? path.resolve("data");
const BOARD_CONFIG_PATH = path.join(DATA_DIR, "board.json");
const boardStore = new JsonStore<{ url: string }>(
  BOARD_CONFIG_PATH,
  () => ({ url: (process.env.BOARD_URL ?? "").trim().replace(/\/$/, "") }),
);
let BOARD_URL = boardStore.get().url.replace(/\/$/, "");
const BOARD_POLL_MS = 350;
const STATIC_DIR = path.resolve("dist");

function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

const HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * Resolves the colour fields of a create/update request: a preset colour
 * brings its own accent, a custom colour gets one derived from it.
 */
function resolveTheme(body: any, fallback: { color: string; accent: string }) {
  const color = typeof body?.color === "string" && HEX.test(body.color) ? body.color : null;
  if (!color) return fallback;
  const preset = PLAYER_THEMES.find((theme) => theme.color.toLowerCase() === color.toLowerCase());
  const accent =
    typeof body?.accent === "string" && HEX.test(body.accent) ? body.accent : preset?.accent ?? lighten(color, 0.25);
  return { color, accent };
}

// --- Persistent stores ----------------------------------------------------

// A saved board snapshot is stale by definition; the poller refreshes it.
// A saved state from an incompatible schema is discarded outright — see
// isCompatibleGameState's doc comment for why patching it is worse.
const gameStore = new JsonStore<GameState>(path.join(DATA_DIR, "state.json"), initialState, (loaded) => {
  if (!isCompatibleGameState(loaded)) {
    console.warn("Saved game state is from an incompatible version; starting a fresh one.");
    return initialState();
  }
  return { ...loaded, boardState: null };
});
// Tolerate a hand-edited players.json that omits the derived accent.
const rosterStore = new JsonStore<RosterPlayer[]>(
  path.join(DATA_DIR, "players.json"),
  () => [],
  (loaded) =>
    loaded.map((player) => ({
      ...player,
      color: player.color || DEFAULT_THEME.color,
      accent: player.accent || lighten(player.color || DEFAULT_THEME.color, 0.25),
      soundTheme: resolveSoundTheme(player.soundTheme, DEFAULT_SOUND_THEME),
    })),
);
const historyStore = new JsonStore<GameRecord[]>(path.join(DATA_DIR, "history.json"), () => []);

function game(): GameState {
  return gameStore.get();
}

// --- Server-sent events ---------------------------------------------------

const clients = new Set<Response>();

function snapshot() {
  return { game: game(), roster: rosterStore.get(), boardUrl: BOARD_URL };
}

function broadcast() {
  const payload = `data: ${JSON.stringify(snapshot())}\n\n`;
  for (const client of clients) client.write(payload);
}

/** Applies an action and, if anything changed, records/notifies/persists. */
function apply(action: Action) {
  const before = game();
  const after = reducer(before, action);
  if (after === before) return;
  gameStore.set(after);

  maybeRecordGame(before, after, action);
  maybeReadyBoard(before, after, action);
  broadcast();
}

/**
 * Starts and clears the board when a match begins with autoscoring on, so
 * play doesn't open on a board that's stopped or still holding stale darts
 * from before. Best-effort: a failure here just leaves the board as it was,
 * same as if it had never been asked.
 */
function maybeReadyBoard(before: GameState, after: GameState, action: Action) {
  if (!BOARD_URL || action.type !== "START_GAME" || before.screen === "game" || after.screen !== "game" || !after.autoscoring) {
    return;
  }
  callBoard("PUT", "/api/start")
    .then(() => callBoard("POST", "/api/reset"))
    .catch((err) => console.warn("Couldn't ready the board for the new match:", err.message));
}

function normalizeBoardUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("Board URL is required");
  const cleaned = trimmed.replace(/\/$/, "");
  try {
    const parsed = new URL(cleaned);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("Board URL must start with http:// or https://");
    return cleaned;
  } catch {
    throw new Error("Board URL must be a valid http(s) URL");
  }
}

function defaultSoundThemeForPlayer(index: number): string {
  return SOUND_THEMES[index % SOUND_THEMES.length]?.id ?? DEFAULT_SOUND_THEME;
}

function setBoardUrl(value: string) {
  BOARD_URL = normalizeBoardUrl(value);
  boardStore.set({ url: BOARD_URL });
  lastBoardSnapshot = "";
  apply({ type: "BOARD_UNREACHABLE" });
  broadcast();
}

async function callBoard(method: string, path: string): Promise<void> {
  const res = await fetch(`${BOARD_URL}${path}`, { method });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}`);
}

// --- Game history ---------------------------------------------------------

/**
 * Writes a history record once per match: when someone wins, or when a
 * match with darts thrown is abandoned. `recorded` lives in the game state
 * so a server restart can't double-record.
 */
function maybeRecordGame(before: GameState, after: GameState, action: Action) {
  const finished = after.winnerId !== null && !after.recorded;
  const abandoned =
    action.type === "EXIT_GAME" &&
    before.screen === "game" &&
    !before.recorded &&
    dartsThrown(before) > 0;

  if (!finished && !abandoned) return;

  const source = finished ? after : before;
  historyStore.set([buildRecord(source, finished), ...historyStore.get()]);
  gameStore.set(reducer(after, { type: "MARK_RECORDED" }));
}

function dartsThrown(state: GameState): number {
  return Object.values(state.progress).reduce((sum, p) => sum + p.dartsThrown, 0);
}

function buildRecord(state: GameState, completed: boolean): GameRecord {
  const kind = state.mode!;
  const module = getGameModule(kind);
  const settings = state.settings[kind];
  const roster = rosterStore.get();

  const players: GameRecordPlayer[] = state.players.map((playerId) => {
    const entry = roster.find((p) => p.id === playerId);
    const progress = state.progress[playerId];
    return {
      playerId,
      name: entry?.name ?? "Unknown",
      color: entry?.color ?? DEFAULT_THEME.color,
      accent: entry?.accent ?? DEFAULT_THEME.accent,
      stats: progress ? module.statsFromProgress(progress, settings) : {},
    };
  });

  return {
    id: state.gameId ?? makeId(),
    kind,
    settings,
    startedAt: state.startedAt ?? new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    completed,
    winnerId: state.winnerId,
    players,
  };
}

// --- Board polling --------------------------------------------------------
// Only the server talks to the board, so a throw is scored exactly once no
// matter how many browsers are watching.

let lastBoardSnapshot = "";

async function pollBoard() {
  const boardUrl = BOARD_URL;
  if (!boardUrl) return;
  try {
    const res = await fetch(`${boardUrl}/api/state`, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`GET /api/state -> ${res.status}`);
    const board = (await res.json()) as BoardState;
    // A URL edit can finish while a poll of the previous board is in flight.
    if (boardUrl !== BOARD_URL) return;

    const serialized = JSON.stringify(board);
    if (serialized !== lastBoardSnapshot) {
      lastBoardSnapshot = serialized;
      apply({ type: "BOARD_STATE_UPDATE", state: board });
    }
  } catch {
    if (boardUrl !== BOARD_URL) return;
    lastBoardSnapshot = "";
    apply({ type: "BOARD_UNREACHABLE" });
  }
}

setInterval(pollBoard, BOARD_POLL_MS);
pollBoard();

// --- HTTP -----------------------------------------------------------------

const app = express();
app.use(express.json());

app.get("/api/game", (_req, res) => res.json(snapshot()));

app.get("/api/game/stream", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write(`data: ${JSON.stringify(snapshot())}\n\n`);
  clients.add(res);
  req.on("close", () => clients.delete(res));
});

app.post("/api/game/action", (req, res) => {
  if (!isClientAction(req.body)) {
    res.status(400).json({ error: "Unknown action" });
    return;
  }
  apply(req.body);
  res.json(snapshot());
});

// --- Manual board control ---------------------------------------------------
// Proxied through the server (rather than hit directly from the browser) so
// the client only ever needs to know about this app's own API.

const BOARD_COMMANDS: Record<string, { method: string; path: string }> = {
  start: { method: "PUT", path: "/api/start" },
  stop: { method: "PUT", path: "/api/stop" },
  reset: { method: "POST", path: "/api/reset" },
  calibrate: { method: "POST", path: "/api/config/calibration/auto?distortion=true" },
};

app.get("/api/board/url", (_req, res) => {
  res.json({ url: BOARD_URL });
});

app.put("/api/board/url", (req, res) => {
  try {
    const url = typeof req.body?.url === "string" ? req.body.url : "";
    const next = normalizeBoardUrl(url);
    setBoardUrl(next);
    res.json({ ok: true, url: BOARD_URL });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Board URL is invalid" });
  }
});

app.post("/api/board/:command", async (req, res) => {
  const command = BOARD_COMMANDS[req.params.command];
  if (!command) {
    res.status(404).json({ error: "Unknown board command" });
    return;
  }
  if (!BOARD_URL) {
    res.status(400).json({ error: "Board URL is missing" });
    return;
  }
  try {
    await callBoard(command.method, command.path);
    res.json({ ok: true });
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : "Board request failed" });
  }
});

// --- Roster ---------------------------------------------------------------

app.get("/api/players", (_req, res) => res.json(rosterStore.get()));

app.post("/api/players", (req, res) => {
  const name = String(req.body?.name ?? "").trim();
  if (!name) {
    res.status(400).json({ error: "Name required" });
    return;
  }
  const roster = rosterStore.get();
  // New players cycle through the presets so they're distinguishable by default.
  const preset = PLAYER_THEMES[roster.length % PLAYER_THEMES.length];
  const player: RosterPlayer = {
    id: makeId(),
    name,
    ...resolveTheme(req.body, { color: preset.color, accent: preset.accent }),
    soundTheme: resolveSoundTheme(req.body?.soundTheme, defaultSoundThemeForPlayer(roster.length)),
    createdAt: new Date().toISOString(),
  };
  rosterStore.set([...roster, player]);
  broadcast();
  res.json(player);
});

app.patch("/api/players/:id", (req, res) => {
  const roster = rosterStore.get();
  const existing = roster.find((p) => p.id === req.params.id);
  if (!existing) {
    res.status(404).json({ error: "No such player" });
    return;
  }
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : existing.name;
  const updated: RosterPlayer = {
    ...existing,
    name: name || existing.name,
    ...resolveTheme(req.body, { color: existing.color, accent: existing.accent }),
    soundTheme: resolveSoundTheme(req.body?.soundTheme, existing.soundTheme ?? DEFAULT_SOUND_THEME),
  };
  rosterStore.set(roster.map((p) => (p.id === updated.id ? updated : p)));
  broadcast();
  res.json(updated);
});

app.delete("/api/players/:id", (req, res) => {
  const id = req.params.id;
  if (game().screen === "game" && game().players.includes(id)) {
    res.status(409).json({ error: "That player is in the current game" });
    return;
  }
  rosterStore.set(rosterStore.get().filter((p) => p.id !== id));
  // Drop them from any line-up being assembled. History keeps its own
  // snapshot of their name and colour, so past games stay intact.
  apply({ type: "REMOVE_PLAYER", playerId: id });
  broadcast();
  res.json({ ok: true });
});

// --- History --------------------------------------------------------------

app.get("/api/history", (req, res) => {
  const limit = Number(req.query.limit ?? 0);
  const records = historyStore.get();
  res.json(limit > 0 ? records.slice(0, limit) : records);
});

app.delete("/api/history", (_req, res) => {
  historyStore.set([]);
  res.json({ ok: true });
});

// --- Static client --------------------------------------------------------

if (fs.existsSync(STATIC_DIR)) {
  app.use(express.static(STATIC_DIR));
  app.get("*", (_req, res) => res.sendFile(path.join(STATIC_DIR, "index.html")));
}

app.listen(PORT, () => {
  console.log(`SlopDarts on http://localhost:${PORT} (board: ${BOARD_URL})`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    gameStore.saveNow();
    rosterStore.saveNow();
    historyStore.saveNow();
    boardStore.saveNow();
    process.exit(0);
  });
}
