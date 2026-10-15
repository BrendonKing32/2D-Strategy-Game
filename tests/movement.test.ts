import { describe, expect, it } from 'vitest';
import { distance, key, parseKey } from '../src/core/hex';
import { legalMoves } from '../src/core/movement';
import { addUnit, at, emptyState, setTerrain } from './helpers';

describe('walk movement', () => {
  it('reaches all hexes within move points on open ground', () => {
    const s = emptyState();
    const u = addUnit(s, 0, 'ranged', at(4, 4)); // walk 2
    const moves = legalMoves(s, u);
    expect(moves.size).toBe(18); // 6 + 12
  });

  it('pays terrain costs', () => {
    const s = emptyState();
    const u = addUnit(s, 0, 'ranged', at(4, 4));
    for (const k of Object.keys(s.tiles)) s.tiles[k] = 'forest';
    setTerrain(s, at(4, 4), 'plains');
    const moves = legalMoves(s, u);
    expect(moves.size).toBe(6); // only adjacent forest hexes (cost 2)
  });

  it('applies racial terrain discounts (Elves in forest)', () => {
    const s = emptyState(9, 9, ['elves', 'orcs']);
    for (const k of Object.keys(s.tiles)) s.tiles[k] = 'forest';
    const u = addUnit(s, 0, 'ranged', at(4, 4));
    expect(legalMoves(s, u).size).toBe(18);
  });

  it('cannot enter water and stops in swamp', () => {
    const s = emptyState();
    const u = addUnit(s, 0, 'leader', at(4, 4)); // walk 2
    const water = at(5, 4);
    setTerrain(s, water, 'water');
    const moves = legalMoves(s, u);
    expect(moves.has(key(water))).toBe(false);

    const s2 = emptyState();
    const u2 = addUnit(s2, 0, 'champion', at(4, 4)); // walk 2 + line 4
    // Swamp costs 3: walk-2 can't enter, line-4 can but must stop on the first swamp hex.
    for (const k of Object.keys(s2.tiles)) s2.tiles[k] = 'swamp';
    setTerrain(s2, u2.pos, 'plains');
    const swampMoves = legalMoves(s2, u2);
    expect(swampMoves.size).toBe(6);
    for (const k of swampMoves) expect(distance(parseKey(k), u2.pos)).toBe(1);
  });

  it('stops in enemy zone of control', () => {
    const s = emptyState();
    const u = addUnit(s, 0, 'leader', at(4, 6));
    addUnit(s, 1, 'infantry', at(4, 4));
    const moves = legalMoves(s, u);
    // Any reachable hex adjacent to the enemy must be a dead end, so nothing beyond it at distance 2 via it.
    for (const k of moves) expect(distance(parseKey(k), u.pos)).toBeLessThanOrEqual(2);
    expect(moves.has(key(at(4, 4)))).toBe(false);
  });

  it('forward-only infantry cannot step backwards', () => {
    const s = emptyState();
    const p1 = addUnit(s, 0, 'infantry', at(4, 4));
    for (const k of legalMoves(s, p1)) expect(parseKey(k).r).toBeLessThanOrEqual(p1.pos.r);
  });

  it('allies can be passed through but not landed on', () => {
    const s = emptyState();
    const u = addUnit(s, 0, 'leader', at(4, 4));
    const ally = addUnit(s, 0, 'infantry', at(5, 4));
    const moves = legalMoves(s, u);
    expect(moves.has(key(ally.pos))).toBe(false);
    expect(moves.has(key(at(6, 4)))).toBe(true);
  });

  it('roads make long marches cheap', () => {
    const s = emptyState();
    for (let c = 0; c < 9; c++) setTerrain(s, at(c, 4), 'road');
    setTerrain(s, at(1, 4), 'plains');
    const u = addUnit(s, 0, 'leader', at(1, 4)); // walk 2
    expect(legalMoves(s, u).has(key(at(4, 4)))).toBe(true); // 1 + 0.5 + 0.5
    expect(legalMoves(s, u).has(key(at(5, 4)))).toBe(false);
  });
});

describe('line movement', () => {
  it('slides along six axes and is blocked by units', () => {
    const s = emptyState(13, 13);
    const u = addUnit(s, 0, 'heavy', at(6, 6)); // line 5
    const moves = legalMoves(s, u);
    expect(moves.size).toBe(30);
    addUnit(s, 0, 'infantry', at(8, 6));
    const blocked = legalMoves(s, u);
    expect(blocked.has(key(at(7, 6)))).toBe(true);
    expect(blocked.has(key(at(9, 6)))).toBe(false);
  });

  it('heavy units cannot drive onto mountains', () => {
    const s = emptyState();
    const u = addUnit(s, 0, 'heavy', at(4, 4));
    setTerrain(s, at(5, 4), 'mountain');
    const moves = legalMoves(s, u);
    expect(moves.has(key(at(5, 4)))).toBe(false);
    expect(moves.has(key(at(6, 4)))).toBe(false);
  });
});

describe('jump movement', () => {
  it('knights land exactly 2 away, over blockers', () => {
    const s = emptyState();
    const u = addUnit(s, 0, 'cavalry', at(4, 4));
    for (const n of [at(3, 4), at(5, 4), at(4, 3), at(4, 5), at(3, 3), at(3, 5)]) addUnit(s, 1, 'infantry', n);
    const moves = legalMoves(s, u);
    expect(moves.size).toBe(12);
    for (const k of moves) expect(distance(parseKey(k), u.pos)).toBe(2);
  });

  it('elven stag riders leap 2 or 3', () => {
    const s = emptyState(13, 13, ['elves', 'orcs']);
    const u = addUnit(s, 0, 'cavalry', at(6, 6));
    expect(legalMoves(s, u).size).toBe(12 + 18);
  });
});

describe('turn restrictions', () => {
  it('only the current player can move, once', () => {
    const s = emptyState();
    const enemy = addUnit(s, 1, 'leader', at(1, 1));
    expect(legalMoves(s, enemy).size).toBe(0);
    const u = addUnit(s, 0, 'leader', at(6, 6));
    u.moved = true;
    expect(legalMoves(s, u).size).toBe(0);
  });
});
