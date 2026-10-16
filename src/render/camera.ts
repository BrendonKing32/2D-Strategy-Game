export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Maps world coordinates (hex pixel space) to CSS-pixel screen coordinates. */
export class Camera {
  x = 0;
  y = 0;
  zoom = 1;

  worldToScreen(wx: number, wy: number): { x: number; y: number } {
    return { x: wx * this.zoom + this.x, y: wy * this.zoom + this.y };
  }

  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return { x: (sx - this.x) / this.zoom, y: (sy - this.y) / this.zoom };
  }

  fit(b: Bounds, width: number, height: number, padding = 24): void {
    const w = b.maxX - b.minX;
    const h = b.maxY - b.minY;
    this.zoom = Math.min((width - padding * 2) / w, (height - padding * 2) / h);
    this.x = (width - w * this.zoom) / 2 - b.minX * this.zoom;
    this.y = (height - h * this.zoom) / 2 - b.minY * this.zoom;
  }

  pan(dx: number, dy: number): void {
    this.x += dx;
    this.y += dy;
  }

  zoomAt(sx: number, sy: number, factor: number): void {
    const next = Math.min(4, Math.max(0.3, this.zoom * factor));
    const world = this.screenToWorld(sx, sy);
    this.zoom = next;
    this.x = sx - world.x * next;
    this.y = sy - world.y * next;
  }
}
