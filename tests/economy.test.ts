import { describe, expect, it } from 'vitest';
import { applyAction, incomeFor, isCapturing } from '../src/core/rules';
import { defOf } from '../src/core/state';
import { legalMoves } from '../src/core/movement';
import type { GameState } from '../src/core/types';
import { addBase, addUnit, at, emptyState } from './helpers';

/** Two players, one home base each, leaders standing off to the side. */
function setup(): GameState {
  const s = emptyState();
  addBase(s, at(4, 8), 0);
  addBase(s, at(4, 0), 1);
  addUnit(s, 0, 'leader', at(0, 8));
  addUnit(s, 1, 'leader', at(8, 0));
  return s;
}

const endTurns = (s: GameState, n: number) => {
  for (let i = 0; i < n; i++) s = applyAction(s, { type: 'endTurn' });
  return s;
};

describe('income', () => {
  it('pays 100 gold per owned base at the start of your turn', () => {
    let s = setup();
    addBase(s, at(2, 4), 1);
    addBase(s, at(6, 4), null);
    expect(incomeFor(s, 0)).toBe(100);
    expect(incomeFor(s, 1)).toBe(200);
    s = endTurns(s, 1);
    expect(s.players[1].gold).toBe(200);
    s = endTurns(s, 1);
    expect(s.players[0].gold).toBe(100);
  });
});

describe('capture', () => {
  it('a unit that ends its turn on a base captures it at the start of its next turn', () => {
    let s = setup();
    addBase(s, at(4, 4), null);
    const u = addUnit(s, 0, 'infantry', at(4, 5));
    s = applyAction(s, { type: 'move', unitId: u.id, to: at(4, 4) });
    expect(isCapturing(s, s.units.find((x) => x.id === u.id)!)).toBe(true);
    s = endTurns(s, 1); // player 2's turn: not captured yet
    expect(Object.values(s.bases).filter((b) => b.owner === 0)).toHaveLength(1);
    s = endTurns(s, 1); // back to player 1: captured, and income includes it
    expect(Object.values(s.bases).filter((b) => b.owner === 0)).toHaveLength(2);
    expect(s.players[0].gold).toBe(200);
  });

  it('moving off before your next turn cancels the capture', () => {
    let s = setup();
    addBase(s, at(4, 4), null);
    const u = addUnit(s, 0, 'leader', at(4, 4));
    u.moved = true;
    s = endTurns(s, 2);
    // Captured: it was still standing there at the start of the turn.
    expect(Object.values(s.bases).filter((b) => b.owner === 0)).toHaveLength(2);

    let t = setup();
    addBase(t, at(4, 4), null);
    const v = addUnit(t, 0, 'leader', at(4, 5));
    t = applyAction(t, { type: 'move', unitId: v.id, to: at(4, 4) });
    t = endTurns(t, 2);
    t = applyAction(t, { type: 'move', unitId: v.id, to: at(5, 5) });
    expect(Object.values(t.bases).filter((b) => b.owner === 0)).toHaveLength(2);
  });

  it('capturing the last enemy base wins; killing the leader does not', () => {
    let s = setup();
    const raider = addUnit(s, 0, 'cavalry', at(4, 2));
    const enemyLeader = s.units.find((u) => u.owner === 1)!;
    enemyLeader.hp = 1;
    const champ = addUnit(s, 0, 'champion', at(7, 0));
    s = applyAction(s, { type: 'attack', unitId: champ.id, targetId: enemyLeader.id });
    expect(s.units.some((u) => u.id === enemyLeader.id)).toBe(false);
    expect(s.winner).toBeNull();

    s = applyAction(s, { type: 'move', unitId: raider.id, to: at(4, 0) });
    s = endTurns(s, 1);
    expect(s.winner).toBeNull();
    s = endTurns(s, 1);
    expect(s.winner).toBe(0);
    expect(() => applyAction(s, { type: 'endTurn' })).toThrow();
  });
});

describe('recruit', () => {
  it('buys a unit on an owned empty base, which cannot act this turn', () => {
    let s = setup();
    s.players[0].gold = 300;
    s = applyAction(s, { type: 'recruit', at: at(4, 8), role: 'ranged' });
    expect(s.players[0].gold).toBe(150);
    const u = s.units.find((x) => x.owner === 0 && defOf(x).role === 'ranged')!;
    expect(u.pos).toEqual(at(4, 8));
    expect(legalMoves(s, u).size).toBe(0);
    s = endTurns(s, 2);
    expect(legalMoves(s, s.units.find((x) => x.id === u.id)!).size).toBeGreaterThan(0);
  });

  it('allows only one recruit per base per turn', () => {
    let s = setup();
    s.players[0].gold = 1000;
    s = applyAction(s, { type: 'recruit', at: at(4, 8), role: 'infantry' });
    const recruit = s.units.find((x) => defOf(x).role === 'infantry')!;
    recruit.pos = at(3, 7); // pretend it walked off
    expect(() => applyAction(s, { type: 'recruit', at: at(4, 8), role: 'infantry' })).toThrow(/already/);
  });

  it('rejects occupied, enemy, neutral and unaffordable bases, and leaders', () => {
    const s = setup();
    s.players[0].gold = 120;
    addBase(s, at(2, 4), null);
    expect(() => applyAction(s, { type: 'recruit', at: at(4, 0), role: 'infantry' })).toThrow(/Not your base/);
    expect(() => applyAction(s, { type: 'recruit', at: at(2, 4), role: 'infantry' })).toThrow(/Not your base/);
    expect(() => applyAction(s, { type: 'recruit', at: at(4, 8), role: 'cavalry' })).toThrow(/gold/);
    expect(() => applyAction(s, { type: 'recruit', at: at(4, 8), role: 'leader' })).toThrow(/cannot be recruited/);
    addUnit(s, 0, 'infantry', at(4, 8));
    expect(() => applyAction(s, { type: 'recruit', at: at(4, 8), role: 'infantry' })).toThrow(/occupied/);
  });
});
