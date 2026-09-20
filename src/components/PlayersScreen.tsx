import { useEffect, useMemo, useState } from "react";
import { createPlayer, deletePlayer, fetchHistory, updatePlayer } from "../api";
import { GAME_LIST } from "../games/registry";
import { useGameStore } from "../state/store";
import { lighten, PLAYER_THEMES, readableTextColor, themeIdForColor } from "../theme";
import { DEFAULT_SOUND_THEME, SOUND_THEMES } from "../soundThemes";
import type { GameKind, GameRecord, RosterPlayer } from "../types";

interface PlayerTotals {
  games: number;
  wins: number;
  /** Aggregated stat lines per game kind, from each game's own module. */
  byKind: Array<{ kind: GameKind; title: string; lines: Array<{ label: string; value: string }> }>;
}

function totalsFor(playerId: string, history: GameRecord[]): PlayerTotals {
  const mine = history.filter((record) => record.players.some((p) => p.playerId === playerId));

  const byKind = GAME_LIST.flatMap((module) => {
    const stats = mine
      .filter((record) => record.kind === module.kind)
      .map((record) => record.players.find((p) => p.playerId === playerId)!.stats);
    if (stats.length === 0) return [];
    return [{ kind: module.kind, title: module.title, lines: module.aggregateStats(stats) }];
  });

  return {
    games: mine.length,
    wins: mine.filter((record) => record.winnerId === playerId).length,
    byKind,
  };
}

export default function PlayersScreen({ onBack }: { onBack: () => void }) {
  const { state, roster, refresh } = useGameStore();
  const [history, setHistory] = useState<GameRecord[]>([]);
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHistory()
      .then(setHistory)
      .catch(() => setHistory([]));
  }, []);

  const totals = useMemo(() => {
    const map = new Map<string, PlayerTotals>();
    for (const player of roster) map.set(player.id, totalsFor(player.id, history));
    return map;
  }, [roster, history]);

  async function add() {
    const name = newName.trim();
    if (!name) return;
    setNewName("");
    try {
      await createPlayer(name);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add player");
    }
  }

  async function save(id: string, patch: { name?: string; color?: string; accent?: string; soundTheme?: string }) {
    try {
      await updatePlayer(id, patch);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save player");
    }
  }

  async function remove(player: RosterPlayer) {
    if (!confirm(`Delete ${player.name}? Their past games stay in the history.`)) return;
    try {
      await deletePlayer(player.id);
      setEditing(null);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete player");
    }
  }

  return (
    <div className="screen">
      <div className="screen-head">
        <button className="btn btn-ghost" onClick={onBack}>
          ← Back
        </button>
        <h1 className="page-title">PLAYERS</h1>
      </div>

      {error && <div className="inline-error">{error}</div>}

      <div className="card">
        <div className="add-player-row">
          <input
            className="text-input"
            placeholder="New player name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
        </div>
        <button className="btn btn-primary btn-block" onClick={add} disabled={!newName.trim()}>
          + Add Player
        </button>
      </div>

      {roster.length === 0 && <p className="tile-desc empty-note">No players yet — add one above.</p>}

      <div className="roster-list">
        {roster.map((player) => {
          const stats = totals.get(player.id);
          const isEditing = editing === player.id;
          const inCurrentGame = state.screen === "game" && state.players.includes(player.id);

          return (
            <div className="card roster-card" key={player.id}>
              <div className="roster-head">
                <span
                  className="color-dot"
                  style={{ background: player.color, color: readableTextColor(player.color) }}
                >
                  {player.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="roster-name">{player.name}</span>
                <span className="roster-record">
                  {stats ? `${stats.games} games · ${stats.wins} wins` : "—"}
                </span>
                <button className="icon-btn" onClick={() => setEditing(isEditing ? null : player.id)}>
                  {isEditing ? "✕" : "✎"}
                </button>
              </div>

              {isEditing && (
                <div className="roster-edit">
                  <label className="settings-label" htmlFor={`name-${player.id}`}>
                    Name
                  </label>
                  <input
                    id={`name-${player.id}`}
                    className="text-input"
                    defaultValue={player.name}
                    onBlur={(e) => e.target.value.trim() && save(player.id, { name: e.target.value })}
                  />

                  <span className="settings-label">Turn theme</span>
                  <div className="theme-grid">
                    {PLAYER_THEMES.map((theme) => (
                      <button
                        key={theme.id}
                        className={`theme-option ${themeIdForColor(player.color) === theme.id ? "theme-option-active" : ""}`}
                        style={{
                          background: `linear-gradient(135deg, ${theme.color}, ${theme.accent})`,
                          color: readableTextColor(theme.color),
                        }}
                        onClick={() => save(player.id, { color: theme.color, accent: theme.accent })}
                      >
                        {theme.name}
                      </button>
                    ))}
                  </div>

                  <label className="custom-theme">
                    <span className="settings-label">Or a custom colour</span>
                    <input
                      className="swatch-custom"
                      type="color"
                      value={player.color}
                      onChange={(e) =>
                        save(player.id, { color: e.target.value, accent: lighten(e.target.value, 0.25) })
                      }
                    />
                  </label>
                  <p className="tile-desc">The whole app takes this colour when it's their turn.</p>

                  <label className="settings-field" htmlFor={`sound-${player.id}`}>
                    <span className="settings-label">Sound profile</span>
                    <select
                      id={`sound-${player.id}`}
                      className="text-input"
                      value={player.soundTheme ?? DEFAULT_SOUND_THEME}
                      onChange={(e) => save(player.id, { soundTheme: e.target.value })}
                    >
                      {SOUND_THEMES.map((theme) => (
                        <option key={theme.id} value={theme.id}>
                          {theme.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="tile-desc">
                    {SOUND_THEMES.find((theme) => theme.id === (player.soundTheme ?? DEFAULT_SOUND_THEME))?.description}
                  </p>

                  

                  <button
                    className="btn btn-ghost"
                    onClick={() => remove(player)}
                    disabled={inCurrentGame}
                    title={inCurrentGame ? "They're in the game that's running" : undefined}
                  >
                    Delete player
                  </button>
                </div>
              )}

              {stats && stats.byKind.length > 0 && (
                <div className="stat-groups">
                  {stats.byKind.map((group) => (
                    <div className="stat-group" key={group.kind}>
                      <span className="stat-group-title">{group.title}</span>
                      <div className="stat-lines">
                        {group.lines.map((line) => (
                          <div className="stat-line" key={line.label}>
                            <span className="stat-line-value">{line.value}</span>
                            <span className="stat-line-label">{line.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
