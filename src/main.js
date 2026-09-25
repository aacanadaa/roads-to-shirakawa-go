import './ui/hud.css';
import { Game } from './core/Game.js';

const container = document.getElementById('app');
const game = new Game(container);
game.start();

window.__roadsGame = game;
