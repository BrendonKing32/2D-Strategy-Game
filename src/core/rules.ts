import { INCOME_PER_BASE, RACES, RECRUITABLE, STARTING_GOLD } from '../data/races';
import { BASE_GLYPHS, TERRAIN, TERRAIN_GLYPHS } from '../data/terrain';
import type { MapDef } from '../data/maps';
import { axialToOffset, key, offsetToAxial, type Hex } from './hex';
import { canAttack, canCounter, computeDamage } from './combat';
import { legalMoves } from './movement';
import { defOf, getUnit, promotionRow, raceOf, unitAt } from './state';
import type { Action, BaseState, GameState, RaceId, TerrainId, Unit, UnitDef, UnitRole } from './types';

export function createGame(map: MapDef, races: [RaceId, RaceId]): GameState {
  const rows = map.rows.length;
  const cols = Math.max(...map.rows.map((r) => r.length));
  const tiles: Record<string, TerrainId> = {};
  const bases: Record<string, BaseState> = {};
  const homes: Hex[] = [];
  map.rows.forEach((line, row) => {
    [...line].forEach((ch, col) => {
      const t = TERRAIN_GLYPHS[ch];
      if (!t) throw new Error(`Map ${map.id}: unknown glyph "${ch}" at ${col},${row}`);
      const h = offsetToAxial(col, row);
      tiles[key(h)] = t;
      if (ch in BASE_GLYPHS) {
        const owner = BASE_GLYPHS[ch];
        bases[key(h)] = { owner };
        if (owner !== null) homes[owner] = h;
      }
    });
  });
  for (const p of [0, 1]) {
    if (!homes[p]) throw new Error(`Map ${map.id}: missing home base for player ${p + 1}`);
  }

  const state: GameState = {
    mapName: map.name,
    cols,
    rows,
    tiles,
    units: [],
    bases,
    recruitedThisTurn: [],
    players: races.map((race, i) => ({ race, name: `Player ${i + 1}`, gold: STARTING_GOLD })),
    current: 0,
    turn: 1,
    winner: null,
    log: [],
    nextUnitId: 1,
  };

  // Each Leader starts one row in front of its home base, keeping the base free for recruiting.
  for (let owner = 0; owner < 2; owner++) {
    const { col, row } = axialToOffset(homes[owner]);
    const pos = offsetToAxial(col, owner === 0 ? row - 1 : row + 1);
    const t = tiles[key(pos)];
    if (!t || TERRAIN[t].moveCost === Infinity || TERRAIN[t].endsMovement || t === 'mountain') {
      tiles[key(pos)] = 'plains';
    }
    spawn(state, owner, RACES[races[owner]].units.leader, pos);
  }

  state.log.push(`Battle of ${map.name}: ${RACES[races[0]].name} vs ${RACES[races[1]].name}.`);
  startTurn(state);
  return state;
}

function spawn(state: GameState, owner: number, def: UnitDef, pos: Hex): Unit {
  const unit: Unit = {
    id: `u${state.nextUnitId++}`,
    defId: def.id,
    owner,
    pos,
    hp: def.maxHp,
    moved: false,
    attacked: false,
  };
  state.units.push(unit);
  return unit;
}

const label = (u: Unit) => `P${u.owner + 1} ${defOf(u).name}`;

export function basesOwnedBy(state: GameState, player: number): string[] {
  return Object.keys(state.bases).filter((k) => state.bases[k].owner === player);
}

export function incomeFor(state: GameState, player: number): number {
  return basesOwnedBy(state, player).length * INCOME_PER_BASE;
}

/** Why the current player can't recruit at `h`, or null if they can. */
export function recruitBlocker(state: GameState, h: Hex): string | null {
  const k = key(h);
  const base = state.bases[k];
  if (state.winner !== null) return 'The game is over';
  if (!base || base.owner !== state.current) return 'Not your base';
  if (unitAt(state, h)) return 'The base is occupied';
  if (state.recruitedThisTurn.includes(k)) return 'This base already recruited this turn';
  return null;
}

export const canRecruitAt = (state: GameState, h: Hex): boolean => recruitBlocker(state, h) === null;

/** A unit standing on a base it doesn't own, which it will capture at the start of its owner's turn. */
export function isCapturing(state: GameState, unit: Unit): boolean {
  const base = state.bases[key(unit.pos)];
  return base !== undefined && base.owner !== unit.owner;
}

function checkWinner(state: GameState): void {
  for (let p = 0; p < state.players.length; p++) {
    if (basesOwnedBy(state, p).length === 0) {
      state.winner = 1 - p;
      state.log.push(`${state.players[1 - p].name} (${RACES[state.players[1 - p].race].name}) wins!`);
      return;
    }
  }
}

