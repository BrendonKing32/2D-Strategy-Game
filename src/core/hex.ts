// Axial hex coordinates, pointy-top layout.
// Reference: https://www.redblobgames.com/grids/hexagons/

export interface Hex {
  q: number;
  r: number;
}

export const DIRECTIONS: readonly Hex[] = [
  { q: 1, r: 0 }, // E
  { q: 1, r: -1 }, // NE
  { q: 0, r: -1 }, // NW
  { q: -1, r: 0 }, // W
  { q: -1, r: 1 }, // SW
  { q: 0, r: 1 }, // SE
];

export const hex = (q: number, r: number): Hex => ({ q, r });

export const key = (h: Hex): string => `${h.q},${h.r}`;

export function parseKey(k: string): Hex {
  const [q, r] = k.split(',').map(Number);
  return { q, r };
}

export const add = (a: Hex, b: Hex): Hex => ({ q: a.q + b.q, r: a.r + b.r });
export const scale = (a: Hex, k: number): Hex => ({ q: a.q * k, r: a.r * k });
export const equals = (a: Hex, b: Hex): boolean => a.q === b.q && a.r === b.r;

export function distance(a: Hex, b: Hex): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

export const neighbor = (h: Hex, dir: number): Hex => add(h, DIRECTIONS[dir]);
export const neighbors = (h: Hex): Hex[] => DIRECTIONS.map((d) => add(h, d));

/** All hexes at exactly `radius` steps from `center`. */
export function ring(center: Hex, radius: number): Hex[] {
  if (radius === 0) return [center];
  const out: Hex[] = [];
  let cur = add(center, scale(DIRECTIONS[4], radius));
  for (let side = 0; side < 6; side++) {
    for (let i = 0; i < radius; i++) {
      out.push(cur);
      cur = neighbor(cur, side);
    }
  }
  return out;
}

/** Round fractional axial coordinates to the nearest hex. */
export function round(q: number, r: number): Hex {
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  const rs = Math.round(s);
  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  // Normalise -0 to 0 so keys are stable.
  return { q: rq + 0, r: rr + 0 };
}

/** Hexes on the straight line from a to b, inclusive of both ends. */
export function line(a: Hex, b: Hex): Hex[] {
  const n = distance(a, b);
  if (n === 0) return [a];
  const out: Hex[] = [];
  // Nudge to avoid ties landing exactly on hex edges.
  const aq = a.q + 1e-6;
  const ar = a.r + 1e-6;
  const bq = b.q + 1e-6;
  const br = b.r + 1e-6;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push(round(aq + (bq - aq) * t, ar + (br - ar) * t));
  }
  return out;
}

const SQRT3 = Math.sqrt(3);

export function hexToPixel(h: Hex, size: number): { x: number; y: number } {
  return { x: size * SQRT3 * (h.q + h.r / 2), y: size * 1.5 * h.r };
}

export function pixelToHex(x: number, y: number, size: number): Hex {
  const q = ((SQRT3 / 3) * x - y / 3) / size;
  const r = ((2 / 3) * y) / size;
  return round(q, r);
}

export function hexCorners(cx: number, cy: number, size: number): { x: number; y: number }[] {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    pts.push({ x: cx + size * Math.cos(angle), y: cy + size * Math.sin(angle) });
  }
  return pts;
}

// "odd-r" offset rows <-> axial. Maps are authored as rectangular grids of rows.
export function offsetToAxial(col: number, row: number): Hex {
  return { q: col - (row - (row & 1)) / 2, r: row };
}

export function axialToOffset(h: Hex): { col: number; row: number } {
  return { col: h.q + (h.r - (h.r & 1)) / 2, row: h.r };
}
