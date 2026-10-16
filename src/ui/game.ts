import { canAttack, attackRange, previewAttack, terrainDefense } from '../core/combat';
import { hexToPixel, key, pixelToHex, type Hex } from '../core/hex';
import { legalMoves, terrainCost } from '../core/movement';
import { applyAction, idleUnits } from '../core/rules';
import { defOf, getUnit, raceOf, terrainAt, unitAt } from '../core/state';
import type { Action, GameState, Movement, Unit } from '../core/types';
import { RACES, ROLE_GLYPH, ROLE_NAME } from '../data/races';
import { Camera } from '../render/camera';
import { drawBoard, HEX_SIZE, mapBounds, PLAYER_COLORS, type ViewState } from '../render/renderer';
import { el } from './dom';
import { clearSave, saveGame } from './storage';

function describeMovement(m: Movement): string {
  const parts: string[] = [];
  if (m.walk) parts.push(`walk ${m.walk}`);
  if (m.line) parts.push(`line ${m.line}`);
  if (m.jump) parts.push(m.jump[0] === m.jump[1] ? `jump ${m.jump[0]}` : `jump ${m.jump[0]}-${m.jump[1]}`);
  return parts.join(' or ') + (m.forwardOnly ? ' (forward only)' : '');
}

const pct = (n: number) => `${n >= 0 ? '+' : ''}${Math.round(n * 100)}%`;

export class GameView {
  private state: GameState;
  private view: ViewState = { selectedId: null, moves: new Set(), targets: new Set(), hover: null };
  private camera = new Camera();
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private hud: HTMLElement;
  private boardWrap: HTMLElement;
  private toastEl: HTMLElement;
  private overlay: HTMLElement;
  private frame = 0;
  private overlayDismissed = false;
  private cleanup: (() => void)[] = [];
  readonly root: HTMLElement;

  constructor(
    state: GameState,
    private onExit: () => void,
  ) {
    this.state = state;
    this.canvas = el('canvas', { id: 'board' });
    this.ctx = this.canvas.getContext('2d')!;
    this.hud = el('aside', { class: 'hud' });
    this.toastEl = el('div', { class: 'toast', style: { opacity: '0' } });
    this.overlay = el('div', { class: 'overlay hidden' });
    this.boardWrap = el('div', { class: 'board-wrap' }, this.canvas, this.toastEl, this.overlay);
    this.root = el('div', { class: 'game' }, this.boardWrap, this.hud);
  }

  mount(parent: HTMLElement): void {
    parent.append(this.root);
    this.bindInput();
    const ro = new ResizeObserver(() => this.resize(true));
    ro.observe(this.boardWrap);
    this.cleanup.push(() => ro.disconnect());
    this.resize(true);
    this.refresh();
    // Debug/test hook: lets automated browser tests locate hexes on screen.
    if (import.meta.env.DEV) {
      (window as unknown as { __hex: unknown }).__hex = {
        state: () => this.state,
        screenOf: (h: Hex) => {
          const p = this.camera.worldToScreen(hexToPixel(h, HEX_SIZE).x, hexToPixel(h, HEX_SIZE).y);
          const r = this.canvas.getBoundingClientRect();
          return { x: p.x + r.left, y: p.y + r.top };
        },
        moves: () => [...this.view.moves],
        targets: () => [...this.view.targets],
      };
    }
    if (this.state.winner === null) this.toast(`${this.playerLabel(this.state.current)} to move`);
  }

  destroy(): void {
    this.cleanup.forEach((f) => f());
    cancelAnimationFrame(this.frame);
    this.root.remove();
  }

  // ---------- state & actions ----------

  private dispatch(action: Action): void {
    try {
      this.state = applyAction(this.state, action);
    } catch (e) {
      this.toast((e as Error).message);
      return;
    }
    saveGame(this.state);
    if (action.type === 'endTurn') {
      this.select(null);
      this.toast(`${this.playerLabel(this.state.current)} to move`);
    } else {
      const sel = this.view.selectedId ? getUnit(this.state, this.view.selectedId) : undefined;
      this.select(sel && !sel.attacked ? sel.id : null);
    }
    this.refresh();
  }

  private select(id: string | null): void {
    this.view.selectedId = id;
    this.view.moves = new Set();
    this.view.targets = new Set();
    const unit = id ? getUnit(this.state, id) : undefined;
    if (!unit) {
      this.view.selectedId = null;
      return;
    }
    if (unit.owner === this.state.current && this.state.winner === null) {
      this.view.moves = legalMoves(this.state, unit);
      if (!unit.attacked) {
        for (const t of this.state.units) if (canAttack(this.state, unit, t)) this.view.targets.add(t.id);
      }
    }
  }

