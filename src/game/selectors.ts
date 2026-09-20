import { getGameModule } from "../games/registry";
import type { PlayerProgress } from "../types";
import { getPlayerSettings, type GameState } from "./reducer";

/**
 * A player's progress *including* the darts already thrown this turn —
 * i.e. what their progress would be if the turn were committed right now.
 *
 * Committed progress only advances at the end of a turn, but the UI has to
 * reflect a dart the moment it lands: an X01 score ticking down per dart,
 * or Around The Clock moving to the next target mid-turn as soon as the
 * required hits are in (so the third dart is aimed at the right number).
 */
export function livePlayerProgress(
  state: GameState,
  playerId: string,
): PlayerProgress<unknown> | undefined {
  const committed = state.progress[playerId];
  if (!committed || !state.mode || state.winnerId || state.currentTurnDarts.length === 0) return committed;

  if (state.players[state.activePlayerIndex] !== playerId) return committed;

  const module = getGameModule(state.mode);
  const result = module.replayTurn(
    state.turnStartGame,
    state.currentTurnDarts,
    getPlayerSettings(state, module, playerId),
    state.matchContext,
  );

  return {
    dartsThrown: committed.dartsThrown + state.currentTurnDarts.length,
    history: [...committed.history, result.history],
    game: result.game,
  };
}
