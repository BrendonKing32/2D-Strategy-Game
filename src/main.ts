import './style.css';
import type { GameState } from './core/types';
import { GameView } from './ui/game';
import { renderSetup } from './ui/setup';
import { saveGame } from './ui/storage';

const app = document.getElementById('app')!;

function showSetup(): void {
  const close = renderSetup(app, (state) => {
    close();
    startGame(state);
  });
}

function startGame(state: GameState): void {
  saveGame(state);
  const view = new GameView(state, () => {
    view.destroy();
    showSetup();
  });
  view.mount(app);
}

showSetup();
