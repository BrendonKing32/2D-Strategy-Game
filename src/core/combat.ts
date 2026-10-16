import { distance } from './hex';
import { hasLineOfSight } from './los';
import { adjacentUnits, defOf, raceOf, terrainAt } from './state';
import type { GameState, Unit } from './types';

/** Retaliation strikes deal this fraction of a normal hit. */
export const COUNTER_FACTOR = 0.5;
export const FLANK_BONUS = 0.1;
export const COMMAND_BONUS = 0.15;
export const RAGE_BONUS = 0.25;
export const PHALANX_DEFENSE = 2;

/** Effective [min, max] attack range, including high-ground bonus for ranged units. */
export function attackRange(state: GameState, unit: Unit): [number, number] {
  const [min, max] = defOf(unit).range;
  const bonus = max > 1 ? terrainAt(state, unit.pos)?.rangeBonus ?? 0 : 0;
  return [min, max + bonus];
}

export function canAttack(state: GameState, attacker: Unit, target: Unit): boolean {
  if (attacker.owner === target.owner) return false;
  const d = distance(attacker.pos, target.pos);
  const [min, max] = attackRange(state, attacker);
  if (d < min || d > max) return false;
  return d === 1 || hasLineOfSight(state, attacker.pos, target.pos);
}

/** Defender strikes back only against adjacent (melee) attacks it can reach. */
export function canCounter(state: GameState, attacker: Unit, defender: Unit): boolean {
  return distance(attacker.pos, defender.pos) === 1 && attackRange(state, defender)[0] <= 1;
}

export function terrainDefense(state: GameState, unit: Unit): number {
  const terrain = terrainAt(state, unit.pos);
  if (!terrain) return 0;
  return terrain.defense + (raceOf(state, unit).terrainDefenseBonus?.[terrain.id] ?? 0);
}

export interface DamageBreakdown {
  damage: number;
  multiplier: number;
  terrainDefense: number;
  armor: number;
  notes: string[];
}

export function computeDamage(
  state: GameState,
  attacker: Unit,
  defender: Unit,
  counter = false,
): DamageBreakdown {
  const aDef = defOf(attacker);
  const dDef = defOf(defender);
  const notes: string[] = [];
  let multiplier = 1;

  if (raceOf(state, attacker).abilities?.includes('rage') && attacker.hp * 2 <= aDef.maxHp) {
    multiplier += RAGE_BONUS;
    notes.push('rage');
  }
  const besideAttacker = adjacentUnits(state, attacker.pos);
  if (
    besideAttacker.some(
      (u) => u.owner === attacker.owner && u.id !== attacker.id && defOf(u).abilities?.includes('command'),
    )
  ) {
    multiplier += COMMAND_BONUS;
    notes.push('command');
  }
  if (!counter) {
    const flankers = adjacentUnits(state, defender.pos).filter(
      (u) => u.owner === attacker.owner && u.id !== attacker.id,
    ).length;
    if (flankers > 0) {
      multiplier += FLANK_BONUS * flankers;
      notes.push(`flank x${flankers}`);
    }
  } else {
    multiplier *= COUNTER_FACTOR;
  }

  let armor = dDef.defense;
  if (
    dDef.abilities?.includes('phalanx') &&
    adjacentUnits(state, defender.pos).some((u) => u.owner === defender.owner)
  ) {
    armor += PHALANX_DEFENSE;
    notes.push('phalanx');
  }

  const tDef = terrainDefense(state, defender);
  const damage = Math.max(1, Math.round(aDef.attack * multiplier * (1 - tDef) - armor));
  return { damage, multiplier, terrainDefense: tDef, armor, notes };
}

export interface AttackPreview {
  damage: number;
  kills: boolean;
  counter: number;
  counterKills: boolean;
  notes: string[];
}

export function previewAttack(state: GameState, attacker: Unit, defender: Unit): AttackPreview {
  const hit = computeDamage(state, attacker, defender);
  const kills = hit.damage >= defender.hp;
  let counter = 0;
  if (!kills && canCounter(state, attacker, defender)) {
    counter = computeDamage(state, defender, attacker, true).damage;
  }
  return { damage: hit.damage, kills, counter, counterKills: counter >= attacker.hp, notes: hit.notes };
}
