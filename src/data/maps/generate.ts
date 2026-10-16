import { TERRAIN_GLYPHS } from '../terrain';
import type { MapDef } from './index';

const COLS = 13;
const ROWS = 11;

/** Small deterministic PRNG so a seed always produces the same map. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function smoothNoise(rand: () => number): number[][] {
  const raw = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, rand));
  // Two box-blur passes give blobby, natural-looking regions.
  let grid = raw;
  for (let pass = 0; pass < 2; pass++) {
    grid = grid.map((row, r) =>
      row.map((_, c) => {
        let sum = 0;
        let n = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const v = grid[r + dr]?.[c + dc];
            if (v !== undefined) {
              sum += v;
              n++;
            }
          }
        }
        return sum / n;
      }),
    );
  }
  // Stretch back to roughly 0..1 since blurring compresses the range.
  const flat = grid.flat();
  const min = Math.min(...flat);
  const max = Math.max(...flat);
  return grid.map((row) => row.map((v) => (v - min) / (max - min || 1)));
}

function pick(elev: number, moist: number, rand: () => number): string {
  if (elev > 0.86) return 'm';
  if (elev > 0.68) return 'h';
  if (elev < 0.1) return '~';
  if (elev < 0.22 && moist > 0.55) return 's';
  if (moist > 0.62) return 'f';
  if (rand() < 0.04) return 'v';
  return '.';
}

/** True if both home bases and every neutral base are connected over land. */
function isConnected(rows: string[]): boolean {
  const passable = (r: number, c: number) => rows[r]?.[c] !== undefined && TERRAIN_GLYPHS[rows[r][c]] !== 'water';
  const seen = new Set<string>();
  const stack: [number, number][] = [[ROWS - 1, Math.floor(COLS / 2)]];
  while (stack.length) {
    const [r, c] = stack.pop()!;
    const k = `${r},${c}`;
    if (seen.has(k) || !passable(r, c)) continue;
    seen.add(k);
    // odd-r offset neighbours
    const odd = r & 1;
    const deltas = odd
      ? [[0, 1], [0, -1], [-1, 0], [-1, 1], [1, 0], [1, 1]]
      : [[0, 1], [0, -1], [-1, -1], [-1, 0], [1, -1], [1, 0]];
    for (const [dr, dc] of deltas) stack.push([r + dr, c + dc]);
  }
  if (!seen.has(`0,${Math.floor(COLS / 2)}`)) return false;
  return rows.every((line, r) => [...line].every((ch, c) => ch !== 'B' || seen.has(`${r},${c}`)));
}

const NEUTRAL_PAIRS = 3;

/** Pick neutral base sites in the top half, spread apart, on open ground. */
function placeBases(grid: string[][], rand: () => number): void {
  const mid = Math.floor(ROWS / 2);
  const candidates: [number, number][] = [];
  for (let r = 2; r <= mid; r++) {
    for (let c = 0; c < COLS; c++) {
      if (r === mid && c >= COLS / 2) continue;
      if ('.=vfh'.includes(grid[r][c])) candidates.push([r, c]);
    }
  }
  const chosen: [number, number][] = [];
  while (chosen.length < NEUTRAL_PAIRS && candidates.length) {
    const [r, c] = candidates.splice(Math.floor(rand() * candidates.length), 1)[0];
    const farEnough = chosen.every(([cr, cc]) => Math.abs(cr - r) + Math.abs(cc - c) >= 4);
    // The mirrored copy must not land too close to the original (relevant on the middle row).
    const mirrorFar = Math.abs(ROWS - 1 - r - r) + Math.abs(COLS - 1 - c - c) >= 4;
    if (farEnough && mirrorFar) chosen.push([r, c]);
  }
  for (const [r, c] of chosen) {
    grid[r][c] = 'B';
    grid[ROWS - 1 - r][COLS - 1 - c] = 'B';
  }
}

/**
 * Generate a random but fair map: the top half is mirrored (rotated 180°) onto
 * the bottom half so both sides face the same terrain.
 */
export function generateMap(seed: number): MapDef {
  for (let attempt = 0; attempt < 50; attempt++) {
    const rand = mulberry32(seed + attempt * 7919);
    const elev = smoothNoise(rand);
    const moist = smoothNoise(rand);
    const grid: string[][] = Array.from({ length: ROWS }, () => Array(COLS).fill('.'));
    const mid = Math.floor(ROWS / 2);
    for (let r = 2; r <= mid; r++) {
      for (let c = 0; c < COLS; c++) {
        if (r === mid && c > COLS / 2) continue;
        const t = pick(elev[r][c], moist[r][c], rand);
        grid[r][c] = t;
        grid[ROWS - 1 - r][COLS - 1 - c] = t;
      }
    }
    placeBases(grid, rand);
    grid[0][Math.floor(COLS / 2)] = '2';
    grid[ROWS - 1][Math.floor(COLS / 2)] = '1';
    const rows = grid.map((row) => row.join(''));
    if (isConnected(rows)) {
      return {
        id: 'random',
        name: `Random #${seed}`,
        description: 'Procedurally generated, mirrored for fairness.',
        rows,
      };
    }
  }
  throw new Error('Could not generate a connected map');
}
