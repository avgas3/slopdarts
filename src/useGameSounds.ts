import { useEffect, useRef } from "react";
import type { GameEvent } from "./game/reducer";
import { sounds } from "./sound";
import type { RosterPlayer } from "./types";

/**
 * Plays a sound for each game event the server reports that this client
 * hasn't heard yet. Event sequence numbers come from the server, so a
 * reload or a second device joining mid-match doesn't replay old sounds.
 */
export function useGameSounds(events: GameEvent[], eventSeq: number, roster: RosterPlayer[]) {
  const playedUpTo = useRef<number | null>(null);

  useEffect(() => {
    // First snapshot: adopt the current position without making noise.
    if (playedUpTo.current === null) {
      playedUpTo.current = eventSeq;
      return;
    }
    if (eventSeq <= playedUpTo.current) return;

    for (const event of events) {
      if (event.seq <= playedUpTo.current) continue;
      const player = event.playerId ? roster.find((entry) => entry.id === event.playerId) : undefined;
      sounds.play(event.kind, player?.soundTheme);
    }
    playedUpTo.current = eventSeq;
  }, [events, eventSeq, roster]);
}
