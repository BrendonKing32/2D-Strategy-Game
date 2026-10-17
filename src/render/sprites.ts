import type { Readiness } from '../core/rules';
import { RACES } from '../data/races';

/** How dark a unit is drawn once it has used part or all of its turn. */
export const READINESS_SHADE: Record<Readiness, number> = { ready: 0, partial: 0.32, spent: 0.62 };

/**
 * Unit art, keyed by unit def id (e.g. `orcs.cavalry`), with one pre-shaded copy per readiness
 * state. Files live in `public/units/<id>.webp`.
 */
const sprites = new Map<string, Record<Readiness, CanvasImageSource & { width: number; height: number }>>();
let started = false;
let listener: () => void = () => {};

function shaded(img: HTMLImageElement, alpha: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  // Darken only the opaque pixels, so the transparent surround stays clear.
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = `rgba(12,14,20,${alpha})`;
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

/**
 * Start loading every unit sprite once. `onLoad` fires as each one arrives so the board
 * can redraw; until then (or if a file is missing) units fall back to their glyph.
 * Calling it again (a new game view) just replaces the callback.
 */
export function loadUnitSprites(onLoad: () => void): void {
  listener = onLoad;
  if (started) return;
  started = true;
  for (const race of Object.values(RACES)) {
    for (const def of Object.values(race.units)) {
      const img = new Image();
      img.onload = () => {
        sprites.set(def.id, {
          ready: img,
          partial: shaded(img, READINESS_SHADE.partial),
          spent: shaded(img, READINESS_SHADE.spent),
        });
        listener();
      };
      img.src = `${import.meta.env.BASE_URL}units/${def.id}.webp`;
    }
  }
}

export const unitSprite = (defId: string, readiness: Readiness) => sprites.get(defId)?.[readiness];
