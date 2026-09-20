import type { Bed, BoardThrow, Segment } from "../types";

const ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

const CX = 100;
const CY = 100;

// Ring radii as fractions of the outer double wire, from official board
// dimensions (bull 6.35mm / 15.9mm, triple 99-107mm, double 162-170mm of a
// 170mm playing radius). The bull is nudged slightly larger than scale so
// it stays a usable tap target.
const R = 80;
const R_BULL_INNER = R * 0.048;
const R_BULL_OUTER = R * 0.108;
const R_TRIPLE_INNER = R * 0.582;
const R_TRIPLE_OUTER = R * 0.629;
const R_DOUBLE_INNER = R * 0.953;
const R_DOUBLE_OUTER = R;
const R_SURROUND = R * 1.11; // dark ring the numbers sit on
const R_LABELS = R * 1.055;

const WEDGE_DEGREES = 360 / ORDER.length;

function polar(r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

/** Angular span of the wedge at `index`, with 20 centred at the top. */
function wedgeAngles(index: number): [number, number] {
  const center = -90 + index * WEDGE_DEGREES;
  return [center - WEDGE_DEGREES / 2, center + WEDGE_DEGREES / 2];
}

function wedgePath(rInner: number, rOuter: number, startDeg: number, endDeg: number): string {
  const p1 = polar(rOuter, startDeg);
  const p2 = polar(rOuter, endDeg);
  const p3 = polar(rInner, endDeg);
  const p4 = polar(rInner, startDeg);
  return `M ${p1.x} ${p1.y} A ${rOuter} ${rOuter} 0 0 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${rInner} ${rInner} 0 0 0 ${p4.x} ${p4.y} Z`;
}

function makeSegment(number: number, bed: Bed, multiplier: number): Segment {
  const name = bed === "Double" ? `D${number}` : bed === "Triple" ? `T${number}` : `S${number}`;
  return { name, number, bed, multiplier };
}

const BULL_OUTER: Segment = { name: "25", number: 25, bed: "Single", multiplier: 1 };
const BULL_INNER: Segment = { name: "50", number: 25, bed: "Double", multiplier: 2 };

interface WedgeDef {
  key: string;
  d: string;
  fill: string;
  segment: Segment;
}

function buildWedges(): WedgeDef[] {
  const wedges: WedgeDef[] = [];

  ORDER.forEach((number, i) => {
    const [start, end] = wedgeAngles(i);
    // Dark wedges carry red doubles/triples, light wedges green — as on a real board.
    const dark = i % 2 === 0;
    const single = dark ? "#15171c" : "#e8dfc8";
    const accent = dark ? "#c0132b" : "#0f7a3d";

    const rings: Array<[string, number, number, Bed, number, string]> = [
      ["inner", R_BULL_OUTER, R_TRIPLE_INNER, "SingleInner", 1, single],
      ["triple", R_TRIPLE_INNER, R_TRIPLE_OUTER, "Triple", 3, accent],
      ["outer", R_TRIPLE_OUTER, R_DOUBLE_INNER, "SingleOuter", 1, single],
      ["double", R_DOUBLE_INNER, R_DOUBLE_OUTER, "Double", 2, accent],
    ];

    for (const [label, rInner, rOuter, bed, multiplier, fill] of rings) {
      wedges.push({
        key: `${number}-${label}`,
        d: wedgePath(rInner, rOuter, start, end),
        fill,
        segment: makeSegment(number, bed, multiplier),
      });
    }
  });

  return wedges;
}

const WEDGES = buildWedges();

const NUMBER_LABELS = ORDER.map((number, i) => {
  const [start, end] = wedgeAngles(i);
  const pos = polar(R_LABELS, (start + end) / 2);
  return { number, ...pos };
});

/**
 * Board coords are centred on the bull and normalised so 1.0 is the outer
 * double wire, with x pointing right and **y pointing up**. SVG y grows
 * downward, hence the flip — without it markers land in the wrong
 * quadrant. See "Board coordinate convention" in the README.
 */
function throwPosition(t: BoardThrow) {
  return { x: CX + t.coords.x * R_DOUBLE_OUTER, y: CY - t.coords.y * R_DOUBLE_OUTER };
}

interface DartboardProps {
  onSegmentClick?: (segment: Segment) => void;
  highlightNumber?: number | null;
  /** Detected darts currently in the board, drawn as markers. */
  throws?: BoardThrow[];
  interactive?: boolean;
}

export default function Dartboard({
  onSegmentClick,
  highlightNumber = null,
  throws = [],
  interactive = false,
}: DartboardProps) {
  const highlightIndex = highlightNumber != null && highlightNumber !== 25 ? ORDER.indexOf(highlightNumber) : -1;
  const highlightBull = highlightNumber === 25;
  const cursor = interactive ? "pointer" : "default";
  const click = (segment: Segment) => (interactive ? () => onSegmentClick?.(segment) : undefined);

  return (
    <svg className="dartboard" viewBox="0 0 200 200" role="img" aria-label="Dartboard">
      <circle cx={CX} cy={CY} r={R_SURROUND} fill="#0a0c10" />

      {WEDGES.map((w) => (
        <path
          key={w.key}
          d={w.d}
          fill={w.fill}
          stroke="#0a0c10"
          strokeWidth={0.35}
          style={{ cursor }}
          onClick={click(w.segment)}
        />
      ))}

      <circle
        cx={CX}
        cy={CY}
        r={R_BULL_OUTER}
        fill="#0f7a3d"
        stroke="#0a0c10"
        strokeWidth={0.35}
        style={{ cursor }}
        onClick={click(BULL_OUTER)}
      />
      <circle
        cx={CX}
        cy={CY}
        r={R_BULL_INNER}
        fill="#c0132b"
        stroke="#0a0c10"
        strokeWidth={0.35}
        style={{ cursor }}
        onClick={click(BULL_INNER)}
      />

      {highlightIndex >= 0 &&
        (() => {
          const [start, end] = wedgeAngles(highlightIndex);
          const d = wedgePath(R_BULL_OUTER, R_DOUBLE_OUTER, start, end);
          return (
            <g style={{ pointerEvents: "none" }}>
              <path d={d} fill="#ffe14d" opacity={0.3} />
              <path d={d} fill="none" stroke="#ffe14d" strokeWidth={1.1} />
            </g>
          );
        })()}

      {highlightBull && (
        <circle
          cx={CX}
          cy={CY}
          r={R_BULL_OUTER}
          fill="#ffe14d"
          fillOpacity={0.3}
          stroke="#ffe14d"
          strokeWidth={1.1}
          style={{ pointerEvents: "none" }}
        />
      )}

      {throws.map((t, i) => {
        const { x, y } = throwPosition(t);
        return (
          <g key={i} style={{ pointerEvents: "none" }}>
            <circle cx={x} cy={y} r={2.2} fill="#ffffff" stroke="#0a0c10" strokeWidth={0.7} />
            <circle cx={x} cy={y} r={0.8} fill="#0a0c10" />
          </g>
        );
      })}

      {NUMBER_LABELS.map((n) => (
        <text
          key={n.number}
          x={n.x}
          y={n.y}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={7.5}
          fontWeight={700}
          fill="#f4f1e8"
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          {n.number}
        </text>
      ))}
    </svg>
  );
}
