import { Link } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';

const RUN_TIME = 45;
const PLAYER_RADIUS = 18;
const STAR_RADIUS = 11;
const COMET_RADIUS = 16;

function newGame(width, height) {
  return {
    mode: 'ready',
    width,
    height,
    score: 0,
    timeLeft: RUN_TIME,
    player: { x: width / 2, y: height * 0.72 },
    stars: [],
    comets: [],
    nextStar: 0,
    nextComet: 0.9,
    lastSnapshot: 0,
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function drawStar(ctx, x, y, radius, fill) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? radius : radius * 0.44;
    const px = Math.cos(angle) * r;
    const py = Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = '#fff8c8';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.restore();
}

function drawBackground(ctx, game) {
  const gradient = ctx.createLinearGradient(0, 0, 0, game.height);
  gradient.addColorStop(0, '#06131f');
  gradient.addColorStop(1, '#020509');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, game.width, game.height);

  ctx.fillStyle = 'rgba(255,255,255,0.58)';
  for (let i = 0; i < 56; i++) {
    const x = (i * 83) % game.width;
    const y = (i * 137) % game.height;
    const size = i % 4 === 0 ? 2 : 1;
    ctx.fillRect(x, y, size, size);
  }

  ctx.strokeStyle = 'rgba(87, 211, 255, 0.14)';
  ctx.lineWidth = 1;
  for (let y = game.height - 90; y < game.height; y += 18) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(game.width, y - 16);
    ctx.stroke();
  }
}

