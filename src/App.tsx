import { useLayoutEffect, useState } from "react";
import BoardStatus from "./components/BoardStatus";
import GameSettingsModal from "./components/GameSettingsModal";
import GameView from "./components/GameView";
import HistoryScreen from "./components/HistoryScreen";
import ModeSelect from "./components/ModeSelect";
import PlayersScreen from "./components/PlayersScreen";
import PlayerSetup from "./components/PlayerSetup";
import { useGameStore, useLineup } from "./state/store";
import { TURN_THEME_VAR_NAMES, turnThemeVars } from "./theme";
import { useGameSounds } from "./useGameSounds";

/**
 * Players and History are local views: browsing them on one device should not
 * drag the shared board display along. The game flow itself (select → setup
 * → game) is server state, so every screen stays in step.
 */
type LocalView = "game" | "players" | "history";

export default function App() {
  const { state, roster, serverConnected } = useGameStore();
  const lineup = useLineup();
  const [view, setView] = useState<LocalView>("game");
  const [settingsOpen, setSettingsOpen] = useState(false);

  useGameSounds(state.events, state.eventSeq, lineup);

  const activePlayer = state.screen === "game" ? lineup[state.activePlayerIndex] : undefined;
  const themed = activePlayer !== undefined && !state.winnerId;
  const color = themed ? activePlayer.color : null;
  const accent = themed ? activePlayer.accent : null;

  // The vars go on <html> rather than the app div because the page
  // background lives on html/body — including the overscroll canvas.
  // useLayoutEffect so the tint is in place before the first paint.
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (!color) {
      root.removeAttribute("data-turn");
      for (const name of TURN_THEME_VAR_NAMES) root.style.removeProperty(name);
      return;
    }
    for (const [name, value] of Object.entries(turnThemeVars(color, accent))) {
      root.style.setProperty(name, value);
    }
    root.setAttribute("data-turn", "active");
  }, [color, accent]);

  return (
    <div className={`app-shell ${themed ? "app-themed" : ""}`}>
      {!serverConnected && <div className="reconnect-banner">Reconnecting to the game server…</div>}

      <header className="app-brand" aria-label="SlopDarts brand bar">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">✦</span>
          <div className="brand-text">
            <span className="brand-kicker">Fully Local Autodarts Client</span>
            <span className="brand-name">SlopDarts</span>
          </div>
        </div>
        <nav className="brand-actions" aria-label="App navigation">
          {(state.screen !== "game" || state.autoscoring) && <BoardStatus board={state.boardState} />}
          <button className="btn btn-outline btn-auto" aria-pressed={view === "players"} onClick={() => setView("players")}>
            Players <span className="pill">{roster.length}</span>
          </button>
          <button className="btn btn-outline btn-auto" aria-pressed={view === "history"} onClick={() => setView("history")}>
            History
          </button>
        </nav>
      </header>

      {/* A frame in the active player's colour — readable from across the room. */}
      {themed && <div className="turn-frame" aria-hidden="true" />}

      {view === "players" && <PlayersScreen onBack={() => setView("game")} />}
      {view === "history" && <HistoryScreen onBack={() => setView("game")} />}

      {view === "game" && (
        <>
          {state.screen === "select" && (
            <ModeSelect />
          )}
          {state.screen === "setup" && (
            <PlayerSetup onEditSettings={() => setSettingsOpen(true)} onOpenPlayers={() => setView("players")} />
          )}
          {state.screen === "game" && <GameView />}
        </>
      )}

      {settingsOpen && <GameSettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
