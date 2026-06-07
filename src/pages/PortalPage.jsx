import { Link, useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { GamePreview } from '../components/GamePreview.jsx';
import { games } from '../data/games.js';

export function PortalPage() {
  const navigate = useNavigate();
  const [selectedGame, setSelectedGame] = useState(0);
  const playLinksRef = useRef([]);
  const selectedGameRef = useRef(0);
  const lastInputRef = useRef(0);
  const lastButtonsRef = useRef(new Set());

  const selectGame = useCallback((nextIndex, focusLink = true) => {
    const boundedIndex = (nextIndex + games.length) % games.length;
    selectedGameRef.current = boundedIndex;
    setSelectedGame(boundedIndex);
    if (focusLink) {
      playLinksRef.current[boundedIndex]?.focus();
    }
  }, []);

  const launchSelectedGame = useCallback(() => {
    const game = games[selectedGameRef.current];
    if (game) {
      navigate({ to: game.path });
    }
  }, [navigate]);

  const moveByGrid = useCallback(
    (direction) => {
      const selectedLink = playLinksRef.current[selectedGameRef.current];
      const selectedCard = selectedLink?.closest('.game-card');
      const grid = selectedCard?.parentElement;
      const columns = grid
        ? getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length
        : 1;

      const deltaByDirection = {
        left: -1,
        right: 1,
        up: -columns,
        down: columns,
      };

      selectGame(selectedGameRef.current + deltaByDirection[direction]);
    },
    [selectGame]
  );

  useEffect(() => {
    const onKeyDown = (event) => {
      const directions = {
        ArrowLeft: 'left',
        ArrowRight: 'right',
        ArrowUp: 'up',
        ArrowDown: 'down',
      };
      const direction = directions[event.code];
      if (direction) {
        event.preventDefault();
        moveByGrid(direction);
        return;
      }

      if (event.code === 'Enter' || event.code === 'Space') {
        event.preventDefault();
        launchSelectedGame();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [launchSelectedGame, moveByGrid]);

  useEffect(() => {
    let frameId = 0;

    const tick = (timestamp) => {
      const gamepads = navigator.getGamepads
        ? Array.from(navigator.getGamepads()).filter(Boolean)
        : [];
      const gamepad = gamepads.find((pad) => pad.connected);

      if (gamepad) {
        const pressedButtons = new Set();
        gamepad.buttons.forEach((button, index) => {
          if (button.pressed) pressedButtons.add(index);
        });

        const isFreshButton = (index) =>
          pressedButtons.has(index) && !lastButtonsRef.current.has(index);

        const horizontal = gamepad.axes[0] || 0;
        const vertical = gamepad.axes[1] || 0;
        const inputReady = timestamp - lastInputRef.current > 180;

        if (inputReady) {
          if (horizontal < -0.55 || pressedButtons.has(14)) {
            moveByGrid('left');
            lastInputRef.current = timestamp;
          } else if (horizontal > 0.55 || pressedButtons.has(15)) {
            moveByGrid('right');
            lastInputRef.current = timestamp;
          } else if (vertical < -0.55 || pressedButtons.has(12)) {
            moveByGrid('up');
            lastInputRef.current = timestamp;
          } else if (vertical > 0.55 || pressedButtons.has(13)) {
            moveByGrid('down');
            lastInputRef.current = timestamp;
          }
        }

        if (isFreshButton(0) || isFreshButton(9)) {
          launchSelectedGame();
        }

        lastButtonsRef.current = pressedButtons;
      } else {
        lastButtonsRef.current = new Set();
      }

      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [launchSelectedGame, moveByGrid]);

  return (
    <main className="portal-shell">
      <header className="portal-header">
        <div>
          <p className="eyebrow">Clean Arcade</p>
          <h1>Pick a game.</h1>
        </div>
        <div className="portal-summary">
          <span>{games.length} games</span>
          <span>Keyboard ready</span>
          <span>Controller ready</span>
          <span>Family table play</span>
        </div>
      </header>

      <section className="game-grid" aria-label="Available games">
        {games.map((game, index) => (
          <article
            className={`game-card game-card--${game.accent}`}
            data-selected={selectedGame === index}
            key={game.id}
            onMouseEnter={() => selectGame(index, false)}
          >
            <GamePreview type={game.thumbnail} />
            <div className="game-card__content">
              <div className="game-card__meta">
                <span>{game.players}</span>
                <span>{game.pace}</span>
              </div>
              <h2>{game.title}</h2>
              <p>{game.blurb}</p>
              <Link
                className="button button--primary"
                onFocus={() => selectGame(index, false)}
                ref={(node) => {
                  playLinksRef.current[index] = node;
                }}
                to={game.path}
              >
                Play
              </Link>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