function drawPlayer(ctx, player) {
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.strokeStyle = '#75e4ff';
  ctx.fillStyle = 'rgba(117, 228, 255, 0.12)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -PLAYER_RADIUS);
  ctx.lineTo(PLAYER_RADIUS * 1.15, PLAYER_RADIUS * 0.9);
  ctx.lineTo(0, PLAYER_RADIUS * 0.42);
  ctx.lineTo(-PLAYER_RADIUS * 1.15, PLAYER_RADIUS * 0.9);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 1, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawComet(ctx, comet) {
  ctx.save();
  ctx.translate(comet.x, comet.y);
  ctx.rotate(comet.angle);
  ctx.fillStyle = 'rgba(255, 122, 71, 0.24)';
  ctx.beginPath();
  ctx.moveTo(-COMET_RADIUS * 2.4, 0);
  ctx.lineTo(-COMET_RADIUS * 0.4, -COMET_RADIUS * 0.7);
  ctx.lineTo(-COMET_RADIUS * 0.2, COMET_RADIUS * 0.7);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ff7a47';
  ctx.beginPath();
  ctx.arc(0, 0, COMET_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffd7b8';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

export function StarCatcherPage() {
  const canvasRef = useRef(null);
  const gameRef = useRef(newGame(960, 640));
  const keysRef = useRef(new Set());
  const pointerRef = useRef(null);
  const frameRef = useRef(0);
  const [snapshot, setSnapshot] = useState({
    mode: 'ready',
    score: 0,
    timeLeft: RUN_TIME,
  });

  const startGame = useCallback(() => {
    const { width, height } = gameRef.current;
    gameRef.current = newGame(width, height);
    gameRef.current.mode = 'playing';
    setSnapshot({ mode: 'playing', score: 0, timeLeft: RUN_TIME });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let lastTime = performance.now();

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = window.innerWidth;
      const height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const game = gameRef.current;
      game.width = width;
      game.height = height;
      game.player.x = clamp(game.player.x, PLAYER_RADIUS, width - PLAYER_RADIUS);
      game.player.y = clamp(game.player.y, PLAYER_RADIUS, height - PLAYER_RADIUS);
    };

    const pushSnapshot = (game, now) => {
      if (now - game.lastSnapshot < 120) return;
      game.lastSnapshot = now;
      setSnapshot({
        mode: game.mode,
        score: game.score,
        timeLeft: Math.max(0, Math.ceil(game.timeLeft)),
      });
    };

    const update = (game, dt) => {
      if (game.mode !== 'playing') return;

      game.timeLeft -= dt;
      if (game.timeLeft <= 0) {
        game.mode = 'over';
        setSnapshot({ mode: 'over', score: game.score, timeLeft: 0 });
        return;
      }

      const keys = keysRef.current;
      let vx = 0;
      let vy = 0;
      if (keys.has('ArrowLeft') || keys.has('KeyA')) vx -= 1;
      if (keys.has('ArrowRight') || keys.has('KeyD')) vx += 1;
      if (keys.has('ArrowUp') || keys.has('KeyW')) vy -= 1;
      if (keys.has('ArrowDown') || keys.has('KeyS')) vy += 1;
      const mag = Math.hypot(vx, vy) || 1;
      const speed = 390;
      game.player.x += (vx / mag) * speed * dt;
      game.player.y += (vy / mag) * speed * dt;

      if (pointerRef.current) {
        const target = pointerRef.current;
        const dx = target.x - game.player.x;
        const dy = target.y - game.player.y;
        const d = Math.hypot(dx, dy);
        if (d > 2) {
          const step = Math.min(speed * dt, d);
          game.player.x += (dx / d) * step;
          game.player.y += (dy / d) * step;
        }
      }

      game.player.x = clamp(game.player.x, PLAYER_RADIUS, game.width - PLAYER_RADIUS);
      game.player.y = clamp(game.player.y, PLAYER_RADIUS, game.height - PLAYER_RADIUS);

      game.nextStar -= dt;
      if (game.nextStar <= 0) {
        game.stars.push({
          x: STAR_RADIUS + Math.random() * (game.width - STAR_RADIUS * 2),
          y: -STAR_RADIUS,
          vy: 110 + Math.random() * 90,
          spin: Math.random() * Math.PI,
        });
        game.nextStar = 0.38 + Math.random() * 0.42;
      }

      game.nextComet -= dt;
      if (game.nextComet <= 0) {
        const left = Math.random() > 0.5;
        game.comets.push({
          x: left ? -COMET_RADIUS : game.width + COMET_RADIUS,
          y: 90 + Math.random() * (game.height * 0.58),
          vx: (left ? 1 : -1) * (150 + Math.random() * 130),
          vy: 45 + Math.random() * 75,
          angle: left ? 0.3 : Math.PI - 0.3,
        });
        game.nextComet = 1.25 + Math.random() * 1.1;
      }

      for (const star of game.stars) {
        star.y += star.vy * dt;
        star.spin += dt * 4;
      }
      for (const comet of game.comets) {
        comet.x += comet.vx * dt;
        comet.y += comet.vy * dt;
      }

      game.stars = game.stars.filter((star) => {
        if (distance(star, game.player) < PLAYER_RADIUS + STAR_RADIUS) {
          game.score += 10;
          return false;
        }
        return star.y < game.height + STAR_RADIUS;
      });

      game.comets = game.comets.filter((comet) => {
        if (distance(comet, game.player) < PLAYER_RADIUS + COMET_RADIUS) {
          game.score = Math.max(0, game.score - 15);
          comet.y = game.height + COMET_RADIUS * 2;
          return false;
        }
        return (
          comet.y < game.height + COMET_RADIUS * 2 &&
          comet.x > -COMET_RADIUS * 3 &&
          comet.x < game.width + COMET_RADIUS * 3
        );
      });
    };

    const draw = (game) => {
      drawBackground(ctx, game);
      for (const star of game.stars) {
        drawStar(ctx, star.x, star.y, STAR_RADIUS, '#ffd95c');
      }
      for (const comet of game.comets) {
        drawComet(ctx, comet);
      }
      drawPlayer(ctx, game.player);
    };

    const loop = (now) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      const game = gameRef.current;
      update(game, dt);
      draw(game);
      pushSnapshot(game, now);
      frameRef.current = requestAnimationFrame(loop);
    };

    const onKeyDown = (event) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
        event.preventDefault();
      }
      if (
        (event.code === 'Enter' || event.code === 'Space') &&
        gameRef.current.mode !== 'playing'
      ) {
        startGame();
        return;
      }
      keysRef.current.add(event.code);
    };

    const onKeyUp = (event) => {
      keysRef.current.delete(event.code);
    };

    const pointerFromEvent = (event) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    };

    const onPointerDown = (event) => {
      pointerRef.current = pointerFromEvent(event);
      canvas.setPointerCapture?.(event.pointerId);
    };

    const onPointerMove = (event) => {
      if (pointerRef.current) pointerRef.current = pointerFromEvent(event);
    };

    const onPointerUp = () => {
      pointerRef.current = null;
    };

    resize();
    window.addEventListener('resize', resize);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    frameRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener('resize', resize);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
    };
  }, [startGame]);

  return (
    <main className="game-route game-route--star-catcher">
      <nav className="game-chrome" data-game-chrome aria-label="Game navigation">
        <Link className="game-back" to="/">
          Games
        </Link>
        <span>Star Catcher</span>
      </nav>

      <canvas ref={canvasRef} className="star-catcher-canvas" aria-label="Star Catcher game" />

      <div className="star-hud" aria-live="polite">
        <span>Score {snapshot.score}</span>
        <span>Time {snapshot.timeLeft}</span>
      </div>

      {snapshot.mode !== 'playing' && (
        <section className="star-overlay" aria-labelledby="star-catcher-title">
          <p className="eyebrow">{snapshot.mode === 'over' ? 'Run complete' : 'Quick run'}</p>
          <h1 id="star-catcher-title">Star Catcher</h1>
          <p>
            {snapshot.mode === 'over'
              ? `Final score: ${snapshot.score}`
              : 'Collect stars before the timer ends.'}
          </p>
          <button className="start-button start-button--gold" type="button" onClick={startGame}>
            {snapshot.mode === 'over' ? 'PLAY AGAIN' : 'START'}
          </button>
        </section>
      )}
    </main>
  );
}
