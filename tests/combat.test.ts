import { describe, expect, it } from 'vitest';
import { attackRange, canAttack, computeDamage, previewAttack } from '../src/core/combat';
import { addUnit, at, emptyState, setTerrain } from './helpers';

describe('combat', () => {
  it('computes base damage as attack minus armor', () => {
    const s = emptyState();
    const a = addUnit(s, 0, 'cavalry', at(4, 4)); // Human Knight atk 9
    const d = addUnit(s, 1, 'infantry', at(5, 4)); // Orc Grunt def 1
    expect(computeDamage(s, a, d).damage).toBe(8);
  });

  it('terrain reduces damage', () => {
    const s = emptyState();
    const a = addUnit(s, 0, 'cavalry', at(4, 4));
    const d = addUnit(s, 1, 'infantry', at(5, 4));
    setTerrain(s, d.pos, 'village'); // 30%
    expect(computeDamage(s, a, d).damage).toBe(Math.round(9 * 0.7 - 1));
  });

  it('swamp increases damage taken', () => {
    const s = emptyState();
    const a = addUnit(s, 0, 'cavalry', at(4, 4));
    const d = addUnit(s, 1, 'infantry', at(5, 4));
    setTerrain(s, d.pos, 'swamp');
    expect(computeDamage(s, a, d).damage).toBe(Math.round(9 * 1.1 - 1));
  });

  it('flanking adds 10% per extra adjacent ally', () => {
    const s = emptyState();
    const a = addUnit(s, 0, 'cavalry', at(4, 4));
    const d = addUnit(s, 1, 'infantry', at(5, 4));
    addUnit(s, 0, 'ranged', at(6, 4));
    const r = computeDamage(s, a, d);
    expect(r.multiplier).toBeCloseTo(1.1);
    expect(r.notes).toContain('flank x1');
  });

  it('phalanx gives +2 armor next to an ally', () => {
    const s = emptyState(9, 9, ['orcs', 'humans']);
    const a = addUnit(s, 0, 'cavalry', at(4, 4)); // Wolf Rider atk 9
    const d = addUnit(s, 1, 'infantry', at(5, 4)); // Spearman def 2
    expect(computeDamage(s, a, d).damage).toBe(7);
    addUnit(s, 1, 'infantry', at(6, 4));
    expect(computeDamage(s, a, d).damage).toBe(5);
  });

  it('orc rage boosts damage at half health', () => {
    const s = emptyState(9, 9, ['orcs', 'humans']);
    const a = addUnit(s, 0, 'infantry', at(4, 4), 9); // Grunt 18 max HP
    const d = addUnit(s, 1, 'ranged', at(5, 4));
    expect(computeDamage(s, a, d).notes).toContain('rage');
  });

  it('melee is countered at half strength; ranged shots are not', () => {
    const s = emptyState();
    const a = addUnit(s, 0, 'infantry', at(4, 4));
    const d = addUnit(s, 1, 'infantry', at(5, 4));
    expect(previewAttack(s, a, d).counter).toBe(Math.max(1, Math.round(7 * 0.5 - 2)));

    const archer = addUnit(s, 0, 'ranged', at(4, 6));
    const far = addUnit(s, 1, 'leader', at(4, 8));
    expect(canAttack(s, archer, far)).toBe(true);
    expect(previewAttack(s, archer, far).counter).toBe(0);
  });

  it('forest and mountains block line of sight', () => {
    const s = emptyState();
    const archer = addUnit(s, 0, 'ranged', at(2, 4));
    const target = addUnit(s, 1, 'leader', at(5, 4));
    expect(canAttack(s, archer, target)).toBe(true);
    setTerrain(s, at(3, 4), 'forest');
    expect(canAttack(s, archer, target)).toBe(false);
  });

  it('hills extend ranged reach', () => {
    const s = emptyState();
    const archer = addUnit(s, 0, 'ranged', at(4, 4));
    expect(attackRange(s, archer)).toEqual([1, 3]);
    setTerrain(s, archer.pos, 'hills');
    expect(attackRange(s, archer)).toEqual([1, 4]);
    const melee = addUnit(s, 0, 'infantry', at(1, 1));
    setTerrain(s, melee.pos, 'hills');
    expect(attackRange(s, melee)).toEqual([1, 1]);
  });

  it('cannot attack allies', () => {
    const s = emptyState();
    const a = addUnit(s, 0, 'infantry', at(4, 4));
    const b = addUnit(s, 0, 'infantry', at(5, 4));
    expect(canAttack(s, a, b)).toBe(false);
  });
});
