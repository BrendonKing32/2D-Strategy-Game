import type { Hex } from './hex';

export type TerrainId =
  | 'plains'
  | 'forest'
  | 'hills'
  | 'mountain'
  | 'water'
  | 'swamp'
  | 'road'
  | 'village'
  | 'base';

export interface TerrainDef {
  id: TerrainId;
  name: string;
  /** Movement points to enter. Infinity = impassable. */
  moveCost: number;
  /** Fraction of incoming damage removed (negative = more damage taken). */
  defense: number;
  blocksLineOfSight: boolean;
  /** Entering this hex ends the unit's movement. */
  endsMovement?: boolean;
  /** HP restored at the start of the occupant's turn. */
  heal?: number;
  /** Ranged units standing here gain this much max range. */
  rangeBonus?: number;
  color: string;
  description: string;
}

export type RaceId = 'humans' | 'elves' | 'orcs';

/** Chess-like roles every race fields. */
export type UnitRole = 'leader' | 'champion' | 'heavy' | 'cavalry' | 'ranged' | 'infantry';

export type UnitAbility =
  /** +2 defense while adjacent to an allied unit. */
  | 'phalanx'
  /** Adjacent allies deal +15% damage. */
  | 'command';

export type RaceAbility =
  /** +25% damage while at or below half HP. */
  | 'rage';

/**
 * How a unit moves. Any combination may be present; the unit can use whichever
 * pattern it likes each turn (e.g. a Champion walks OR slides along a line).
 */
export interface Movement {
  /** Pathfinding move with this many movement points (terrain costs apply). */
  walk?: number;
  /** Slide in one of the six hex directions, spending terrain cost per step, never passing units. */
  line?: number;
  /** Leap to any hex exactly min..max away, ignoring blockers and zone of control. */
  jump?: [number, number];
  /** Cannot step in the two "backward" directions (pawn-like). */
  forwardOnly?: boolean;
}

export interface UnitDef {
  id: string;
  race: RaceId;
  role: UnitRole;
  name: string;
  maxHp: number;
  attack: number;
  defense: number;
  movement: Movement;
  /** Attack range [min, max] in hexes. Range 1 = melee. */
  range: [number, number];
  /** Terrain this unit can never enter. */
  impassable?: TerrainId[];
  abilities?: UnitAbility[];
  /** Gold to recruit at a base. Leaders cannot be recruited. */
  cost: number;
  description: string;
}

export interface RaceDef {
  id: RaceId;
  name: string;
  color: string;
  description: string;
  terrainCost?: Partial<Record<TerrainId, number>>;
  terrainDefenseBonus?: Partial<Record<TerrainId, number>>;
  healBonus?: number;
  abilities?: RaceAbility[];
  units: Record<UnitRole, UnitDef>;
}

export interface Unit {
  id: string;
  defId: string;
  owner: number;
  pos: Hex;
  hp: number;
  moved: boolean;
  attacked: boolean;
}

export interface PlayerState {
  race: RaceId;
  name: string;
  gold: number;
}

export interface BaseState {
  /** Player index, or null while neutral. */
  owner: number | null;
}

export interface GameState {
  mapName: string;
  cols: number;
  rows: number;
  /** Terrain by hex key "q,r". */
  tiles: Record<string, TerrainId>;
  units: Unit[];
  /** Bases by hex key "q,r". */
  bases: Record<string, BaseState>;
  /** Base keys that have already recruited this turn. */
  recruitedThisTurn: string[];
  players: PlayerState[];
  current: number;
  turn: number;
  winner: number | null;
  log: string[];
  nextUnitId: number;
}

export type Action =
  | { type: 'move'; unitId: string; to: Hex }
  | { type: 'attack'; unitId: string; targetId: string }
  | { type: 'recruit'; at: Hex; role: UnitRole }
  | { type: 'endTurn' };
