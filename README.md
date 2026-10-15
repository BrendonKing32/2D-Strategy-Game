# Hex Dominion

A 2D turn-based strategy game on a hexagonal grid. Three races field chess-like
armies, and terrain shapes every move. Two players share one screen (hotseat).

## Running it

```bash
npm install
npm run dev        # open the printed URL (default http://localhost:5173)
npm test           # rules engine test suite
npm run build      # typecheck + production build into dist/
```

## How to play

- Pick a race for each player and a battlefield (four handmade maps, or a seeded random map).
- On your turn every unit may **move once, then attack once**. Attacking ends that unit's turn.
- **Win** by killing the enemy Leader (♚) or wiping out their army.
- Controls: click a unit to select it. Blue hexes show its moves, red outlines show targets it can attack.
  Hover a target to preview damage. Drag to pan, scroll to zoom.
  Keys: `E` ends the turn, `N` selects the next unit that can act, `Esc` deselects.
- The game autosaves to the browser after every action. Use *Continue* on the menu to resume.

### Units (chess-like roles)

| Role | Glyph | Moves like | Humans | Elves | Orcs |
|---|---|---|---|---|---|
| Leader | ♚ | walks 2 to 3; its death loses the game | King | High Lord | Warchief |
| Champion | ♛ | walks, or charges in a straight line | Paladin | Bladedancer | Berserker |
| Heavy | ♜ | slides in straight lines only (rook) | War Chariot | Wind Rider | Boar Juggernaut |
| Cavalry | ♞ | leaps an exact distance over anything (knight) | Knight | Stag Rider (2 to 3) | Wolf Rider |
| Ranged | ♝ | walks 2, shoots at range (no retaliation) | Crossbowman (3) | Longbowman (4) | Spear Thrower (2) |
| Infantry | ♟ | walks 2 to 3 but never backwards (pawn); promotes on the enemy back row | Spearman | Glade Warden | Grunt |

### Races

- **Humans**: balanced. Spearmen get *phalanx* (+2 defense next to an ally). Villages heal Humans 1 extra HP.
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
(`.` plains, `=` road, `f` forest, `h` hills, `m` mountain, `~` water, `s` swamp, `v` village).
