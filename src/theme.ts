/**
 * Ready-made turn themes. A player picks one of these, or sets a custom
 * colour and gets a matching gradient derived from it.
 */
export interface PlayerTheme {
  id: string;
  name: string;
  /** Primary colour: the viewport frame and the active panel. */
  color: string;
  /** Second gradient stop on the active panel. */
  accent: string;
}

export const PLAYER_THEMES: PlayerTheme[] = [
  { id: "ocean", name: "Ocean", color: "#2f6fed", accent: "#38b6f5" },
  { id: "emerald", name: "Emerald", color: "#10a868", accent: "#3ddc84" },
  { id: "amber", name: "Amber", color: "#e2951a", accent: "#ffd166" },
  { id: "crimson", name: "Crimson", color: "#d92d3f", accent: "#ff7a7a" },
  { id: "violet", name: "Violet", color: "#7c3aed", accent: "#c084fc" },
  { id: "magenta", name: "Magenta", color: "#d6247a", accent: "#ff6bb3" },
  { id: "teal", name: "Teal", color: "#0d9488", accent: "#2dd4bf" },
  { id: "tangerine", name: "Tangerine", color: "#ef6a0c", accent: "#ffa053" },
  { id: "lime", name: "Lime", color: "#5f9a0f", accent: "#a3e635" },
  { id: "ice", name: "Ice", color: "#0284c7", accent: "#7dd3fc" },
];

export const DEFAULT_THEME = PLAYER_THEMES[0];

function parseHex(hex: string): [number, number, number] {
  const clean = String(hex).replace("#", "");
  const full = clean.length === 3 ? clean.replace(/./g, (c) => c + c) : clean;
  const value = Number.parseInt(full.slice(0, 6), 16);
  return Number.isNaN(value) ? [80, 80, 80] : [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function toHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[clamp(r), clamp(g), clamp(b)].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

/** Lightens a colour toward white by `amount` (0–1). Used to derive a custom accent. */
export function lighten(hex: string, amount: number): string {
  const [r, g, b] = parseHex(hex);
  return toHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
}

/** Blends `hex` into `base`, `weight` being how much of `hex` survives (0–1). */
export function mix(hex: string, base: string, weight: number): string {
  const [r1, g1, b1] = parseHex(hex);
  const [r2, g2, b2] = parseHex(base);
  const keep = 1 - weight;
  return toHex(r1 * weight + r2 * keep, g1 * weight + g2 * keep, b1 * weight + b2 * keep);
}

/** The app's untinted background colours, used as the base for turn tints. */
const BG_BASE = "#070b16";
const BG_BASE_LIFT = "#0c1220";

/** Black or white, whichever stays readable on top of `hex`. */
export function readableTextColor(hex: string): string {
  const [r, g, b] = parseHex(hex);
  // Rec. 601 luma is good enough for picking between black and white.
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luma > 0.6 ? "#10131a" : "#ffffff";
}

export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Whether a colour matches one of the presets, so the UI can show it as selected. */
export function themeIdForColor(color: string): string | null {
  const match = PLAYER_THEMES.find((theme) => theme.color.toLowerCase() === color.toLowerCase());
  return match?.id ?? null;
}

/**
 * CSS custom properties for the active player's theme. Applied at the app
 * root so the whole UI — including a frame around the viewport — shifts to
 * their colour, which is the point: you can tell whose turn it is from
 * across the room.
 */
export function turnThemeVars(color: string | null, accent?: string | null): Record<string, string> {
  if (!color) return {};
  const shade = accent || lighten(color, 0.25);
  return {
    "--turn-color": color,
    "--turn-accent": shade,
    "--turn-text": readableTextColor(color),
    "--turn-soft": withAlpha(color, 0.16),
    "--turn-glow": withAlpha(color, 0.45),
    // Deep, mostly-dark washes of their colour for the page background.
    // Kept this subtle on purpose: the cards and text sit on top of it and
    // still have to be readable.
    "--turn-bg": mix(color, BG_BASE, 0.14),
    "--turn-bg-lift": mix(shade, BG_BASE_LIFT, 0.22),
    "--turn-panel": mix(color, "#10182a", 0.1),
    "--turn-border": mix(color, "#232f4a", 0.25),
  };
}

export const TURN_THEME_VAR_NAMES = Object.keys(turnThemeVars("#000000"));
