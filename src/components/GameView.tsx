import { useState } from "react";
import { boardNotReadyReason } from "../boardStatus";
import { getPlayerSettings } from "../game/reducer";
import { livePlayerProgress } from "../game/selectors";
import { segmentLabel } from "../games/segment";
import { sounds } from "../sound";
import { useActiveGame, useGameStore, useLineup } from "../state/store";
import type { Segment } from "../types";
import Dartboard from "./Dartboard";
import PlayerPanel from "./PlayerPanel";

type EditMultiplier = 1 | 2 | 3;

const EDIT_MULTIPLIERS: Array<{ value: EditMultiplier; label: string }> = [
  { value: 1, label: "Single" },
  { value: 2, label: "Double" },
  { value: 3, label: "Triple" },
];

function editableSegment(number: number, multiplier: EditMultiplier): Segment {
  const bed = multiplier === 1 ? "Single" : multiplier === 2 ? "Double" : "Triple";
  const prefix = multiplier === 1 ? "S" : multiplier === 2 ? "D" : "T";
  return { name: `${prefix}${number}`, number, bed, multiplier };
}

function editableBull(multiplier: Exclude<EditMultiplier, 3>): Segment {
  return multiplier === 1
    ? { name: "25", number: 25, bed: "Single", multiplier: 1 }
    : { name: "50", number: 25, bed: "Double", multiplier: 2 };
}

