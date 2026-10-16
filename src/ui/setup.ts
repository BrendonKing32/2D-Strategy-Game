import { createGame } from '../core/rules';
import type { GameState, RaceId } from '../core/types';
import { getMap, MAPS } from '../data/maps';
import { RACES } from '../data/races';
import { Camera } from '../render/camera';
import { drawBoard, emptyView, mapBounds, PLAYER_COLORS } from '../render/renderer';
import { el } from './dom';
import { loadGame } from './storage';

export function renderSetup(parent: HTMLElement, onStart: (state: GameState) => void): () => void {
  const choice = {
    races: ['humans', 'orcs'] as [RaceId, RaceId],
    mapId: MAPS[0].id,
    seed: Math.floor(Math.random() * 10000),
  };

  const preview = el('canvas', { class: 'map-preview' });
  const mapDesc = el('div', { class: 'muted' });
  const mapButtons = el('div', { class: 'map-options' });
  const seedInput = el('input', { type: 'number', value: String(choice.seed), min: '0' });
  const seedRow = el(
    'div',
    { class: 'seed' },
    'Seed',
    seedInput,
    el(
      'button',
      {
        onclick: () => {
          choice.seed = Math.floor(Math.random() * 10000);
          seedInput.value = String(choice.seed);
          update();
        },
      },
      'Reroll',
    ),
  );
  seedInput.addEventListener('input', () => {
    choice.seed = Number(seedInput.value) || 0;
    update();
  });

  const playerCards = [0, 1].map((p) => {
    const options = el('div', { class: 'race-options' });
    const card = el(
      'div',
      { class: 'card', style: { borderTop: `4px solid ${PLAYER_COLORS[p]}` } },
      el('h3', {}, `Player ${p + 1}`, el('span', { class: 'muted' }, p === 0 ? ' · moves first, bottom' : ' · top')),
      options,
    );
    return { card, options };
  });

  const buildState = () => createGame(getMap(choice.mapId, choice.seed), choice.races);

  function update(): void {
    playerCards.forEach(({ options }, p) => {
      options.replaceChildren(
        ...Object.values(RACES).map((race) =>
          el(
            'button',
            {
              class: `race-option${choice.races[p] === race.id ? ' selected' : ''}`,
              onclick: () => {
                choice.races[p] = race.id;
                update();
              },
            },
            el('strong', {}, race.name),
            el('small', {}, race.description),
          ),
        ),
      );
      // CSS custom properties are not applied by Object.assign on style; set explicitly.
      options.querySelectorAll<HTMLElement>('.race-option').forEach((b, i) => {
        b.style.setProperty('--race', Object.values(RACES)[i].color);
      });
    });

    mapButtons.replaceChildren(
      ...[...MAPS, { id: 'random', name: 'Random', description: '' }].map((m) =>
        el(
          'button',
          {
            class: choice.mapId === m.id ? 'selected' : '',
            onclick: () => {
              choice.mapId = m.id;
              update();
            },
          },
          m.name,
        ),
      ),
    );
    seedRow.classList.toggle('hidden', choice.mapId !== 'random');
    const map = getMap(choice.mapId, choice.seed);
    mapDesc.textContent = map.description;
    drawPreview(buildState());
  }

  function drawPreview(state: GameState): void {
    const rect = preview.getBoundingClientRect();
    const w = rect.width || 480;
    const h = rect.height || 360;
    const dpr = window.devicePixelRatio || 1;
    preview.width = Math.round(w * dpr);
    preview.height = Math.round(h * dpr);
    const ctx = preview.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cam = new Camera();
    cam.fit(mapBounds(state), w, h, 8);
    drawBoard(ctx, state, emptyView(), cam, w, h);
  }

  const saved = loadGame();
  const root = el(
    'div',
    { class: 'setup' },
    el(
      'div',
      { class: 'setup-inner' },
      el(
        'header',
        {},
        el('h1', {}, '⬢ Warfields'),
        el('div', { class: 'muted' }, 'A turn-based hex strategy game for two players on one screen.'),
      ),
      el('div', { class: 'players' }, ...playerCards.map((c) => c.card)),
      el(
        'div',
        { class: 'card map-row' },
        el('div', {}, el('h3', {}, 'Battlefield'), mapButtons, seedRow, el('p', {}, mapDesc)),
        preview,
      ),
      el(
        'div',
        { class: 'actions' },
        el('button', { class: 'primary', onclick: () => onStart(buildState()) }, 'Start battle'),
        saved && saved.winner === null
          ? el('button', { onclick: () => onStart(saved) }, `Continue saved game (${saved.mapName}, turn ${saved.turn})`)
          : null,
      ),
      el(
        'div',
        { class: 'card' },
        el('h3', {}, 'How to play'),
        el(
          'ul',
          { class: 'rules-list' },
          el('li', {}, 'You start with a home base, your Leader (♚) and 300 gold. Build your army as you go.'),
          el('li', {}, 'Each base you own pays 100 gold at the start of your turn.'),
          el(
            'li',
            {},
            'Click one of your empty bases to recruit: one unit per base per turn. Recruits appear on the base and act next turn.',
          ),
          el(
            'li',
            {},
            'Capture a neutral or enemy base by ending your turn on it: it flips at the start of your next turn if you are still there.',
          ),
          el('li', {}, 'Win by taking every base your opponent owns. A player with no bases is out.'),
          el('li', {}, 'Each turn, every unit may move once and then attack once. Attacking ends that unit’s turn.'),
          el(
            'li',
            {},
            'Units move like chess pieces: ♟ infantry only advance, ♞ cavalry leap, ♜ heavies slide in straight lines, ♛ champions walk or charge, ♝ ranged units shoot.',
          ),
          el(
            'li',
            {},
            'Terrain matters: forests and mountains block sight, hills extend range, villages and bases heal, swamps stop you, roads speed you up.',
          ),
          el(
            'li',
            {},
            'Stepping next to an enemy ends your move (zone of control). Melee attacks are answered with a half-strength counter; ranged shots are not. Flanking and Leaders add damage.',
          ),
        ),
      ),
    ),
  );

  parent.append(root);
  const ro = new ResizeObserver(() => drawPreview(buildState()));
  ro.observe(preview);
  update();
  return () => {
    ro.disconnect();
    root.remove();
  };
}
