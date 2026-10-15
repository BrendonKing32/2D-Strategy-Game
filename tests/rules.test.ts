import { describe, expect, it } from 'vitest';
import { key } from '../src/core/hex';
import { legalMoves } from '../src/core/movement';
import { applyAction, createGame } from '../src/core/rules';
import { defOf } from '../src/core/state';
import { MAPS, getMap } from '../src/data/maps';
import { TERRAIN } from '../src/data/terrain';
import { addUnit, at, emptyState, setTerrain } from './helpers';

describe('createGame', () => {
  for (const map of [...MAPS, getMap('random', 42)]) {
    it(`deploys two full armies on ${map.name}`, () => {
      const s = createGame(map, ['humans', 'elves']);
      expect(s.units).toHaveLength(30);
      const keys = new Set(s.units.map((u) => key(u.pos)));
      expect(keys.size).toBe(30);
      for (const u of s.units) {
        const t = s.tiles[key(u.pos)];
        expect(t).toBeDefined();
        expect(TERRAIN[t].moveCost).toBeLessThan(Infinity);
      }
      for (const p of [0, 1]) {
        expect(s.units.filter((u) => u.owner === p && defOf(u).role === 'leader')).toHaveLength(1);
      }
    });
  }

  it('gives the first player legal moves', () => {
    const s = createGame(MAPS[0], ['orcs', 'humans']);
    const movable = s.units.filter((u) => u.owner === 0 && legalMoves(s, u).size > 0);
    expect(movable.length).toBeGreaterThan(5);
  });

  it('random maps are deterministic per seed', () => {
    expect(getMap('random', 7).rows).toEqual(getMap('random', 7).rows);
    expect(getMap('random', 7).rows).not.toEqual(getMap('random', 8).rows);
  });
});

describe('applyAction', () => {
  it('moves units and does not mutate the previous state', () => {
    const s = emptyState();
    const u = addUnit(s, 0, 'leader', at(4, 4));
    addUnit(s, 1, 'leader', at(0, 0));
    const next = applyAction(s, { type: 'move', unitId: u.id, to: at(5, 4) });
    expect(next.units[0].pos).toEqual(at(5, 4));
    expect(s.units[0].pos).toEqual(at(4, 4));
    expect(() => applyAction(next, { type: 'move', unitId: u.id, to: at(6, 4) })).toThrow();
  });

  it('rejects illegal moves', () => {
    const s = emptyState();
    const u = addUnit(s, 0, 'leader', at(4, 4));
    expect(() => applyAction(s, { type: 'move', unitId: u.id, to: at(8, 8) })).toThrow();
  });

  it('resolves attacks with counterattacks', () => {
    const s = emptyState();
    const a = addUnit(s, 0, 'infantry', at(4, 4));
    const d = addUnit(s, 1, 'infantry', at(5, 4));
    addUnit(s, 0, 'leader', at(0, 8));
    addUnit(s, 1, 'leader', at(8, 0));
    const next = applyAction(s, { type: 'attack', unitId: a.id, targetId: d.id });
    const na = next.units.find((u) => u.id === a.id)!;
    const nd = next.units.find((u) => u.id === d.id)!;
    expect(nd.hp).toBeLessThan(d.hp);
    expect(na.hp).toBeLessThan(a.hp);
    expect(na.attacked).toBe(true);
  });

  it('killing the leader wins the game', () => {
    const s = emptyState();
    const a = addUnit(s, 0, 'champion', at(4, 4));
    const king = addUnit(s, 1, 'leader', at(5, 4), 1);
    addUnit(s, 0, 'leader', at(0, 8));
    addUnit(s, 1, 'infantry', at(8, 0));
    const next = applyAction(s, { type: 'attack', unitId: a.id, targetId: king.id });
    expect(next.units.some((u) => u.id === king.id)).toBe(false);
    expect(next.winner).toBe(0);
    expect(() => applyAction(next, { type: 'endTurn' })).toThrow();
  });

  it('end turn passes control, resets flags and heals on villages', () => {
    const s = emptyState();
    addUnit(s, 0, 'leader', at(4, 4));
    const hurt = addUnit(s, 1, 'leader', at(1, 1), 10);
    hurt.moved = true;
    setTerrain(s, hurt.pos, 'village');
    const next = applyAction(s, { type: 'endTurn' });
    expect(next.current).toBe(1);
    const h = next.units.find((u) => u.id === hurt.id)!;
    expect(h.hp).toBe(12);
    expect(h.moved).toBe(false);
    const back = applyAction(next, { type: 'endTurn' });
    expect(back.current).toBe(0);
    expect(back.turn).toBe(2);
  });

  it('humans heal extra in villages', () => {
    const s = emptyState(9, 9, ['orcs', 'humans']);
    addUnit(s, 0, 'leader', at(4, 4));
    const hurt = addUnit(s, 1, 'leader', at(1, 1), 10);
    setTerrain(s, hurt.pos, 'village');
    const next = applyAction(s, { type: 'endTurn' });
    expect(next.units.find((u) => u.id === hurt.id)!.hp).toBe(13);
  });

  it('infantry reaching the enemy back row is promoted', () => {
    const s = emptyState();
    const pawn = addUnit(s, 0, 'infantry', at(4, 1));
    addUnit(s, 0, 'leader', at(0, 8));
    addUnit(s, 1, 'leader', at(8, 8));
    const next = applyAction(s, { type: 'move', unitId: pawn.id, to: at(4, 0) });
    const promoted = next.units.find((u) => u.id === pawn.id)!;
    expect(defOf(promoted).role).toBe('champion');
  });

  it('state survives a JSON round trip (save/load)', () => {
    const s = createGame(MAPS[1], ['elves', 'orcs']);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});
