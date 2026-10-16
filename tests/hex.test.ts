import { describe, expect, it } from 'vitest';
import {
  axialToOffset,
  distance,
  hex,
  hexToPixel,
  key,
  line,
  neighbors,
  offsetToAxial,
  pixelToHex,
  ring,
} from '../src/core/hex';

describe('hex math', () => {
  it('computes distance', () => {
    expect(distance(hex(0, 0), hex(0, 0))).toBe(0);
    expect(distance(hex(0, 0), hex(3, -1))).toBe(3);
    expect(distance(hex(-2, 1), hex(2, -1))).toBe(4);
  });

  it('has six neighbours at distance 1', () => {
    const ns = neighbors(hex(2, 3));
    expect(ns).toHaveLength(6);
    for (const n of ns) expect(distance(n, hex(2, 3))).toBe(1);
  });

  it('rings have 6*r unique hexes at exactly r', () => {
    for (const r of [1, 2, 3]) {
      const hs = ring(hex(0, 0), r);
      expect(hs).toHaveLength(6 * r);
      expect(new Set(hs.map(key)).size).toBe(6 * r);
      for (const h of hs) expect(distance(h, hex(0, 0))).toBe(r);
    }
  });

  it('draws contiguous lines', () => {
    const l = line(hex(0, 0), hex(4, -2));
    expect(l).toHaveLength(5);
    for (let i = 1; i < l.length; i++) expect(distance(l[i - 1], l[i])).toBe(1);
  });

  it('round-trips pixel conversion', () => {
    for (const h of [hex(0, 0), hex(3, -2), hex(-4, 5)]) {
      const p = hexToPixel(h, 30);
      expect(pixelToHex(p.x + 3, p.y - 4, 30)).toEqual(h);
    }
  });

  it('round-trips offset conversion', () => {
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 6; col++) expect(axialToOffset(offsetToAxial(col, row))).toEqual({ col, row });
    }
  });
});
