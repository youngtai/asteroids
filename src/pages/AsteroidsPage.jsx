import { Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { loadAsteroidsGame } from '../lib/asteroidsLoader.js';

export function AsteroidsPage() {
  const [loadState, setLoadState] = useState('loading');

  useEffect(() => {
    let dispose = null;
    let cancelled = false;

    loadAsteroidsGame()
      .then((mountAsteroidsGame) => {
        if (cancelled) return;
        dispose = mountAsteroidsGame();
        setLoadState('ready');
      })
      .catch(() => {
        if (!cancelled) setLoadState('error');
      });

    return () => {
      cancelled = true;
      if (dispose) dispose();
      else if (window.unmountAsteroidsGame) window.unmountAsteroidsGame();
    };
  }, []);

  return (
    <main className="game-route game-route--asteroids">
      <nav className="game-chrome" data-game-chrome aria-label="Game navigation">
        <Link className="game-back" to="/">
          Games
        </Link>
        <span>Asteroids</span>
      </nav>

      {loadState === 'loading' && (
        <div className="game-loader" role="status">
          Loading Asteroids
        </div>
      )}

      {loadState === 'error' && (
        <div className="game-loader game-loader--error" role="alert">
          Asteroids could not load.
        </div>
      )}

      <div className="asteroids-game" aria-label="Asteroids game" role="application">
        <canvas id="game" />

        <div id="hud">
          <div id="hud-players" />
          <div className="center">
            <div>
              ROUND <span id="hud-round">1</span>
            </div>
            <div id="hud-boss-status">BOSS 1/3</div>
            <div id="hud-pause" style={{ opacity: 0 }}>
              PAUSED
            </div>
          </div>
          <div />
        </div>

        <div className="overlay" id="start-overlay">
          <h1>ASTEROIDS</h1>
          <fieldset className="player-select" id="player-select">
            <legend className="sr-only">Player count</legend>
            <button type="button" data-players="1">
              1P
            </button>
            <button type="button" data-players="2" className="selected">
              2P
            </button>
            <button type="button" data-players="3">
              3P
            </button>
            <button type="button" data-players="4">
              4P
            </button>
          </fieldset>
          <p>P1: WASD + Space &middot; P2: Arrows + Enter</p>
          <p className="sub">P3: IJKL + U &middot; P4: TFGH + Y</p>
          <p className="sub">
            Gamepad: Left Stick = Steer &middot; B = Thrust &middot; A / RT = Fire &middot; LT =
            Missile
          </p>
          <p className="sub">D-pad = Keyboard fallback &middot; Start = Menu</p>
          <p className="sub">Press 1-4 to choose players</p>
          <p className="sub start-note">P = pause &middot; R = restart</p>
          <button type="button" className="start-button" id="start-button">
            START
          </button>
          <p className="sub start-after">Press any key / Start button to start</p>
          <p className="sub start-note">Defeat five motherships to clear each round</p>
          <div className="sub gp-status" id="gp-status" />
        </div>

        <div className="overlay hidden" id="gameover-overlay">
          <h1>GAME OVER</h1>
          <p id="final-player-scores" />
          <p>
            Total: <span id="final-score">0</span>
          </p>
          <p className="sub">Press R / Start button to restart</p>
        </div>

        <div className="overlay hidden" id="paused-overlay">
          <h1>PAUSED</h1>
          <p className="sub">Press P to resume</p>
        </div>

        <div className="overlay hidden" id="round-overlay">
          <h1>ROUND CLEAR</h1>
          <p>Next round incoming</p>
          <p className="sub">Press Space / Enter / Start to continue</p>
        </div>
      </div>
    </main>
  );
}
