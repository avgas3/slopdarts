import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { sendAction, subscribeToGame, type AppSnapshot } from "../api";
import type { Action, GameState } from "../game/reducer";
import { getGameModule } from "../games/registry";
import { getPlayerSettings } from "../game/reducer";
import { DEFAULT_THEME } from "../theme";
import { DEFAULT_SOUND_THEME } from "../soundThemes";
import type { RosterPlayer } from "../types";

export { MAX_PLAYERS } from "../game/reducer";

interface StoreValue {
  state: GameState;
  roster: RosterPlayer[];
  boardUrl: string;
  dispatch: (action: Action) => void;
  /** Re-reads the server snapshot, e.g. after a roster edit. */
  refresh: () => void;
  serverConnected: boolean;
}

const StoreContext = createContext<StoreValue | null>(null);

export function GameStoreProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null);
  const [serverConnected, setServerConnected] = useState(false);

  useEffect(() => subscribeToGame(setSnapshot, setServerConnected), []);

  // The server owns the state, so dispatching is a POST; its response is the
  // new snapshot, and every other connected client hears about it over SSE.
  const dispatch = useCallback((action: Action) => {
    sendAction(action)
      .then(setSnapshot)
      .catch((err) => console.error("Action failed:", err));
  }, []);

  // Roster mutations are their own endpoints; the server broadcasts, but
  // refreshing keeps the acting client snappy.
  const refresh = useCallback(() => {
    fetch("/api/game")
      .then((res) => res.json())
      .then(setSnapshot)
      .catch(() => {});
  }, []);

  const value = useMemo(
    () =>
      snapshot
        ? { state: snapshot.game, roster: snapshot.roster, boardUrl: snapshot.boardUrl, dispatch, refresh, serverConnected }
        : null,
    [snapshot, dispatch, refresh, serverConnected],
  );

  if (!value) {
    return <div className="app-loading">Connecting to the board server…</div>;
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useGameStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useGameStore must be used within GameStoreProvider");
  return ctx;
}

/** The active game's module, or null on screens where no game is selected. */
export function useActiveGame() {
  const { state } = useGameStore();
  if (!state.mode) return null;
  const module = getGameModule(state.mode);
  return { module, settings: state.settings[state.mode] };
}

/**
 * Roster entries for the current line-up, in throw order. Always the same
 * length as `state.players`: a missing roster entry becomes a placeholder
 * rather than being dropped, because dropping one would shift every later
 * index and mismatch `activePlayerIndex` — highlighting one player while
 * scoring another.
 */
export function useLineup(): RosterPlayer[] {
  const { state, roster } = useGameStore();
  return state.players.map(
    (id) =>
      roster.find((p) => p.id === id) ?? {
        id,
        name: "Unknown",
        color: DEFAULT_THEME.color,
        accent: DEFAULT_THEME.accent,
        soundTheme: DEFAULT_SOUND_THEME,
        createdAt: "",
      },
  );
}
