import { TERRAIN } from '../data/terrain';
import { DIRECTIONS, key, neighbor, ring, type Hex } from './hex';
import { defOf, inEnemyZoc, raceOf, unitAt } from './state';
import type { GameState, Unit } from './types';

/**
 * Directions a player's units may not step in when `forwardOnly`.
 * Player 0 advances up the screen (towards r = 0), player 1 down.
 */
export function backwardDirections(owner: number): number[] {
  // DIRECTIONS indices: 0 E, 1 NE, 2 NW, 3 W, 4 SW, 5 SE
  return owner === 0 ? [4, 5] : [1, 2];
}

/** Movement points needed for `unit` to step from `from` into `to`. Infinity if impassable. */
export function stepCost(state: GameState, unit: Unit, from: Hex, to: Hex): number {
  const t = state.tiles[key(to)];
  if (!t) return Infinity;
  const def = defOf(unit);
  if (def.impassable?.includes(t)) return Infinity;
  if (t === 'road' && state.tiles[key(from)] === 'road') return 0.5;
  return raceOf(state, unit).terrainCost?.[t] ?? TERRAIN[t].moveCost;
}

function stopsHere(state: GameState, unit: Unit, h: Hex): boolean {
  const t = state.tiles[key(h)];
  return (t !== undefined && TERRAIN[t].endsMovement === true) || inEnemyZoc(state, h, unit.owner);
}

/** Dijkstra flood fill. Allies may be passed through, enemies block; ZoC and swamps stop movement. */
function walkMoves(state: GameState, unit: Unit, points: number, forwardOnly: boolean): Set<string> {
  const banned = forwardOnly ? backwardDirections(unit.owner) : [];
  const best = new Map<string, number>([[key(unit.pos), 0]]);
  const frontier: { h: Hex; cost: number }[] = [{ h: unit.pos, cost: 0 }];
  const result = new Set<string>();
  while (frontier.length) {
    frontier.sort((a, b) => a.cost - b.cost);
    const { h, cost } = frontier.shift()!;
    if (cost > (best.get(key(h)) ?? Infinity)) continue;
    const isStart = cost === 0;
    if (!isStart) {
      if (!unitAt(state, h)) result.add(key(h));
      if (stopsHere(state, unit, h)) continue;
    }
    for (let d = 0; d < 6; d++) {
      if (banned.includes(d)) continue;
      const n = neighbor(h, d);
      const nc = cost + stepCost(state, unit, h, n);
      if (nc > points) continue;
      const occ = unitAt(state, n);
      if (occ && occ.owner !== unit.owner) continue;
      if (nc < (best.get(key(n)) ?? Infinity)) {
        best.set(key(n), nc);
        frontier.push({ h: n, cost: nc });
      }
    }
  }
  return result;
}

/** Rook-like slide along the six hex axes; any unit blocks the line. */
function lineMoves(state: GameState, unit: Unit, points: number, forwardOnly: boolean): Set<string> {
  const banned = forwardOnly ? backwardDirections(unit.owner) : [];
  const result = new Set<string>();
  for (let d = 0; d < DIRECTIONS.length; d++) {
    if (banned.includes(d)) continue;
    let cur = unit.pos;
    let spent = 0;
    for (;;) {
      const next = neighbor(cur, d);
      spent += stepCost(state, unit, cur, next);
      if (spent > points || unitAt(state, next)) break;
      result.add(key(next));
      if (stopsHere(state, unit, next)) break;
      cur = next;
    }
  }
  return result;
}

/** Knight-like leap: any free, enterable hex at an exact distance. Ignores blockers and ZoC. */
function jumpMoves(state: GameState, unit: Unit, [min, max]: [number, number]): Set<string> {
  const result = new Set<string>();
  for (let d = min; d <= max; d++) {
    for (const h of ring(unit.pos, d)) {
      if (unitAt(state, h)) continue;
      if (stepCost(state, unit, h, h) === Infinity) continue;
      result.add(key(h));
    }
  }
  return result;
}

/** Every hex key the unit could legally move to right now. */
export function legalMoves(state: GameState, unit: Unit): Set<string> {
  if (unit.moved || unit.attacked || unit.owner !== state.current || state.winner !== null) {
    return new Set();
  }
  const m = defOf(unit).movement;
  const out = new Set<string>();
  const forward = m.forwardOnly ?? false;
  if (m.walk) walkMoves(state, unit, m.walk, forward).forEach((k) => out.add(k));
  if (m.line) lineMoves(state, unit, m.line, forward).forEach((k) => out.add(k));
  if (m.jump) jumpMoves(state, unit, m.jump).forEach((k) => out.add(k));
  return out;
}
