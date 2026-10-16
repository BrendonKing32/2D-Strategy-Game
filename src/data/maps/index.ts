import { generateMap } from './generate';

/**
 * Maps are authored as rows of terrain glyphs in "odd-r" offset layout
 * (odd rows are shifted half a hex to the right). See TERRAIN_GLYPHS:
 *   . plains   = road   f forest   h hills   m mountain   ~ water   s swamp   v village
 *   B neutral base   1 Player 1 home base   2 Player 2 home base
 * Player 1 starts at the bottom, Player 2 at the top. Keep maps point-symmetric for fairness.
 */
export interface MapDef {
  id: string;
  name: string;
  description: string;
  rows: string[];
}

export const MAPS: MapDef[] = [
  {
    id: 'crossroads',
    name: 'Crossroads',
    description: 'Two roads meet at a central village. Mixed terrain on every flank.',
    rows: [
      '......2......',
      '.............',
      'Bff...=...hhB',
      'ff.v..=..h.f.',
      '.....h=f....~',
      'B=====v=====B',
      '~....f=h.....',
      '.f.h..=..v.ff',
      'Bhh...=...ffB',
      '.............',
      '......1......',
    ],
  },
  {
    id: 'river-valley',
    name: 'River Valley',
    description: 'A river splits the field. Cross at the bridges or wade through the marsh.',
    rows: [
      '......2......',
      '.............',
      'f..h.....h..f',
      'ffB.f...f.Bff',
      '.s...vBv...s.',
      '~~=~~~s~~~=~~',
      '.s...vBv...s.',
      'ffB.f...f.Bff',
      'f..h.....h..f',
      '.............',
      '......1......',
    ],
  },
  {
    id: 'highlands',
    name: 'Highlands',
    description: 'Mountain passes and rolling hills. Orc country.',
    rows: [
      '......2......',
      '.............',
      'B.h.m...m.h.B',
      '.hh.mm.mm.hh.',
      'f...h.v.h...f',
      'ff.mB.h.Bm.ff',
      'f...h.v.h...f',
      '.hh.mm.mm.hh.',
      'B.h.m...m.h.B',
      '.............',
      '......1......',
    ],
  },
  {
    id: 'elderwood',
    name: 'Elderwood',
    description: 'Dense ancient forest broken by glades. Elven home ground.',
    rows: [
      '......2......',
      '.............',
      'ff.ff.f.ff.ff',
      'f.fff.B.fff.f',
      'Bff.v.f.v.ffB',
      'fB.ff.s.ff.Bf',
      'Bff.v.f.v.ffB',
      'f.fff.B.fff.f',
      'ff.ff.f.ff.ff',
      '.............',
      '......1......',
    ],
  },
];

export function getMap(id: string, seed = 1): MapDef {
  if (id === 'random') return generateMap(seed);
  const map = MAPS.find((m) => m.id === id);
  if (!map) throw new Error(`Unknown map: ${id}`);
  return map;
}
