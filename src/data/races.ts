import type { RaceDef, RaceId, UnitDef, UnitRole } from '../core/types';

/** Chess piece glyphs used to draw each role on the board. */
export const ROLE_GLYPH: Record<UnitRole, string> = {
  leader: '♚',
  champion: '♛',
  heavy: '♜',
  ranged: '♝',
  cavalry: '♞',
  infantry: '♟',
};

export const ROLE_NAME: Record<UnitRole, string> = {
  leader: 'Leader',
  champion: 'Champion',
  heavy: 'Heavy',
  ranged: 'Ranged',
  cavalry: 'Cavalry',
  infantry: 'Infantry',
};

type UnitSpec = Omit<UnitDef, 'id' | 'race' | 'role'>;

function units(race: RaceId, specs: Record<UnitRole, UnitSpec>): Record<UnitRole, UnitDef> {
  const out = {} as Record<UnitRole, UnitDef>;
  for (const role of Object.keys(specs) as UnitRole[]) {
    out[role] = { ...specs[role], id: `${race}.${role}`, race, role };
  }
  return out;
}

export const RACES: Record<RaceId, RaceDef> = {
  humans: {
    id: 'humans',
    name: 'Humans',
    color: '#f2d16b',
    description:
      'Balanced and disciplined. Spearmen hold the line in phalanx; villages and bases heal Humans 1 extra HP.',
    healBonus: 1,
    units: units('humans', {
      leader: {
        cost: 0,
        name: 'King',
        maxHp: 28,
        attack: 9,
        defense: 3,
        movement: { walk: 2 },
        range: [1, 1],
        abilities: ['command'],
        description: 'Your commander. Cannot be recruited. Inspires adjacent allies (+15% damage).',
      },
      champion: {
        cost: 350,
        name: 'Paladin',
        maxHp: 24,
        attack: 11,
        defense: 3,
        movement: { walk: 2, line: 4 },
        range: [1, 1],
        description: 'Walks 2, or charges up to 4 in a straight line.',
      },
      heavy: {
        cost: 250,
        name: 'War Chariot',
        maxHp: 22,
        attack: 9,
        defense: 3,
        movement: { line: 5 },
        range: [1, 1],
        impassable: ['mountain', 'swamp'],
        description: 'Drives in straight lines only, like a rook.',
      },
      cavalry: {
        cost: 200,
        name: 'Knight',
        maxHp: 20,
        attack: 9,
        defense: 2,
        movement: { jump: [2, 2] },
        range: [1, 1],
        impassable: ['mountain'],
        description: 'Leaps exactly 2 hexes, over anything in the way.',
      },
      ranged: {
        cost: 150,
        name: 'Crossbowman',
        maxHp: 14,
        attack: 8,
        defense: 1,
        movement: { walk: 2 },
        range: [1, 3],
        description: 'Shoots up to 3 hexes. No retaliation against shots.',
      },
      infantry: {
        cost: 100,
        name: 'Spearman',
        maxHp: 16,
        attack: 6,
        defense: 2,
        movement: { walk: 2, forwardOnly: true },
        range: [1, 1],
        abilities: ['phalanx'],
        description: 'Never retreats. +2 defense next to an ally. Promotes on the enemy back row.',
      },
    }),
  },

  elves: {
    id: 'elves',
    name: 'Elves',
    color: '#9be8b0',
    description:
      'Swift and fragile. Forests cost Elves only 1 movement and give them +15% extra defense. Longest bow range.',
    terrainCost: { forest: 1 },
    terrainDefenseBonus: { forest: 0.15 },
    units: units('elves', {
      leader: {
        cost: 0,
        name: 'High Lord',
        maxHp: 24,
        attack: 9,
        defense: 2,
        movement: { walk: 3 },
        range: [1, 1],
        abilities: ['command'],
        description: 'Your commander. Cannot be recruited. Inspires adjacent allies (+15% damage).',
      },
      champion: {
        cost: 350,
        name: 'Bladedancer',
        maxHp: 20,
        attack: 12,
        defense: 2,
        movement: { walk: 3, line: 4 },
        range: [1, 1],
        description: 'Walks 3, or dashes up to 4 in a straight line.',
      },
      heavy: {
        cost: 250,
        name: 'Wind Rider',
        maxHp: 18,
        attack: 9,
        defense: 2,
        movement: { line: 6 },
        range: [1, 1],
        impassable: ['mountain'],
        description: 'Races up to 6 hexes in a straight line.',
      },
      cavalry: {
        cost: 200,
        name: 'Stag Rider',
        maxHp: 17,
        attack: 8,
        defense: 2,
        movement: { jump: [2, 3] },
        range: [1, 1],
        impassable: ['mountain'],
        description: 'Leaps 2 or 3 hexes, over anything in the way.',
      },
      ranged: {
        cost: 150,
        name: 'Longbowman',
        maxHp: 12,
        attack: 8,
        defense: 1,
        movement: { walk: 2 },
        range: [1, 4],
        description: 'Shoots up to 4 hexes. No retaliation against shots.',
      },
      infantry: {
        cost: 100,
        name: 'Glade Warden',
        maxHp: 13,
        attack: 6,
        defense: 1,
        movement: { walk: 3, forwardOnly: true },
        range: [1, 1],
        description: 'Never retreats, but moves fast. Promotes on the enemy back row.',
      },
    }),
  },

  orcs: {
    id: 'orcs',
    name: 'Orcs',
    color: '#d0884a',
    description:
      'Brutal and tough. Hills cost Orcs only 1 movement. Rage: +25% damage when at half HP or below.',
    terrainCost: { hills: 1 },
    abilities: ['rage'],
    units: units('orcs', {
      leader: {
        cost: 0,
        name: 'Warchief',
        maxHp: 32,
        attack: 11,
        defense: 3,
        movement: { walk: 2 },
        range: [1, 1],
        abilities: ['command'],
        description: 'Your commander. Cannot be recruited. Inspires adjacent allies (+15% damage).',
      },
      champion: {
        cost: 350,
        name: 'Berserker',
        maxHp: 28,
        attack: 12,
        defense: 1,
        movement: { walk: 2, line: 3 },
        range: [1, 1],
        description: 'Walks 2, or charges up to 3 in a straight line.',
      },
      heavy: {
        cost: 250,
        name: 'Boar Juggernaut',
        maxHp: 26,
        attack: 10,
        defense: 3,
        movement: { line: 4 },
        range: [1, 1],
        impassable: ['mountain'],
        description: 'Charges in straight lines only, like a rook.',
      },
      cavalry: {
        cost: 200,
        name: 'Wolf Rider',
        maxHp: 20,
        attack: 9,
        defense: 1,
        movement: { jump: [2, 2] },
        range: [1, 1],
        impassable: ['mountain'],
        description: 'Leaps exactly 2 hexes, over anything in the way.',
      },
      ranged: {
        cost: 150,
        name: 'Spear Thrower',
        maxHp: 15,
        attack: 7,
        defense: 1,
        movement: { walk: 2 },
        range: [1, 2],
        description: 'Hurls spears up to 2 hexes. No retaliation against throws.',
      },
      infantry: {
        cost: 100,
        name: 'Grunt',
        maxHp: 18,
        attack: 7,
        defense: 1,
        movement: { walk: 2, forwardOnly: true },
        range: [1, 1],
        description: 'Never retreats. Promotes on the enemy back row.',
      },
    }),
  },
};

const UNIT_INDEX: Record<string, UnitDef> = Object.fromEntries(
  Object.values(RACES).flatMap((race) => Object.values(race.units).map((u) => [u.id, u])),
);

export function unitDef(defId: string): UnitDef {
  const def = UNIT_INDEX[defId];
  if (!def) throw new Error(`Unknown unit def: ${defId}`);
  return def;
}

/** Roles that can be bought at a base, cheapest first. */
export const RECRUITABLE: UnitRole[] = ['infantry', 'ranged', 'cavalry', 'heavy', 'champion'];

export const STARTING_GOLD = 300;
export const INCOME_PER_BASE = 100;
