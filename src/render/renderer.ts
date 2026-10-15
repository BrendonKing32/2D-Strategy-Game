import { hexCorners, hexToPixel, key, neighbors, parseKey, type Hex } from '../core/hex';
import { defOf } from '../core/state';
import type { GameState, TerrainId, Unit } from '../core/types';
import { RACES, ROLE_GLYPH } from '../data/races';
import { TERRAIN } from '../data/terrain';
import type { Bounds, Camera } from './camera';

export const HEX_SIZE = 36;
export const PLAYER_COLORS = ['#2f6fd6', '#d23b30'];

export interface ViewState {
  selectedId: string | null;
  moves: Set<string>;
  targets: Set<string>;
  hover: Hex | null;
}

export function mapBounds(state: GameState, size = HEX_SIZE): Bounds {
  const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const k of Object.keys(state.tiles)) {
    const p = hexToPixel(parseKey(k), size);
    b.minX = Math.min(b.minX, p.x - size);
    b.minY = Math.min(b.minY, p.y - size);
    b.maxX = Math.max(b.maxX, p.x + size);
    b.maxY = Math.max(b.maxY, p.y + size);
  }
  return b;
}

/** Cheap stable per-hex pseudo-random value so decorations don't flicker. */
function hash(h: Hex, salt = 0): number {
  let x = (h.q * 374761393 + h.r * 668265263 + salt * 2147483647) | 0;
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

function hexPath(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  const pts = hexCorners(x, y, size);
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < 6; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
}

function drawDecoration(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  h: Hex,
  t: TerrainId,
  x: number,
  y: number,
  s: number,
): void {
  switch (t) {
    case 'forest': {
      ctx.fillStyle = '#2a5a27';
      const spots = [
        [-0.35, 0.1],
        [0.3, 0.15],
        [0, -0.3],
        [-0.05, 0.42],
      ];
      for (const [dx, dy] of spots) {
        const tx = x + dx * s + (hash(h, dx) - 0.5) * s * 0.15;
        const ty = y + dy * s;
        ctx.beginPath();
        ctx.moveTo(tx, ty - s * 0.32);
        ctx.lineTo(tx - s * 0.18, ty + s * 0.08);
        ctx.lineTo(tx + s * 0.18, ty + s * 0.08);
        ctx.fill();
      }
      break;
    }
    case 'hills': {
      ctx.strokeStyle = '#8a7440';
      ctx.lineWidth = s * 0.07;
      for (const [dx, dy, r] of [
        [-0.3, 0.2, 0.3],
        [0.25, -0.1, 0.35],
      ]) {
        ctx.beginPath();
        ctx.arc(x + dx * s, y + dy * s + r * s, r * s, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
      }
      break;
    }
    case 'mountain': {
      ctx.fillStyle = '#5f5a55';
      ctx.beginPath();
      ctx.moveTo(x - s * 0.6, y + s * 0.4);
      ctx.lineTo(x - s * 0.1, y - s * 0.5);
      ctx.lineTo(x + s * 0.45, y + s * 0.4);
      ctx.fill();
      ctx.fillStyle = '#f2f2f2';
      ctx.beginPath();
      ctx.moveTo(x - s * 0.1, y - s * 0.5);
      ctx.lineTo(x - s * 0.27, y - s * 0.19);
      ctx.lineTo(x + s * 0.06, y - s * 0.22);
      ctx.fill();
      break;
    }
    case 'water': {
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = s * 0.05;
      for (const dy of [-0.2, 0.2]) {
        ctx.beginPath();
        for (let i = 0; i <= 8; i++) {
          const px = x - s * 0.45 + (i / 8) * s * 0.9;
          const py = y + dy * s + Math.sin(i + hash(h) * 6) * s * 0.06;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      break;
    }
    case 'swamp': {
      ctx.strokeStyle = '#3f5030';
      ctx.lineWidth = s * 0.05;
      for (let i = 0; i < 5; i++) {
        const px = x + (hash(h, i) - 0.5) * s * 1.0;
        const py = y + (hash(h, i + 9) - 0.5) * s * 0.9;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px - s * 0.06, py - s * 0.18);
        ctx.moveTo(px, py);
        ctx.lineTo(px + s * 0.06, py - s * 0.18);
        ctx.stroke();
      }
      break;
    }
    case 'road':
    case 'village': {
      // Connect to neighbouring roads / villages.
      ctx.strokeStyle = '#b39c62';
      ctx.lineWidth = s * 0.22;
      ctx.lineCap = 'round';
      let linked = false;
      for (const n of neighbors(h)) {
        const nt = state.tiles[key(n)];
        if (nt !== 'road' && nt !== 'village') continue;
        if (t === 'village' && nt === 'village') continue;
        const np = hexToPixel(n, s);
        const origin = hexToPixel(h, s);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (np.x - origin.x) / 2, y + (np.y - origin.y) / 2);
        ctx.stroke();
        linked = true;
      }
      if (t === 'road' && !linked) {
        ctx.beginPath();
        ctx.arc(x, y, s * 0.15, 0, Math.PI * 2);
        ctx.fillStyle = '#b39c62';
        ctx.fill();
      }
      if (t === 'village') {
        for (const [dx, dy] of [
          [-0.28, 0.05],
          [0.22, -0.15],
          [0.12, 0.32],
        ]) {
          const hx = x + dx * s;
          const hy = y + dy * s;
          ctx.fillStyle = '#f3e3c4';
          ctx.fillRect(hx - s * 0.13, hy - s * 0.08, s * 0.26, s * 0.18);
          ctx.fillStyle = '#9b3b2a';
          ctx.beginPath();
          ctx.moveTo(hx - s * 0.17, hy - s * 0.08);
          ctx.lineTo(hx, hy - s * 0.24);
          ctx.lineTo(hx + s * 0.17, hy - s * 0.08);
          ctx.fill();
        }
      }
      break;
    }
    case 'plains': {
      ctx.fillStyle = 'rgba(70,110,40,0.35)';
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(x + (hash(h, i) - 0.5) * s, y + (hash(h, i + 5) - 0.5) * s, s * 0.05, s * 0.12);
      }
      break;
    }
  }
}

function drawUnit(ctx: CanvasRenderingContext2D, state: GameState, unit: Unit, s: number, selected: boolean): void {
  const def = defOf(unit);
  const race = RACES[def.race];
  const { x, y } = hexToPixel(unit.pos, s);
  const exhausted = unit.owner === state.current && unit.attacked;
  const r = s * 0.6;

  ctx.save();
  ctx.globalAlpha = exhausted ? 0.55 : 1;

  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.85, r * 0.85, r * 0.3, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = PLAYER_COLORS[unit.owner];
  ctx.fill();
  ctx.lineWidth = s * 0.12;
  ctx.strokeStyle = race.color;
  ctx.stroke();
  if (selected) {
    ctx.lineWidth = s * 0.07;
    ctx.strokeStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x, y, r + s * 0.12, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = '#fff';
  ctx.font = `${Math.round(s * 0.78)}px "Segoe UI Symbol", "DejaVu Sans", "Noto Sans Symbols 2", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ROLE_GLYPH[def.role], x, y + s * 0.03);

  // HP bar
  const w = s * 1.1;
  const bh = s * 0.14;
  const bx = x - w / 2;
  const by = y + r + s * 0.05;
  const frac = Math.max(0, unit.hp / def.maxHp);
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(bx, by, w, bh);
  ctx.fillStyle = frac > 0.6 ? '#4cd964' : frac > 0.3 ? '#ffcc00' : '#ff3b30';
  ctx.fillRect(bx + 1, by + 1, (w - 2) * frac, bh - 2);
  ctx.restore();
}

export function drawBoard(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  view: ViewState,
  camera: Camera,
  width: number,
  height: number,
): void {
  const s = HEX_SIZE;
  ctx.save();
  ctx.fillStyle = '#1c2230';
  ctx.fillRect(0, 0, width, height);
  ctx.translate(camera.x, camera.y);
  ctx.scale(camera.zoom, camera.zoom);

  for (const [k, t] of Object.entries(state.tiles)) {
    const h = parseKey(k);
    const { x, y } = hexToPixel(h, s);
    hexPath(ctx, x, y, s);
    ctx.fillStyle = TERRAIN[t].color;
    ctx.fill();
    ctx.save();
    ctx.clip();
    drawDecoration(ctx, state, h, t, x, y, s);
    ctx.restore();
    hexPath(ctx, x, y, s);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.stroke();
  }

  for (const k of view.moves) {
    const { x, y } = hexToPixel(parseKey(k), s);
    hexPath(ctx, x, y, s * 0.92);
    ctx.fillStyle = 'rgba(90,170,255,0.38)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(200,230,255,0.8)';
    ctx.stroke();
  }

  if (view.hover && state.tiles[key(view.hover)]) {
    const { x, y } = hexToPixel(view.hover, s);
    hexPath(ctx, x, y, s * 0.96);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.stroke();
  }

  for (const unit of state.units) drawUnit(ctx, state, unit, s, unit.id === view.selectedId);

  for (const unit of state.units) {
    if (!view.targets.has(unit.id)) continue;
    const { x, y } = hexToPixel(unit.pos, s);
    hexPath(ctx, x, y, s * 0.92);
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#ff4d3d';
    ctx.stroke();
  }

  ctx.restore();
}
