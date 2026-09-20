import type { Action, GameState } from "./game/reducer";
import type { GameRecord, RosterPlayer } from "./types";

export interface AppSnapshot {
  game: GameState;
  roster: RosterPlayer[];
  boardUrl: string;
}

/**
 * How long a dropped SSE connection has to recover before the UI is told
 * about it. The browser fires `onerror` on any hiccup — including ones it
 * reconnects from on its own within a second or two — so reporting that
 * immediately as "disconnected" produced a "server lost" banner far more
 * often than the connection was actually down.
 */
const DISCONNECT_GRACE_MS = 8000;

/**
 * Subscribes to the server's live state. EventSource reconnects on its own,
 * and the server sends a full snapshot on every connect, so a dropped
 * connection self-heals without losing the match.
 */
export function subscribeToGame(
  onSnapshot: (snapshot: AppSnapshot) => void,
  onConnectionChange?: (connected: boolean) => void,
): () => void {
  const source = new EventSource("/api/game/stream");
  let disconnectTimer: ReturnType<typeof setTimeout> | null = null;

  source.onopen = () => {
    console.info("[sse] connected to /api/game/stream");
    if (disconnectTimer !== null) {
      clearTimeout(disconnectTimer);
      disconnectTimer = null;
    }
    onConnectionChange?.(true);
  };

  source.onmessage = (event) => {
    if (disconnectTimer !== null) {
      clearTimeout(disconnectTimer);
      disconnectTimer = null;
    }
    onConnectionChange?.(true);
    onSnapshot(JSON.parse(event.data) as AppSnapshot);
  };
  source.onerror = (event) => {
    console.warn("[sse] stream interrupted, waiting for reconnect…", event);
    if (disconnectTimer !== null) return;
    disconnectTimer = setTimeout(() => {
      disconnectTimer = null;
      console.warn("[sse] stream still disconnected after grace period");
      onConnectionChange?.(false);
    }, DISCONNECT_GRACE_MS);
  };

  return () => {
    console.info("[sse] closing /api/game/stream connection");
    if (disconnectTimer !== null) clearTimeout(disconnectTimer);
    source.close();
  };
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.error ?? `${init?.method ?? "GET"} ${url} -> ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/** Sends an action to the server, which owns the state, and returns the result. */
export function sendAction(action: Action): Promise<AppSnapshot> {
  return request<AppSnapshot>("/api/game/action", { method: "POST", body: JSON.stringify(action) });
}

export function createPlayer(name: string, color?: string, soundTheme?: string): Promise<RosterPlayer> {
  return request<RosterPlayer>("/api/players", {
    method: "POST",
    body: JSON.stringify({ name, color, soundTheme }),
  });
}

export function updatePlayer(id: string, patch: { name?: string; color?: string; accent?: string; soundTheme?: string }): Promise<RosterPlayer> {
  return request<RosterPlayer>(`/api/players/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export function deletePlayer(id: string): Promise<{ ok: true }> {
  return request<{ ok: true }>(`/api/players/${id}`, { method: "DELETE" });
}

export function fetchHistory(): Promise<GameRecord[]> {
  return request<GameRecord[]>("/api/history");
}

export type BoardCommand = "start" | "stop" | "reset" | "calibrate";

/** Sends a manual board control command; the server proxies it to the board manager. */
export function controlBoard(command: BoardCommand): Promise<{ ok: true }> {
  return request<{ ok: true }>(`/api/board/${command}`, { method: "POST" });
}
