import type { GameKind } from "../types";
import { AtcModule } from "./atc";
import { Bobs27Module } from "./bobs27";
import { CricketModule } from "./cricket";
import { GotchaModule } from "./gotcha";
import { ShanghaiModule } from "./shanghai";
import type { GameModule } from "./types";
import { X01Module } from "./x01";

/**
 * Heterogeneous module registry: each game is typed precisely in its own
 * file, and only this lookup boundary is loose. A new module is registered
 * here and its kind is added to GameKind in types.ts.
 */
export type AnyGameModule = GameModule<any, any, any>;

export const GAME_MODULES: Record<GameKind, AnyGameModule> = {
  x01: X01Module,
  atc: AtcModule,
  cricket: CricketModule,
  shanghai: ShanghaiModule,
  gotcha: GotchaModule,
  bobs27: Bobs27Module,
};

export const GAME_LIST: AnyGameModule[] = [
  X01Module,
  AtcModule,
  CricketModule,
  ShanghaiModule,
  GotchaModule,
  Bobs27Module,
];

export function getGameModule(kind: GameKind): AnyGameModule {
  return GAME_MODULES[kind];
}