  private clickHex(h: Hex): void {
    if (this.state.winner !== null) return;
    const sel = this.view.selectedId ? getUnit(this.state, this.view.selectedId) : undefined;
    const target = unitAt(this.state, h);
    if (sel && target && this.view.targets.has(target.id)) {
      this.dispatch({ type: 'attack', unitId: sel.id, targetId: target.id });
      return;
    }
    if (sel && !target && this.view.moves.has(key(h))) {
      this.dispatch({ type: 'move', unitId: sel.id, to: h });
      return;
    }
    this.select(target && target.id !== sel?.id ? target.id : null);
    this.refresh();
  }

  private selectNextIdle(): void {
    const idle = idleUnits(this.state).filter(
      (u) => legalMoves(this.state, u).size > 0 || this.state.units.some((t) => canAttack(this.state, u, t)),
    );
    if (!idle.length) {
      this.toast('No units left to act - end your turn');
      return;
    }
    const i = idle.findIndex((u) => u.id === this.view.selectedId);
    this.select(idle[(i + 1) % idle.length].id);
    this.refresh();
  }

  // ---------- input ----------

  private bindInput(): void {
    const c = this.canvas;
    let down: { x: number; y: number; moved: boolean } | null = null;

    const local = (e: PointerEvent | WheelEvent) => {
      const r = c.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const hexAt = (x: number, y: number) => {
      const w = this.camera.screenToWorld(x, y);
      return pixelToHex(w.x, w.y, HEX_SIZE);
    };

    const onDown = (e: PointerEvent) => {
      down = { ...local(e), moved: false };
      c.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      const p = local(e);
      if (down) {
        const dx = p.x - down.x;
        const dy = p.y - down.y;
        if (down.moved || Math.hypot(dx, dy) > 6) {
          down.moved = true;
          this.camera.pan(dx, dy);
          down.x = p.x;
          down.y = p.y;
          this.render();
          return;
        }
      }
      const h = hexAt(p.x, p.y);
      if (!this.view.hover || key(this.view.hover) !== key(h)) {
        this.view.hover = this.state.tiles[key(h)] ? h : null;
        this.refresh();
      }
    };
    const onUp = (e: PointerEvent) => {
      if (down && !down.moved) {
        const p = local(e);
        this.clickHex(hexAt(p.x, p.y));
      }
      down = null;
    };
    const onLeave = () => {
      this.view.hover = null;
      this.refresh();
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = local(e);
      this.camera.zoomAt(p.x, p.y, e.deltaY < 0 ? 1.12 : 1 / 1.12);
      this.render();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'e' || e.key === 'E') this.endTurn();
      else if (e.key === 'n' || e.key === 'N' || e.key === 'Tab') {
        e.preventDefault();
        this.selectNextIdle();
      } else if (e.key === 'Escape') {
        this.select(null);
        this.refresh();
      }
    };

    c.addEventListener('pointerdown', onDown);
    c.addEventListener('pointermove', onMove);
    c.addEventListener('pointerup', onUp);
    c.addEventListener('pointerleave', onLeave);
    c.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);
    this.cleanup.push(() => window.removeEventListener('keydown', onKey));
  }

  private endTurn(): void {
    if (this.state.winner === null) this.dispatch({ type: 'endTurn' });
  }

  private resize(refit: boolean): void {
    const r = this.boardWrap.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.max(1, Math.round(r.width * dpr));
    this.canvas.height = Math.max(1, Math.round(r.height * dpr));
    if (refit) this.camera.fit(mapBounds(this.state), r.width, r.height);
    this.render();
  }

  // ---------- drawing ----------

  private refresh(): void {
    this.render();
    this.renderHud();
    this.renderOverlay();
  }

  private render(): void {
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => {
      const dpr = window.devicePixelRatio || 1;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawBoard(this.ctx, this.state, this.view, this.camera, this.canvas.width / dpr, this.canvas.height / dpr);
    });
  }

  private playerLabel(p: number): string {
    return `${this.state.players[p].name} (${RACES[this.state.players[p].race].name})`;
  }

  private toast(msg: string): void {
    this.toastEl.textContent = msg;
    this.toastEl.style.opacity = '1';
    clearTimeout((this.toastEl as unknown as { t?: number }).t);
    (this.toastEl as unknown as { t?: number }).t = window.setTimeout(() => (this.toastEl.style.opacity = '0'), 1800);
  }

  private unitCard(unit: Unit): HTMLElement {
    const def = defOf(unit);
    const race = raceOf(this.state, unit);
    const [minR, maxR] = attackRange(this.state, unit);
    const status =
      unit.owner !== this.state.current ? '' : unit.attacked ? 'Done' : unit.moved ? 'Can still attack' : 'Ready';
    return el(
      'div',
      { class: 'unit-card', style: { borderLeft: `5px solid ${PLAYER_COLORS[unit.owner]}` } },
      el('div', { class: 'title' }, `${ROLE_GLYPH[def.role]} ${def.name}`),
      el('div', { class: 'muted' }, `${race.name} ${ROLE_NAME[def.role]} · P${unit.owner + 1}${status ? ' · ' + status : ''}`),
      el(
        'div',
        { class: 'stats' },
        el('div', {}, `HP ${unit.hp}/${def.maxHp}`),
        el('div', {}, `ATK ${def.attack}`),
        el('div', {}, `DEF ${def.defense}`),
      ),
      el('div', {}, `Move: ${describeMovement(def.movement)}`),
      el('div', {}, `Range: ${minR === maxR ? minR : `${minR}-${maxR}`}`),
      def.abilities?.length ? el('div', {}, `Abilities: ${def.abilities.join(', ')}`) : null,
      el('div', { class: 'muted' }, def.description),
    );
  }

  private renderHud(): void {
    const s = this.state;
    const cur = s.players[s.current];
    const sel = this.view.selectedId ? getUnit(s, this.view.selectedId) : undefined;
    const hoverUnit = this.view.hover ? unitAt(s, this.view.hover) : undefined;
    const hoverTerrain = this.view.hover ? terrainAt(s, this.view.hover) : undefined;

    const parts: (HTMLElement | null)[] = [];
    parts.push(
      el(
        'div',
        { class: 'turn-banner', style: { background: PLAYER_COLORS[s.current] } },
        s.winner !== null ? `Victory: ${this.playerLabel(s.winner)}` : `Turn ${s.turn} · ${cur.name} — ${RACES[cur.race].name}`,
      ),
    );

    if (sel) parts.push(this.unitCard(sel));

    if (sel && hoverUnit && this.view.targets.has(hoverUnit.id)) {
      const p = previewAttack(s, sel, hoverUnit);
      parts.push(
        el(
          'div',
          { class: 'unit-card preview' },
          el('div', { class: 'title' }, `Attack ${defOf(hoverUnit).name}`),
          el('div', {}, `Deal ${p.damage} damage${p.kills ? ' — kills!' : ` (${hoverUnit.hp - p.damage} HP left)`}`),
          el('div', {}, p.counter ? `Take ${p.counter} in return${p.counterKills ? ' — fatal!' : ''}` : 'No retaliation'),
          p.notes.length ? el('div', { class: 'muted' }, `Modifiers: ${p.notes.join(', ')}`) : null,
        ),
      );
    } else if (hoverUnit && hoverUnit.id !== sel?.id) {
      parts.push(this.unitCard(hoverUnit));
    }

    if (hoverTerrain && this.view.hover) {
      const cost =
        sel ? terrainCost(s, sel, hoverTerrain.id) : hoverTerrain.moveCost;
      const def = hoverUnit ? terrainDefense(s, hoverUnit) : hoverTerrain.defense;
      parts.push(
        el(
          'div',
          { class: 'unit-card' },
          el('div', { class: 'title' }, hoverTerrain.name),
          el(
            'div',
            {},
            `Move cost ${cost === Infinity ? 'impassable' : cost}${sel ? ` for ${defOf(sel).name}` : ''} · Defense ${pct(def)}`,
          ),
          el('div', { class: 'muted' }, hoverTerrain.description),
        ),
      );
    }

    if (!sel && !hoverTerrain) {
      parts.push(
        el(
          'div',
          { class: 'unit-card muted' },
          'Click a unit to select it. Blue hexes: moves. Red outline: attack targets. Drag to pan, scroll to zoom. ',
          'Keys: E end turn · N next unit · Esc deselect.',
        ),
      );
    }

    parts.push(
      el(
        'div',
        { class: 'hud-buttons' },
        el('button', { class: 'primary', onclick: () => this.endTurn(), disabled: s.winner !== null }, 'End turn (E)'),
        el('button', { onclick: () => this.selectNextIdle() }, 'Next unit (N)'),
        el('button', { onclick: () => this.onExit() }, 'Menu'),
      ),
    );

    const remaining = (p: number) => s.units.filter((u) => u.owner === p).length;
    parts.push(
      el(
        'div',
        { class: 'muted' },
        `${s.mapName} · P1 ${remaining(0)} units · P2 ${remaining(1)} units`,
      ),
    );
    parts.push(el('div', { class: 'log' }, ...s.log.slice(-40).reverse().map((line) => el('div', {}, line))));

    this.hud.replaceChildren(...parts.filter((p): p is HTMLElement => p !== null));
  }

  private renderOverlay(): void {
    if (this.state.winner === null || this.overlayDismissed) {
      this.overlay.classList.add('hidden');
      return;
    }
    const w = this.state.winner;
    this.overlay.classList.remove('hidden');
    this.overlay.replaceChildren(
      el(
        'div',
        { class: 'card' },
        el('h2', { style: { color: PLAYER_COLORS[w] } }, `${this.playerLabel(w)} wins!`),
        el('div', { class: 'muted' }, `After ${this.state.turn} turns on ${this.state.mapName}.`),
        el(
          'button',
          {
            class: 'primary',
            onclick: () => {
              clearSave();
              this.onExit();
            },
          },
          'New battle',
        ),
        el(
          'button',
          {
            onclick: () => {
              this.overlayDismissed = true;
              this.renderOverlay();
            },
          },
          'View board',
        ),
      ),
    );
  }
}
