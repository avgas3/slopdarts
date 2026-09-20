import { useEffect, useState } from "react";
import { fetchHistory } from "../api";
import { getGameModule } from "../games/registry";
import { readableTextColor } from "../theme";
import type { GameRecord } from "../types";

function formatWhen(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDuration(startedAt: string, finishedAt: string): string {
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return "";
  const minutes = Math.round(ms / 60000);
  return minutes < 1 ? "under a minute" : `${minutes} min`;
}

export default function HistoryScreen({ onBack }: { onBack: () => void }) {
  const [records, setRecords] = useState<GameRecord[] | null>(null);

  useEffect(() => {
    fetchHistory()
      .then(setRecords)
      .catch(() => setRecords([]));
  }, []);

  return (
    <div className="screen">
      <div className="screen-head">
        <button className="btn btn-ghost" onClick={onBack}>
          ← Back
        </button>
        <h1 className="page-title">HISTORY</h1>
      </div>

      {records === null && <p className="tile-desc empty-note">Loading…</p>}
      {records?.length === 0 && (
        <p className="tile-desc empty-note">No games recorded yet. Finish a match and it'll show up here.</p>
      )}

      <div className="history-list">
        {records?.map((record) => {
          const module = getGameModule(record.kind);
          const duration = formatDuration(record.startedAt, record.finishedAt);

          return (
            <div className="card history-card" key={record.id}>
              <div className="history-head">
                <span className="history-title">{module.title}</span>
                <span className="history-chips">
                  {module.settingsSummaryChips(record.settings).map((chip: string) => (
                    <span className="chip chip-sm" key={chip}>
                      {chip}
                    </span>
                  ))}
                </span>
                <span className="history-when">
                  {formatWhen(record.finishedAt)}
                  {duration && ` · ${duration}`}
                </span>
              </div>

              {!record.completed && <div className="history-abandoned">Abandoned before anyone won</div>}

              <div className="history-players">
                {record.players.map((player) => {
                  const won = record.winnerId === player.playerId;
                  return (
                    <div className={`history-player ${won ? "history-player-won" : ""}`} key={player.playerId}>
                      <span
                        className="color-dot color-dot-sm"
                        style={{ background: player.color, color: readableTextColor(player.color) }}
                      >
                        {player.name.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="history-player-name">
                        {player.name}
                        {won && <span className="win-tag">WON</span>}
                      </span>
                      <span className="history-player-stat">{module.recordSummary(player.stats)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
