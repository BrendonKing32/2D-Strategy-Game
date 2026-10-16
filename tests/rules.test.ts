import { describe, expect, it } from 'vitest';
import { axialToOffset, key, offsetToAxial, parseKey } from '../src/core/hex';
import { legalMoves } from '../src/core/movement';
import { applyAction, basesOwnedBy, createGame } from '../src/core/rules';
import { defOf } from '../src/core/state';
import { MAPS, getMap } from '../src/data/maps';
import { TERRAIN } from '../src/data/terrain';
import { addBase, addUnit, at, emptyState, setTerrain } from './helpers';

describe('createGame', () => {
  for (const map of [...MAPS, getMap('random', 42), getMap('random', 1234)]) {
    it(`sets up ${map.name} with home bases, neutral bases and leaders`, () => {
      const s = createGame(map, ['humans', 'elves']);
      expect(s.units).toHaveLength(2);
      for (const u of s.units) {
        expect(defOf(u).role).toBe('leader');
        expect(TERRAIN[s.tiles[key(u.pos)]].moveCost).toBeLessThan(Infinity);
      }
      expect(basesOwnedBy(s, 0)).toHaveLength(1);
      expect(basesOwnedBy(s, 1)).toHaveLength(1);
      const neutral = Object.keys(s.bases).filter((k) => s.bases[k].owner === null);
      expect(neutral.length).toBeGreaterThanOrEqual(2);
      expect(neutral.length % 2).toBe(0);
      // Neutral bases come in mirrored pairs.
      for (const k of neutral) {
        const { col, row } = axialToOffset(parseKey(k));
        expect(s.bases[key(offsetToAxial(s.cols - 1 - col, s.rows - 1 - row))]).toBeDefined();
      }
      expect(s.players[0].gold).toBe(400); // 300 starting + 100 income for turn 1
      expect(s.players[1].gold).toBe(300);
    });
  }

  it('gives the first player legal moves', () => {
    const s = createGame(MAPS[0], ['orcs', 'humans']);
    const leader = s.units.find((u) => u.owner === 0)!;
    expect(legalMoves(s, leader).size).toBeGreaterThan(0);
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

  it('end turn passes control, resets flags and heals on villages', () => {
    const s = emptyState();
    addBase(s, at(8, 8), 0);
    addBase(s, at(8, 0), 1);
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
    addBase(s, at(8, 8), 0);
    addBase(s, at(8, 0), 1);
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
