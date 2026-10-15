import { line, type Hex } from './hex';
import { terrainAt } from './state';
import type { GameState } from './types';

/** Clear if no hex strictly between a and b blocks sight. Units never block (arcing shots). */
export function hasLineOfSight(state: GameState, a: Hex, b: Hex): boolean {
  const path = line(a, b);
  for (let i = 1; i < path.length - 1; i++) {
    if (terrainAt(state, path[i])?.blocksLineOfSight) return false;
  }
  return true;
}
