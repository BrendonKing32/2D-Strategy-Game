import { describe, expect, it } from 'vitest';
import { applyAction, unitReadiness } from '../src/core/rules';
import { addBase, addUnit, at, emptyState } from './helpers';

function setup() {
  const s = emptyState();
  addBase(s, at(8, 8), 0);
  addBase(s, at(8, 0), 1);
  return s;
}

describe('unitReadiness', () => {
  it('is ready before a unit acts', () => {
    const s = setup();
    const u = addUnit(s, 0, 'leader', at(4, 4));
    expect(unitReadiness(s, u)).toBe('ready');
  });

  it('is partial after moving into attack range, spent after attacking', () => {
    let s = setup();
    const u = addUnit(s, 0, 'leader', at(2, 4));
    const enemy = addUnit(s, 1, 'infantry', at(4, 4));
    s = applyAction(s, { type: 'move', unitId: u.id, to: at(3, 4) });
    expect(unitReadiness(s, s.units.find((x) => x.id === u.id)!)).toBe('partial');
    s = applyAction(s, { type: 'attack', unitId: u.id, targetId: enemy.id });
    expect(unitReadiness(s, s.units.find((x) => x.id === u.id)!)).toBe('spent');
  });

  it('is spent after moving with nothing to attack', () => {
    let s = setup();
    const u = addUnit(s, 0, 'leader', at(2, 6));
    addUnit(s, 1, 'infantry', at(7, 1));
    s = applyAction(s, { type: 'move', unitId: u.id, to: at(3, 6) });
    expect(unitReadiness(s, s.units.find((x) => x.id === u.id)!)).toBe('spent');
  });

  it('treats fresh recruits as spent and resets at the start of the next turn', () => {
    let s = setup();
    s.players[0].gold = 100;
    s = applyAction(s, { type: 'recruit', at: at(8, 8), role: 'infantry' });
    const recruit = s.units.find((x) => x.pos.q === at(8, 8).q && x.pos.r === at(8, 8).r)!;
    expect(unitReadiness(s, recruit)).toBe('spent');
    s = applyAction(applyAction(s, { type: 'endTurn' }), { type: 'endTurn' });
    expect(unitReadiness(s, s.units.find((x) => x.id === recruit.id)!)).toBe('ready');
  });

  it("shows the opponent's units as ready", () => {
    const s = setup();
    const enemy = addUnit(s, 1, 'leader', at(4, 1));
    enemy.attacked = true;
    expect(unitReadiness(s, enemy)).toBe('ready');
  });
});
