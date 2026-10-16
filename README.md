# Warfields

A 2D turn-based strategy game on a hexagonal grid. Three races field chess-like
armies, and terrain shapes every move. Two players share one screen (hotseat).

## Running it

```bash
npm install
npm run dev        # open the printed URL (default http://localhost:5173)
npm test           # rules engine test suite
npm run build      # typecheck + production build into dist/
```

## Deploying to Cloudflare

The game ships as an assets-only Cloudflare Worker (`wrangler.jsonc`): Cloudflare serves the static
Vite build in `dist/` directly, with no Worker script.

**Automatic deploys from GitHub (recommended).** One-time setup in the Cloudflare dashboard:

1. Workers & Pages → Create → Import a repository → pick this repo.
2. Deploy command `npx wrangler deploy` (the default). A separate build command isn't needed:
   `wrangler.jsonc` runs `npm run build` before every deploy.
3. Pushes to the production branch (`main`) deploy to **https://warfields.bkbuilds.dev** (custom domain set in
   `wrangler.jsonc`) and to `warfields.<your-subdomain>.workers.dev`.
   Enable builds for non-production branches to get a preview URL for other branches.

**From your own machine:**

```bash
npm run preview:worker   # build and serve through the local Workers runtime (http://localhost:8787)
npm run deploy           # build and deploy (opens a browser to log in to Cloudflare the first time)
```

## How to play

- Pick a race for each player and a battlefield (four handmade maps, or a seeded random map).
- Each player starts with a **home base**, their **Leader** and **300 gold**. Neutral bases are scattered across the map.
- **Income:** every base you own pays **100 gold** at the start of your turn.
- **Recruit:** click one of your empty bases (dashed gold outline) to buy a unit. Each base can recruit one unit per turn;
  the new unit appears on the base and can act from your next turn.
- **Capture:** end your turn with a unit on a neutral or enemy base. If it's still there at the start of your next turn,
  the base is yours. A unit parked on an enemy base also stops them recruiting there.
- **Win** by capturing every base your opponent owns. A player left with no bases loses.
  The Leader can't be recruited, so losing it hurts, but it doesn't end the game.
- On your turn every unit may **move once, then attack once**. Attacking ends that unit's turn.
- Controls: click a unit to select it. Blue hexes show its moves, red outlines show targets it can attack.
  Your units darken a little once they've moved but can still attack, and darken fully once their turn is used up.
  Hover a target to preview damage. Drag to pan, scroll to zoom.
  Keys: `E` ends the turn, `N` selects the next unit that can act, `Esc` deselects.
- The game autosaves to the browser after every action. Use *Continue* on the menu to resume.

### Units (chess-like roles)

| Role | Glyph | Cost | Moves like | Humans | Elves | Orcs |
|---|---|---|---|---|---|---|
| Leader | ♚ | n/a | walks 2 to 3; your commander, can't be recruited | King | High Lord | Warchief |
| Champion | ♛ | 350 | walks, or charges in a straight line | Paladin | Bladedancer | Berserker |
| Heavy | ♜ | 250 | slides in straight lines only (rook) | War Chariot | Wind Rider | Boar Juggernaut |
| Cavalry | ♞ | 200 | leaps an exact distance over anything (knight) | Knight | Stag Rider (2 to 3) | Wolf Rider |
| Ranged | ♝ | 150 | walks 2, shoots at range (no retaliation) | Crossbowman (3) | Longbowman (4) | Spear Thrower (2) |
| Infantry | ♟ | 100 | walks 2 to 3 but never backwards (pawn); promotes on the enemy back row | Spearman | Glade Warden | Grunt |

### Races

- **Humans**: balanced. Spearmen get *phalanx* (+2 defense next to an ally). Villages and bases heal Humans 1 extra HP.
- **Elves**: fast and fragile. Forest costs them 1 movement and gives them +15% extra defense. Longest bow range.
- **Orcs**: tough and hard-hitting. Hills cost them 1 movement. *Rage*: +25% damage at or below half HP.

### Terrain

| Terrain | Move cost | Defense | Notes |
|---|---|---|---|
| Plains | 1 | 0% | |
| Road | 1 | 0% | road-to-road steps cost 0.5 |
| Forest | 2 | +25% | blocks line of sight |
| Hills | 2 | +20% | ranged units get +1 range |
| Mountain | 3 | +40% | blocks sight, +1 range; cavalry and heavies can't enter |
| Swamp | 3 | -10% | entering ends movement |
| Village | 1 | +30% | heals the occupant 2 HP per turn |
| Base | 1 | +25% | income and recruiting; heals the occupant 2 HP per turn |
| Water | n/a | n/a | impassable |

### Combat

`damage = max(1, round(attack × modifiers × (1 − terrain defense) − armor))`

- Melee attacks get a half-strength counterattack if the defender survives. Ranged shots (distance 2+) do not.
- Flanking: +10% per additional allied unit adjacent to the target.
- Leaders give adjacent allies +15% damage (*command*).
- Zone of control: stepping next to an enemy ends a unit's movement. Cavalry leaps ignore it.

## Project layout

```
src/core/     pure, DOM-free rules engine (hex math, movement, combat, rules)
src/data/     terrain, races/units and maps (edit these to add content)
src/render/   canvas renderer and camera
src/ui/       setup screen, game view / HUD, save storage
tests/        vitest suites for the rules engine
```

Game state is plain JSON, and `applyAction(state, action)` returns a new state.
That keeps save/load, undo and a future AI opponent straightforward to add.

Maps are ASCII grids in `src/data/maps/index.ts`
(`.` plains, `=` road, `f` forest, `h` hills, `m` mountain, `~` water, `s` swamp, `v` village,
`B` neutral base, `1`/`2` home bases). Keep maps point-symmetric so both sides are equal.