function startTurn(state: GameState): void {
  const me = state.current;
  for (const u of state.units) {
    if (u.owner !== me || !isCapturing(state, u)) continue;
    const base = state.bases[key(u.pos)];
    const from = base.owner === null ? 'a neutral base' : `P${base.owner + 1}'s base`;
    base.owner = me;
    state.log.push(`${label(u)} captures ${from}.`);
  }
  checkWinner(state);
  if (state.winner !== null) return;

  const income = incomeFor(state, me);
  state.players[me].gold += income;
  state.log.push(`${state.players[me].name} collects ${income} gold.`);
  state.recruitedThisTurn = [];

  for (const u of state.units) {
    if (u.owner !== me) continue;
    u.moved = false;
    u.attacked = false;
    const heal = TERRAIN[state.tiles[key(u.pos)]].heal;
    if (heal) {
      const max = defOf(u).maxHp;
      const amount = Math.min(max - u.hp, heal + (raceOf(state, u).healBonus ?? 0));
      if (amount > 0) {
        u.hp += amount;
        state.log.push(`${label(u)} heals ${amount}.`);
      }
    }
  }
}

function promoteIfEligible(state: GameState, unit: Unit): void {
  const def = defOf(unit);
  if (def.role !== 'infantry') return;
  if (axialToOffset(unit.pos).row !== promotionRow(state, unit.owner)) return;
  const champion = raceOf(state, unit).units.champion;
  unit.defId = champion.id;
  unit.hp = champion.maxHp;
  state.log.push(`${def.name} is promoted to ${champion.name}!`);
}

/** Validate and apply an action, returning a new state. Throws on illegal actions. */
export function applyAction(prev: GameState, action: Action): GameState {
  if (prev.winner !== null) throw new Error('Game is over');
  const state = structuredClone(prev);

  switch (action.type) {
    case 'move': {
      const unit = getUnit(state, action.unitId);
      if (!unit) throw new Error('No such unit');
      if (!legalMoves(state, unit).has(key(action.to))) throw new Error('Illegal move');
      unit.pos = action.to;
      unit.moved = true;
      promoteIfEligible(state, unit);
      break;
    }
    case 'attack': {
      const attacker = getUnit(state, action.unitId);
      const target = getUnit(state, action.targetId);
      if (!attacker || !target) throw new Error('No such unit');
      if (attacker.owner !== state.current || attacker.attacked) throw new Error('Unit cannot attack');
      if (!canAttack(state, attacker, target)) throw new Error('Target out of range');

      const hit = computeDamage(state, attacker, target).damage;
      target.hp -= hit;
      state.log.push(`${label(attacker)} hits ${label(target)} for ${hit}.`);
      if (target.hp <= 0) {
        state.log.push(`${label(target)} is slain.`);
      } else if (canCounter(state, attacker, target)) {
        const back = computeDamage(state, target, attacker, true).damage;
        attacker.hp -= back;
        state.log.push(`${label(target)} strikes back for ${back}.`);
        if (attacker.hp <= 0) state.log.push(`${label(attacker)} is slain.`);
      }
      attacker.attacked = true;
      attacker.moved = true;
      state.units = state.units.filter((u) => u.hp > 0);
      break;
    }
    case 'recruit': {
      const blocker = recruitBlocker(state, action.at);
      if (blocker) throw new Error(blocker);
      if (!RECRUITABLE.includes(action.role)) throw new Error('That unit cannot be recruited');
      const player = state.players[state.current];
      const def = RACES[player.race].units[action.role];
      if (player.gold < def.cost) throw new Error(`Not enough gold (${def.cost} needed)`);
      player.gold -= def.cost;
      const unit = spawn(state, state.current, def, action.at);
      // Fresh recruits muster this turn and act from the next.
      unit.moved = true;
      unit.attacked = true;
      state.recruitedThisTurn.push(key(action.at));
      state.log.push(`${player.name} recruits a ${def.name} for ${def.cost} gold.`);
      break;
    }
    case 'endTurn': {
      state.current = (state.current + 1) % state.players.length;
      if (state.current === 0) state.turn++;
      startTurn(state);
      break;
    }
  }
  return state;
}

/** Units of the current player that can still do something. */
export function idleUnits(state: GameState): Unit[] {
  return state.units.filter((u) => u.owner === state.current && !u.attacked);
}

/** Roles the current player can afford right now. */
export function affordableRoles(state: GameState): UnitRole[] {
  const player = state.players[state.current];
  return RECRUITABLE.filter((r) => RACES[player.race].units[r].cost <= player.gold);
}
