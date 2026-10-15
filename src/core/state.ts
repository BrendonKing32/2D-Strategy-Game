import { RACES, unitDef } from '../data/races';
import { TERRAIN } from '../data/terrain';
import { equals, key, neighbors, type Hex } from './hex';
import type { GameState, RaceDef, TerrainDef, Unit, UnitDef } from './types';

export const defOf = (unit: Unit): UnitDef => unitDef(unit.defId);

export const raceOf = (state: GameState, unit: Unit): RaceDef => RACES[state.players[unit.owner].race];

export function unitAt(state: GameState, h: Hex): Unit | undefined {
  return state.units.find((u) => equals(u.pos, h));
}

export function getUnit(state: GameState, id: string): Unit | undefined {
  return state.units.find((u) => u.id === id);
}

export function terrainAt(state: GameState, h: Hex): TerrainDef | undefined {
  const t = state.tiles[key(h)];
  return t ? TERRAIN[t] : undefined;
}

export function adjacentUnits(state: GameState, h: Hex): Unit[] {
  return neighbors(h)
    .map((n) => unitAt(state, n))
    .filter((u): u is Unit => u !== undefined);
}

/** Is `h` adjacent to an enemy of `owner`? (zone of control) */
export function inEnemyZoc(state: GameState, h: Hex, owner: number): boolean {
  return adjacentUnits(state, h).some((u) => u.owner !== owner);
}

/** The row a player's infantry must reach to promote. */
export function promotionRow(state: GameState, owner: number): number {
  return owner === 0 ? 0 : state.rows - 1;
}
