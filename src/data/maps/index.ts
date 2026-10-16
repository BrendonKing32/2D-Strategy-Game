import { generateMap } from './generate';

/**
 * Maps are authored as rows of terrain glyphs in "odd-r" offset layout
 * (odd rows are shifted half a hex to the right). See TERRAIN_GLYPHS:
 *   . plains   = road   f forest   h hills   m mountain   ~ water   s swamp   v village
 * Player 1 deploys on the bottom two rows, Player 2 on the top two.
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
      '.............',
      '.............',
      '.ff...=...hh.',
      'ff.v..=..h.f.',
      '.....h=f....~',
      '======v======',
      '~....f=h.....',
      '.f.h..=..v.ff',
      '.hh...=...ff.',
      '.............',
      '.............',
    ],
  },
  {
    id: 'river-valley',
    name: 'River Valley',
    description: 'A river splits the field. Cross at the bridges or wade through the marsh.',
    rows: [
      '.............',
      '.............',
      'f..h.....h..f',
      'ff..f...f..ff',
      '.s...v.v...s.',
      '~~=~~~s~~~=~~',
      '.s...v.v...s.',
      'ff..f...f..ff',
      'f..h.....h..f',
      '.............',
      '.............',
    ],
  },
  {
    id: 'highlands',
    name: 'Highlands',
    description: 'Mountain passes and rolling hills. Orc country.',
    rows: [
      '.............',
      '.............',
      '..h.m...m.h..',
      '.hh.mm.mm.hh.',
      'f...h.v.h...f',
      'ff.m..h..m.ff',
      'f...h.v.h...f',
      '.hh.mm.mm.hh.',
      '..h.m...m.h..',
      '.............',
      '.............',
    ],
  },
  {
    id: 'elderwood',
    name: 'Elderwood',
    description: 'Dense ancient forest broken by glades. Elven home ground.',
    rows: [
      '.............',
      '.............',
      'ff.ff.f.ff.ff',
      'f.fff...fff.f',
      '.ff.v.f.v.ff.',
      'f..ff.s.ff..f',
      '.ff.v.f.v.ff.',
      'f.fff...fff.f',
      'ff.ff.f.ff.ff',
      '.............',
      '.............',
    ],
  },
];

export function getMap(id: string, seed = 1): MapDef {
  if (id === 'random') return generateMap(seed);
  const map = MAPS.find((m) => m.id === id);
  if (!map) throw new Error(`Unknown map: ${id}`);
  return map;
}
