import type { GameEventKind } from "./game/reducer";

export type SoundThemeId = "classic" | "arcade" | "punch" | "crystal" | "bloom";

export interface SoundThemeOption {
  id: SoundThemeId;
  name: string;
  description: string;
  files: Record<GameEventKind, string>;
}

export const DEFAULT_SOUND_THEME: SoundThemeId = "classic";

export const SOUND_THEMES: SoundThemeOption[] = [
  {
    id: "classic",
    name: "Classic",
    description: "The original board-room tones.",
    files: {
      hit: "/sounds/hit.wav",
      miss: "/sounds/miss.wav",
      bust: "/sounds/bust.wav",
      advance: "/sounds/advance.wav",
      turn: "/sounds/turn.wav",
      win: "/sounds/win.wav",
    },
  },
  {
    id: "arcade",
    name: "Arcade Pop",
    description: "Bright, punchy coin-op hits.",
    files: {
      hit: "/sounds/arcade/hit.ogg",
      miss: "/sounds/arcade/miss.ogg",
      bust: "/sounds/arcade/bust.ogg",
      advance: "/sounds/arcade/advance.ogg",
      turn: "/sounds/arcade/turn.ogg",
      win: "/sounds/arcade/win.ogg",
    },
  },
  {
    id: "punch",
    name: "Punchy",
    description: "Heavy, satisfying impact sounds.",
    files: {
      hit: "/sounds/punch/hit.ogg",
      miss: "/sounds/punch/miss.ogg",
      bust: "/sounds/punch/bust.ogg",
      advance: "/sounds/punch/advance.ogg",
      turn: "/sounds/punch/turn.ogg",
      win: "/sounds/punch/win.ogg",
    },
  },
  {
    id: "crystal",
    name: "Crystal",
    description: "Sharp glassy tones with a glossy finish.",
    files: {
      hit: "/sounds/crystal/hit.ogg",
      miss: "/sounds/crystal/miss.ogg",
      bust: "/sounds/crystal/bust.ogg",
      advance: "/sounds/crystal/advance.ogg",
      turn: "/sounds/crystal/turn.ogg",
      win: "/sounds/crystal/win.ogg",
    },
  },
  {
    id: "bloom",
    name: "Bloom",
    description: "A softer, brighter celebration profile.",
    files: {
      hit: "/sounds/bloom/hit.ogg",
      miss: "/sounds/bloom/miss.ogg",
      bust: "/sounds/bloom/bust.ogg",
      advance: "/sounds/bloom/advance.ogg",
      turn: "/sounds/bloom/turn.ogg",
      win: "/sounds/bloom/win.ogg",
    },
  },
];

export const SOUND_THEME_BY_ID = Object.fromEntries(SOUND_THEMES.map((theme) => [theme.id, theme])) as Record<
  SoundThemeId,
  SoundThemeOption
>;

export function resolveSoundTheme(value: unknown, fallback: string = DEFAULT_SOUND_THEME): string {
  if (typeof value !== "string") return fallback;
  return value in SOUND_THEME_BY_ID ? value : fallback;
}
