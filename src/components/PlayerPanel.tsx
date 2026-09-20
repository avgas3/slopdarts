import type { AnyGameModule } from "../games/registry";
import type { DisplayFields } from "../games/types";
import { readableTextColor } from "../theme";
import type { PlayerProgress, RosterPlayer } from "../types";

interface PlayerPanelProps {
  player: RosterPlayer;
  isActive: boolean;
  module: AnyGameModule;
  settings: unknown;
  progress: PlayerProgress<unknown> | undefined;
  side: "left" | "right";
}

export default function PlayerPanel({ player, isActive, module, settings, progress, side }: PlayerPanelProps) {
  const display: DisplayFields = progress ? module.display(progress, settings) : { layout: "default", big: "-", stat: "" };
  const { big, small, stat, leftColumn, rightColumn, rows } = display;

  // The active player's panel is filled with their own theme; everyone else
  // keeps a slim colour marker so they're still identifiable.
  const style = isActive
    ? {
        background: `linear-gradient(150deg, ${player.color}, ${player.accent})`,
        color: readableTextColor(player.color),
        borderColor: "transparent",
      }
    : { borderLeft: `3px solid ${player.color}` };

  const defaultScore = (
    <>
      <div className="player-panel-score">
        <span className="score-big">{big ?? "-"}</span>
        {small !== undefined && <span className="score-small">{small}</span>}
      </div>
      <div className="player-panel-stat">{stat ?? ""}</div>
    </>
  );

  const x01Score = (
    <div className="player-panel-score-x01">
      <div className="player-panel-score-primary">
        <span className="score-big">{big ?? "-"}</span>
        {small !== undefined && <span className="score-small">{small}</span>}
      </div>
      <div className="player-panel-score-columns">
        <div className="player-panel-score-list">
          {(leftColumn ?? []).map((value: string, index: number) => (
            <span key={`left-${index}`} className="score-mini-row">
              {value}
            </span>
          ))}
        </div>
        <div className="player-panel-score-list player-panel-score-list-right">
          {(rightColumn ?? []).map((value: string, index: number) => (
            <span key={`right-${index}`} className="score-mini-row">
              {value}
            </span>
          ))}
        </div>
      </div>
    </div>
  );

  const cricketScore = (
    <div className="player-panel-score-cricket">
      <div className="player-panel-score-cricket-top">
        <span className="score-big">{big ?? "-"}</span>
        {small !== undefined && <span className="score-small">{small}</span>}
      </div>
      <div className="player-panel-score-cricket-grid">
        {(rows ?? []).map((row) => (
          <div key={row.label} className="cricket-score-row">
            <span className="cricket-score-label">{row.label}</span>
            <span className="cricket-score-value">{row.value}</span>
          </div>
        ))}
      </div>
      {stat && <div className="player-panel-stat">{stat}</div>}
    </div>
  );

  return (
    <div className={`player-panel player-panel-${side} ${isActive ? "player-panel-active" : ""}`} style={style}>
      <div className="player-panel-head">
        {isActive && <span className="active-dot" />}
        <span className="player-panel-name">{player.name}</span>
      </div>
      {display.layout === "x01" ? x01Score : display.layout === "cricket" ? cricketScore : defaultScore}
    </div>
  );
}
