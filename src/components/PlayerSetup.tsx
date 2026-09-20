import { useState } from "react";
import { createPlayer } from "../api";
import { getPlayerSettings } from "../game/reducer";
import { MAX_PLAYERS, useActiveGame, useGameStore, useLineup } from "../state/store";
import { readableTextColor } from "../theme";
import BoardStatus from "./BoardStatus";

interface PlayerSetupProps {
  onEditSettings: () => void;
  onOpenPlayers: () => void;
}

export default function PlayerSetup({ onEditSettings, onOpenPlayers }: PlayerSetupProps) {
  const { state, roster, dispatch, refresh } = useGameStore();
  const active = useActiveGame();
  const lineup = useLineup();
  const [newName, setNewName] = useState("");
  const [playerSettingsOpen, setPlayerSettingsOpen] = useState(false);

  if (!active) return null;
  const { module, settings } = active;

  const available = roster.filter((player) => !state.players.includes(player.id));
  const full = state.players.length >= MAX_PLAYERS;

  async function addNewPlayer() {
    const name = newName.trim();
    if (!name) return;
    setNewName("");
    try {
      const player = await createPlayer(name);
      dispatch({ type: "ADD_PLAYER", playerId: player.id });
      refresh();
    } catch (err) {
      console.error("Could not create player:", err);
    }
  }

  function move(index: number, delta: number) {
    const next = [...state.players];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    dispatch({ type: "REORDER_PLAYERS", playerIds: next });
  }

  return (
    <div className="screen player-setup">
      <div className="card players-card">
        <div className="card-head">
          <span className="card-title">
            PLAYERS <span className="pill">{state.players.length}/{MAX_PLAYERS}</span>
          </span>
          <button className="btn btn-ghost btn-auto" onClick={onOpenPlayers}>
            Manage
          </button>
        </div>

        <div className="player-rows">
          {lineup.map((player, index) => (
            <div className="player-row" key={player.id}>
              <span className="turn-order">{index + 1}</span>
              <span
                className="color-dot color-dot-sm"
                style={{ background: player.color, color: readableTextColor(player.color) }}
              >
                {player.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="player-name">{player.name}</span>
              <button className="icon-btn" title="Move up" disabled={index === 0} onClick={() => move(index, -1)}>
                ↑
              </button>
              <button
                className="icon-btn"
                title="Move down"
                disabled={index === lineup.length - 1}
                onClick={() => move(index, 1)}
              >
                ↓
              </button>
              <button
                className="icon-btn"
                title="Remove from game"
                onClick={() => dispatch({ type: "REMOVE_PLAYER", playerId: player.id })}
              >
                ✕
              </button>
            </div>
          ))}
          {lineup.length === 0 && <p className="tile-desc empty-note">Pick who's playing below.</p>}
        </div>

        {available.length > 0 && !full && (
          <>
            <span className="this-game-label">Add from roster</span>
            <div className="chip-row">
              {available.map((player) => (
                <button
                  className="player-chip"
                  key={player.id}
                  style={{ borderColor: player.color }}
                  onClick={() => dispatch({ type: "ADD_PLAYER", playerId: player.id })}
                >
                  <span className="chip-dot" style={{ background: player.color }} />
                  {player.name}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="add-player-row">
          <input
            className="text-input"
            placeholder="New player name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addNewPlayer()}
            disabled={full}
          />
        </div>
        <button className="btn btn-primary btn-block" onClick={addNewPlayer} disabled={full || !newName.trim()}>
          + Create &amp; Add Player
        </button>
      </div>

      <div className="setup-lower">
        <div className="card game-card">
          <div className="card-head">
            <span className="card-title">{module.title}</span>
          </div>
          <p className="tile-desc">{module.description}</p>
          <hr className="divider" />
          <div className="this-game">
            <span className="this-game-label">This game</span>
            <div className="chip-row">
              {module.settingsSummaryChips(settings).map((chip: string) => (
                <span className="chip" key={chip}>
                  {chip}
                </span>
              ))}
            </div>
          </div>
          <button className="btn btn-outline" onClick={onEditSettings}>
            ⚙ Edit settings
          </button>
        </div>

        {module.playerSettingsFields && module.playerSettingsFields.length > 0 && (
          <div className="card game-card">
            <button
              type="button"
              className="card-head collapsible-card-head"
              aria-expanded={playerSettingsOpen}
              onClick={() => setPlayerSettingsOpen((open) => !open)}
            >
              <span className="card-title">PER-PLAYER SETTINGS</span>
              <span className="collapse-indicator" aria-hidden="true">
                {playerSettingsOpen ? "−" : "+"}
              </span>
            </button>
            {playerSettingsOpen && <div className="player-rows">
              {lineup.map((player) => {
                const playerSettings = getPlayerSettings<Record<string, unknown>>(state, module, player.id);
                const overrides = (state.playerSettings[module.kind]?.[player.id] ?? {}) as Record<string, unknown>;
                return (
                  <div className="player-row" key={`player-settings-${player.id}`}>
                    <span className="player-name">{player.name}</span>
                    <div className="chip-row" style={{ flexWrap: "wrap" }}>
                      {module.playerSettingsFields!.map((field) => {
                        const selectedValue = playerSettings[field.key];
                        const currentOverride = overrides[field.key];
                        const isDefaultSelection = currentOverride === undefined;
                        const isSelected = selectedValue === field.options.find((opt) => opt.value === selectedValue)?.value;

                        return (
                          <div key={`${player.id}-${field.key}`} className="settings-group" style={{ margin: 0 }}>
                            <span className="settings-label-row">
                              <span className="settings-label">{field.label}</span>
                              <span className={`settings-state ${isDefaultSelection ? "default" : "override"}`}>
                                {isDefaultSelection ? "Default" : "Override"}
                              </span>
                            </span>
                            <div className="segmented" style={{ marginTop: 4 }}>
                              {field.options.map((opt) => {
                                const isOptionSelected = selectedValue === opt.value;
                                return (
                                  <button
                                    key={`${player.id}-${field.key}-${String(opt.value)}`}
                                    className={`segmented-opt ${isOptionSelected ? "active" : ""} ${
                                      isOptionSelected && isDefaultSelection ? "default" : ""
                                    } ${isOptionSelected && !isDefaultSelection ? "override" : ""}`}
                                    onClick={() =>
                                      dispatch({
                                        type: "SET_PLAYER_SETTINGS",
                                        kind: module.kind,
                                        playerId: player.id,
                                        patch: { [field.key]: opt.value },
                                      })
                                    }
                                  >
                                    {opt.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>}
          </div>
        )}

        <div className="card autoscoring-card">
          <div className="card-head">
            <span className="card-title">AUTOSCORING</span>
            <label className="toggle">
              <input
                type="checkbox"
                checked={state.autoscoring}
                onChange={(e) => dispatch({ type: "SET_AUTOSCORING", value: e.target.checked })}
              />
              <span className="toggle-track" />
            </label>
          </div>
          <p className="tile-desc">
            {state.autoscoring
              ? "The board will score this match automatically."
              : "You'll score this match yourself. The board is ignored entirely."}
          </p>
          {state.autoscoring && (
            <>
              <hr className="divider" />
              <BoardStatus board={state.boardState} detailed />
            </>
          )}
        </div>
      </div>

      <div className="button-row setup-actions">
        <button className="btn btn-ghost" onClick={() => dispatch({ type: "BACK_TO_SELECT" })}>
          ← Back
        </button>
        <button
          className="btn btn-primary btn-lg"
          onClick={() => dispatch({ type: "START_GAME" })}
          disabled={state.players.length === 0}
        >
          Start Game
        </button>
      </div>
    </div>
  );
}
