import type { BoardState } from "./types";

export function connectionLabel(state: BoardState | null): string {
  // A null snapshot means the server couldn't reach the board at all.
  if (!state) return "Offline";
  // `connected` is deliberately NOT consulted. Firmware has been observed
  // reporting connected:false while actively detecting throws, so keying
  // off it would peg the UI to "Offline". It tracks the link to the camera
  // hardware; status/running are what say whether the engine is live.
  if (state.event === "Offline") return "Offline";
  if (state.status === "Throw" || state.status === "Takeout" || state.status === "Takeout in progress") {
    return "Running";
  }
  if (state.status === "Stopped") return "Stopped";
  return state.status || "Offline";
}

export function connectionColor(label: string): string {
  switch (label) {
    case "Running":
      return "#1fbf5c";
    case "Stopped":
      return "#e0a53a";
    case "Offline":
    case "Error":
      return "#e0473c";
    case "Calibrating":
      return "#9b5de5";
    default:
      return "#e0a53a";
  }
}

/**
 * Why the board can't be trusted to score the next dart right now, or null
 * if it's good to go. The board's own UI only calls itself ready to throw
 * at while its status is exactly "Throw" — every other status (including
 * "Takeout"/"Takeout in progress", which `connectionLabel` otherwise groups
 * in with "Running") means don't throw yet. `awaitingTakeout` catches what
 * status can't: darts from the previous turn still sitting in the board.
 */
export function boardNotReadyReason(state: BoardState | null, awaitingTakeout: boolean): string | null {
  const label = connectionLabel(state);
  if (label === "Offline") return "Can't reach the board.";
  if (awaitingTakeout) return "Waiting for takeout.";
  if (state?.status !== "Throw") return `Board is ${label.toLowerCase()}.`;
  return null;
}
