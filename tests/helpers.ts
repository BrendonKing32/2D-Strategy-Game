import { key, offsetToAxial, type Hex } from '../src/core/hex';
import type { GameState, RaceId, TerrainId, Unit } from '../src/core/types';
import { RACES } from '../src/data/races';
import type { UnitRole } from '../src/core/types';

/** Blank all-plains board with no units, for focused rule tests. */
export function emptyState(cols = 9, rows = 9, races: [RaceId, RaceId] = ['humans', 'orcs']): GameState {
  const tiles: Record<string, TerrainId> = {};
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) tiles[key(offsetToAxial(col, row))] = 'plains';
  }
  return {
    mapName: 'test',
    cols,
    rows,
    tiles,
    units: [],
    bases: {},
    recruitedThisTurn: [],
    players: races.map((race, i) => ({ race, name: `Player ${i + 1}`, gold: 0 })),
    current: 0,
    turn: 1,
    winner: null,
    log: [],
    nextUnitId: 1,
  };
}

export function addUnit(state: GameState, owner: number, role: UnitRole, pos: Hex, hp?: number): Unit {
  const def = RACES[state.players[owner].race].units[role];
  const unit: Unit = {
    id: `u${state.nextUnitId++}`,
    defId: def.id,
    owner,
    pos,
    hp: hp ?? def.maxHp,
    moved: false,
    attacked: false,
  };
  state.units.push(unit);
  return unit;
}

export const at = (col: number, row: number): Hex => offsetToAxial(col, row);
export function addBase(state: GameState, h: Hex, owner: number | null): void {
  state.tiles[key(h)] = 'base';
  state.bases[key(h)] = { owner };
}

export const setTerrain = (s: GameState, h: Hex, t: TerrainId) => {
  s.tiles[key(h)] = t;
};
