import { BACK_ROW, FRONT_ROW_INFANTRY, RACES } from '../data/races';
import { TERRAIN, TERRAIN_GLYPHS } from '../data/terrain';
import type { MapDef } from '../data/maps';
import { axialToOffset, key, offsetToAxial } from './hex';
import { canAttack, canCounter, computeDamage } from './combat';
import { legalMoves } from './movement';
import { defOf, getUnit, promotionRow, raceOf } from './state';
import type { Action, GameState, RaceId, TerrainId, Unit } from './types';

export function createGame(map: MapDef, races: [RaceId, RaceId]): GameState {
  const rows = map.rows.length;
  const cols = Math.max(...map.rows.map((r) => r.length));
  const tiles: Record<string, TerrainId> = {};
  map.rows.forEach((line, row) => {
    [...line].forEach((ch, col) => {
      const t = TERRAIN_GLYPHS[ch];
      if (!t) throw new Error(`Map ${map.id}: unknown glyph "${ch}" at ${col},${row}`);
      tiles[key(offsetToAxial(col, row))] = t;
    });
  });

  const state: GameState = {
    mapName: map.name,
    cols,
    rows,
    tiles,
    units: [],
    players: races.map((race, i) => ({ race, name: `Player ${i + 1}` })),
    current: 0,
    turn: 1,
    winner: null,
    log: [],
    nextUnitId: 1,
  };

  const center = Math.floor(cols / 2);
  for (let owner = 0; owner < 2; owner++) {
    const race = RACES[races[owner]];
    const backRow = owner === 0 ? rows - 1 : 0;
    const frontRow = owner === 0 ? rows - 2 : 1;
    // Mirror columns for player 2 so both armies face each other symmetrically.
    const colFor = (c: number) => (owner === 0 ? c : cols - 1 - c);
    const place = (role: keyof typeof race.units, col: number, row: number) => {
      const pos = offsetToAxial(colFor(col), row);
      const t = tiles[key(pos)];
      // Deployment hexes must be enterable; flatten anything awkward.
      if (!t || TERRAIN[t].moveCost === Infinity || TERRAIN[t].endsMovement || t === 'mountain') {
        tiles[key(pos)] = 'plains';
      }
      const def = race.units[role];
      state.units.push({
        id: `u${state.nextUnitId++}`,
        defId: def.id,
        owner,
        pos,
        hp: def.maxHp,
        moved: false,
        attacked: false,
      });
    };
    const leaderIdx = BACK_ROW.indexOf('leader');
    BACK_ROW.forEach((role, i) => place(role, center - leaderIdx + i, backRow));
    const half = Math.floor(FRONT_ROW_INFANTRY / 2);
    for (let i = 0; i < FRONT_ROW_INFANTRY; i++) place('infantry', center - half + i, frontRow);
  }

  state.log.push(`Battle of ${map.name}: ${RACES[races[0]].name} vs ${RACES[races[1]].name}.`);
  return state;
}

const label = (u: Unit) => `P${u.owner + 1} ${defOf(u).name}`;

function checkWinner(state: GameState): void {
  for (let p = 0; p < state.players.length; p++) {
    const mine = state.units.filter((u) => u.owner === p);
    const hasLeader = mine.some((u) => defOf(u).role === 'leader');
    if (mine.length === 0 || !hasLeader) {
      state.winner = 1 - p;
      state.log.push(`${state.players[1 - p].name} (${RACES[state.players[1 - p].race].name}) wins!`);
      return;
    }
  }
}

function startTurn(state: GameState): void {
  for (const u of state.units) {
    if (u.owner !== state.current) continue;
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
      checkWinner(state);
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
