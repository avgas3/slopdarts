import type { Segment } from "../types";

/** Point value of a single dart, 0 for a miss ("Outside"). */
export function segmentValue(seg: Segment): number {
  if (seg.bed === "Outside") return 0;
  if (seg.name === "50") return 50;
  if (seg.name === "25") return 25;
  return (seg.number ?? 0) * seg.multiplier;
}

export function isBullSegment(seg: Segment): boolean {
  return seg.name === "25" || seg.name === "50";
}

export function isDoubleSegment(seg: Segment): boolean {
  return seg.bed === "Double" || seg.name === "50";
}

/** Short label for a segment, for displaying a thrown dart (e.g. "T20", "BULL", "MISS"). */
export function segmentLabel(seg: Segment): string {
  if (seg.bed === "Outside") return "MISS";
  if (seg.name === "50") return "BULL";
  return seg.name;
}
