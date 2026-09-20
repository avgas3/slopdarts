import { useEffect, useRef, useState } from "react";
import { controlBoard, type BoardCommand } from "../api";
import { connectionColor, connectionLabel } from "../boardStatus";
import { useGameStore } from "../state/store";
import type { BoardState } from "../types";

interface BoardUrlEditState {
  open: boolean;
  value: string;
  saving: boolean;
  error: string | null;
}

interface BoardStatusProps {
  board: BoardState | null;
  /** Adds the raw engine status, last event and dart count. */
  detailed?: boolean;
}

const COMMANDS: Array<{ command: BoardCommand; label: string }> = [
  { command: "start", label: "Start" },
  { command: "stop", label: "Stop" },
  { command: "reset", label: "Reset throws" },
  { command: "calibrate", label: "Calibrate" },
];

/**
 * Live connection and detection state of the remote board. Only shown
 * where the board actually matters — i.e. when autoscoring is on. Clicking
 * it opens manual start/stop/reset/calibrate controls for when the board
 * needs a nudge outside of the automatic ready-up at the start of a match.
 */
export default function BoardStatus({ board, detailed = false }: BoardStatusProps) {
  const { boardUrl, refresh } = useGameStore();
  const label = boardUrl ? connectionLabel(board) : "Board URL Missing";
  const color = connectionColor(label);
  const offline = label === "Offline";

  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<BoardCommand | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [urlActionsOpen, setUrlActionsOpen] = useState(false);
  const [urlEdit, setUrlEdit] = useState<BoardUrlEditState>({ open: false, value: "", saving: false, error: null });
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onOutsideClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, [open]);

  async function run(command: BoardCommand) {
    setPending(command);
    setError(null);
    try {
      await controlBoard(command);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Board request failed");
    } finally {
      setPending(null);
    }
  }

  async function saveBoardUrl() {
    const value = urlEdit.value.trim();
    if (!value) {
      setUrlEdit((prev) => ({ ...prev, error: "Board URL is required" }));
      return;
    }
    setUrlEdit((prev) => ({ ...prev, saving: true, error: null }));
    try {
      const res = await fetch("/api/board/url", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: value }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error ?? "Board URL update failed");
      }
      refresh();
      setUrlActionsOpen(false);
      setUrlEdit({ open: false, value: "", saving: false, error: null });
    } catch (err) {
      setUrlEdit((prev) => ({ ...prev, saving: false, error: err instanceof Error ? err.message : "Board URL update failed" }));
    }
  }

  const chip = (
    <button
      type="button"
      className="conn-chip conn-chip-btn"
      style={{ color }}
      title={board ? `${board.status} — ${board.event}` : "Click for board controls"}
      onClick={() => setOpen((v) => !v)}
    >
      ● {label}
    </button>
  );

  const popover = open && (
    <div className="board-controls-popover">
      {!boardUrl || urlEdit.open ? (
        <form className="board-url-editor" onSubmit={(event) => { event.preventDefault(); void saveBoardUrl(); }}>
          <input
            type="url"
            aria-label="Autodarts board URL"
            required
            value={urlEdit.value}
            disabled={urlEdit.saving}
            onChange={(event) => setUrlEdit((prev) => ({ ...prev, value: event.target.value }))}
            placeholder="Enter autodarts board url..."
            className="board-url-input"
          />
          <div className="board-url-actions">
            <button type="submit" className="board-controls-btn" disabled={urlEdit.saving}>
              {urlEdit.saving ? "Saving…" : "Save URL"}
            </button>
            {boardUrl && <button
              type="button"
              className="board-controls-btn board-controls-btn-muted"
              disabled={urlEdit.saving}
              onClick={() => setUrlEdit({ open: false, value: boardUrl, saving: false, error: null })}
            >
              Cancel
            </button>}
          </div>
          {urlEdit.error && <p className="board-status-warn board-controls-error">{urlEdit.error}</p>}
        </form>
      ) : (
        <>
          <button
            type="button"
            className="board-controls-btn board-url-button"
            aria-expanded={urlActionsOpen}
            onClick={() => setUrlActionsOpen((value) => !value)}
          >
            {boardUrl}
          </button>
          {urlActionsOpen && (
            <div className="board-url-actions">
              <button
                type="button"
                className="board-controls-btn"
                onClick={() => {
                  setUrlEdit({ open: true, value: boardUrl, saving: false, error: null });
                  setUrlActionsOpen(false);
                }}
              >
                Edit URL
              </button>
              <a className="board-controls-btn" href={boardUrl} target="_blank" rel="noopener noreferrer">
                Open in new tab ↗
              </a>
            </div>
          )}
        </>
      )}
      {COMMANDS.map(({ command, label: commandLabel }) => (
        <button
          key={command}
          type="button"
          className="board-controls-btn"
          disabled={!boardUrl || pending !== null}
          onClick={() => run(command)}
        >
          {pending === command ? "…" : commandLabel}
        </button>
      ))}
      {error && <p className="board-status-warn board-controls-error">{error}</p>}
    </div>
  );

  if (!detailed) {
    return (
      <div className="board-status-wrap" ref={rootRef}>
        {chip}
        {popover}
      </div>
    );
  }

  return (
    <div className="board-status" ref={rootRef}>
      <div className="board-status-head">
        {chip}
        {boardUrl && board && !offline && (
          <span className="board-status-darts">
            {board.numThrows} dart{board.numThrows === 1 ? "" : "s"} in board
          </span>
        )}
      </div>

      {popover}

      {!boardUrl ? (
        <p className="board-status-detail board-status-warn">Enter your board URL to enable autoscoring.</p>
      ) : offline ? (
        <p className="board-status-detail board-status-warn">
          Can't reach the board. Check the saved URL and that the board manager is running.
        </p>
      ) : (
        board && (
          <dl className="board-status-detail">
            <div>
              <dt>Engine</dt>
              <dd>{board.status}</dd>
            </div>
            <div>
              <dt>Last event</dt>
              <dd>{board.event || "—"}</dd>
            </div>
            <div>
              <dt>Detecting</dt>
              <dd>{board.running ? "Yes" : "No"}</dd>
            </div>
          </dl>
        )
      )}
    </div>
  );
}