export default function GameView() {
  const { state, dispatch } = useGameStore();
  const [muted, setMuted] = useState(() => sounds.isMuted());
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editMultiplier, setEditMultiplier] = useState<EditMultiplier>(1);
  const active = useActiveGame();
  const lineup = useLineup();
  if (!active) return null;
  const { module, settings } = active;

  const activePlayerId = state.players[state.activePlayerIndex];
  // Live, not committed: the target has to follow mid-turn hits so the next
  // dart in the same turn is aimed at the right number.
  const activeGame = activePlayerId ? livePlayerProgress(state, activePlayerId)?.game : undefined;
  const highlightNumber = activeGame !== undefined ? module.highlightNumber(activeGame) : null;
  const activePlayerSettings = activePlayerId ? getPlayerSettings(state, module, activePlayerId) : settings;
  const turnTotal = module.turnTotal(state.currentTurnDarts, state.turnStartGame, activePlayerSettings, state.matchContext);

  const winner = state.winnerId ? lineup.find((p) => p.id === state.winnerId) : null;
  const activePlayer = lineup.find((p) => p.id === activePlayerId);
  // With autoscoring off the board is irrelevant to the match — manual entry always works.
  const notReady = state.autoscoring ? boardNotReadyReason(state.boardState, state.awaitingTakeout) : null;

  function handleSegmentClick(segment: Segment) {
    if (state.autoscoring) return;
    dispatch({ type: "MANUAL_DART", segment });
  }

  function beginEditing(index: number, segment: Segment) {
    setEditMultiplier(segment.multiplier === 2 ? 2 : segment.multiplier === 3 ? 3 : 1);
    setEditingIndex(index);
  }

  function finishEditing(segment: Segment) {
    if (editingIndex === null) return;
    dispatch({ type: "EDIT_DART", index: editingIndex, segment });
    setEditingIndex(null);
  }

  function renderPanels(parity: 0 | 1, side: "left" | "right") {
    return lineup
      .map((player, index) => ({ player, index }))
      .filter(({ index }) => index % 2 === parity)
      .map(({ player, index }) => (
        <PlayerPanel
          key={player.id}
          player={player}
          isActive={index === state.activePlayerIndex}
          module={module}
          settings={getPlayerSettings(state, module, player.id)}
          progress={livePlayerProgress(state, player.id)}
          side={side}
        />
      ));
  }

  return (
    <div className="screen game-view">
      <div className="game-topbar">
        <button className="exit-link" onClick={() => dispatch({ type: "EXIT_GAME" })}>
          ‹ Exit
        </button>
        <span className="mode-chip">{module.kind.toUpperCase()}</span>
        {activePlayer && <span className="turn-label">{activePlayer.name}'s turn</span>}
        <button
          className="icon-btn"
          title={muted ? "Unmute sounds" : "Mute sounds"}
          aria-pressed={muted}
          onClick={() => {
            const next = !muted;
            sounds.setMuted(next);
            setMuted(next);
          }}
        >
          {muted ? "🔇" : "🔊"}
        </button>
      </div>

      <div className="turn-bar">
        {[0, 1, 2].map((i) => {
          const dart = state.currentTurnDarts[i];
          return (
            <button
              key={i}
              type="button"
              className={`dart-slot ${dart ? "dart-slot-filled" : ""}`}
              disabled={!dart}
              title={dart ? "Edit this dart" : undefined}
              onClick={() => dart && beginEditing(i, dart)}
            >
              {dart ? segmentLabel(dart) : "—"}
            </button>
          );
        })}
        <span className="turn-total">{turnTotal}</span>
      </div>

      <div className="game-body">
        <div className="players-column players-column-left">{renderPanels(0, "left")}</div>

        <div className="board-area">
          <div className="board-stack">
            <Dartboard
              interactive={!state.autoscoring && !state.winnerId && !state.turnComplete}
              onSegmentClick={handleSegmentClick}
              highlightNumber={highlightNumber}
              // Detected darts are only meaningful when the board is scoring;
              // in manual mode they'd be unrelated darts sitting in the board.
              throws={state.autoscoring ? state.boardState?.throws ?? [] : []}
            />
            {notReady && (
              <div className="board-hold-overlay">
                <div className="board-hold-icon">✋</div>
                <div className="board-hold-title">Hold on!</div>
                <p className="board-hold-detail">{notReady}</p>
              </div>
            )}
          </div>
        </div>

        <div className="players-column players-column-right">{renderPanels(1, "right")}</div>
      </div>

      <div className="bottom-bar">
        <div className="bottom-status">
          {state.turnComplete
            ? state.autoscoring
              ? "Check your darts, then remove them or press Next Turn"
              : "Check your darts, then press Next Turn"
            : state.autoscoring ? "Autoscoring from board" : "Tap the dartboard to record a throw"}
        </div>
        <button className="btn bottom-undo" onClick={() => dispatch({ type: "UNDO_DART" })}>
          ↺ Undo Dart
        </button>
        <button
          className="btn btn-primary"
          onClick={() => dispatch({ type: "NEXT_TURN" })}
          disabled={state.currentTurnDarts.length === 0}
        >
          Next Turn
        </button>
      </div>

      {winner && (
        <div className="modal-overlay">
          <div className="modal winner-modal">
            <h2>{winner.name} wins!</h2>
            <button className="btn btn-primary btn-lg" onClick={() => dispatch({ type: "EXIT_GAME" })}>
              Back to Menu
            </button>
          </div>
        </div>
      )}

      {editingIndex !== null && state.currentTurnDarts[editingIndex] && (
        <div className="modal-overlay" onClick={() => setEditingIndex(null)}>
          <div className="modal dart-edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <span className="modal-title">EDIT DART {editingIndex + 1}</span>
              <button className="icon-btn" onClick={() => setEditingIndex(null)}>
                ✕
              </button>
            </div>
            <div className="dart-edit-multipliers" role="group" aria-label="Dart multiplier">
              {EDIT_MULTIPLIERS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  className={`dart-edit-multiplier ${editMultiplier === value ? "active" : ""}`}
                  aria-pressed={editMultiplier === value}
                  onClick={() => setEditMultiplier(value)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="dart-edit-numbers" aria-label="Dart number">
              {Array.from({ length: 20 }, (_, index) => index + 1).map((number) => (
                <button
                  key={number}
                  type="button"
                  className="dart-edit-number"
                  onClick={() => finishEditing(editableSegment(number, editMultiplier))}
                >
                  {number}
                </button>
              ))}
              {editMultiplier !== 3 && (
                <button
                  type="button"
                  className="dart-edit-number dart-edit-bull"
                  onClick={() => finishEditing(editableBull(editMultiplier))}
                >
                  Bull
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
