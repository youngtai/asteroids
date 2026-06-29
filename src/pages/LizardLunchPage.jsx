import { Link } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';

// Dolch pre-K sight words (lowercase). "I" is rendered/typed as "i".
const SIGHT_WORDS = [
  'a',
  'and',
  'away',
  'big',
  'blue',
  'can',
  'come',
  'down',
  'find',
  'for',
  'funny',
  'go',
  'help',
  'here',
  'i',
  'in',
  'is',
  'it',
  'jump',
  'little',
  'look',
  'make',
  'me',
  'my',
  'not',
  'one',
  'play',
  'red',
  'run',
  'said',
  'see',
  'the',
  'three',
  'to',
  'two',
  'up',
  'we',
  'where',
  'yellow',
  'you',
];

const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');
const DIGITS = '0123456789'.split('');

// Pre-K forgiving defaults: slow drift, only a few bugs on screen at once.
const ROUND = {
  letters: { total: 8, onScreen: 5, speed: 26, label: 'Letters' },
  numbers: { total: 8, onScreen: 5, speed: 26, label: 'Numbers' },
  words: { total: 6, onScreen: 4, speed: 22, label: 'Sight Words' },
};

const BUG_COLORS = ['#ff7eb6', '#ffd35b', '#8ef0bc', '#69ddff', '#c69bff', '#ff9f5b'];
const BUG_R = 24;
const KEYBOARD_SPACE = 210;
const MARGIN = 48;
const WRONG_STREAK_LIMIT = 3;
const WRONG_STREAK_PAUSE = 0.75;

const GRADES = [
  { min: 98, grade: 'A+', label: 'Tiny typo trapper' },
  { min: 90, grade: 'A', label: 'Sharp aim' },
  { min: 80, grade: 'B', label: 'Good control' },
  { min: 70, grade: 'C', label: 'Steady practice' },
  { min: 60, grade: 'D', label: 'Slow it down' },
  { min: 0, grade: 'Practice', label: 'Try fewer guesses' },
];

const KEY_ROWS = {
  letters: [
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
    ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
  ],
  numbers: [['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']],
};
KEY_ROWS.words = KEY_ROWS.letters;

function shuffle(list) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickTargets(content, count) {
  const pool = content === 'numbers' ? DIGITS : content === 'words' ? SIGHT_WORDS : LETTERS;
  const out = [];
  // Draw unique values first, then allow repeats if the round is larger than the pool.
  let bag = shuffle(pool);
  for (let i = 0; i < count; i++) {
    if (bag.length === 0) bag = shuffle(pool);
    out.push(bag.pop());
  }
  return out;
}

function lizardMouth(game) {
  return { x: game.lizard.x, y: game.lizard.y - 34 };
}

function newGame(width, height, content) {
  const lizardY = height - KEYBOARD_SPACE - 50;
  const cfg = ROUND[content] || ROUND.letters;
  return {
    mode: content ? 'playing' : 'choose',
    content: content || 'letters',
    width,
    height,
    lizard: { x: width / 2, y: lizardY, mouth: 0 },
    bugs: [],
    tongues: [],
    particles: [],
    queue: content ? pickTargets(content, cfg.total) : [],
    spawnTimer: 0,
    nextBugId: 1,
    locked: null,
    typed: '',
    score: 0,
    attempts: 0,
    correctKeys: 0,
    misses: 0,
    wrongStreak: 0,
    total: cfg.total,
    cleared: 0,
    onScreen: cfg.onScreen,
    speed: cfg.speed,
    missFlash: 0,
    slowFlash: 0,
    inputCooldown: 0,
    lastSnapshot: 0,
  };
}

function bugBounds(game) {
  return {
    minX: MARGIN,
    maxX: game.width - MARGIN,
    minY: 90,
    maxY: game.lizard.y - 90,
  };
}

function spawnBug(game, target) {
  const b = bugBounds(game);
  const angle = Math.random() * Math.PI * 2;
  game.bugs.push({
    id: game.nextBugId++,
    x: b.minX + Math.random() * (b.maxX - b.minX),
    y: b.minY + Math.random() * Math.max(40, b.maxY - b.minY),
    vx: Math.cos(angle) * game.speed,
    vy: Math.sin(angle) * game.speed,
    target,
    color: BUG_COLORS[Math.floor(Math.random() * BUG_COLORS.length)],
    wing: Math.random() * Math.PI,
    wob: Math.random() * Math.PI * 2,
    dying: false,
    pop: 0,
  });
}

function fireTongue(game, bug) {
  const m = lizardMouth(game);
  game.tongues.push({ x0: m.x, y0: m.y, bug, t: 0, dur: 0.16, retract: false });
  game.lizard.mouth = 1;
}

function spawnParticles(game, x, y, color) {
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + Math.random() * 0.5;
    const sp = 80 + Math.random() * 150;
    game.particles.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 0.5 + Math.random() * 0.3,
      max: 0.8,
      color,
      r: 3 + Math.random() * 3,
    });
  }
}

function accuracyFor(game) {
  if (game.attempts === 0) return 100;
  return Math.round((game.correctKeys / game.attempts) * 100);
}

function gradeFor(accuracy) {
  return GRADES.find((grade) => accuracy >= grade.min) || GRADES.at(-1);
}

function recordMiss(game) {
  game.attempts += 1;
  game.misses += 1;
  game.wrongStreak += 1;
  game.missFlash = 0.18;

  if (game.wrongStreak >= WRONG_STREAK_LIMIT) {
    game.inputCooldown = WRONG_STREAK_PAUSE;
    game.slowFlash = 0.35;
    game.wrongStreak = 0;
  }

  return false;
}

// Mutates game. Returns true if the keypress was "used" (matched something).
function applyChar(game, raw) {
  if (game.mode !== 'playing') return false;
  if (game.inputCooldown > 0) return false;

  const ch = raw.toLowerCase();
  let bug = game.locked != null ? game.bugs.find((b) => b.id === game.locked && !b.dying) : null;

  if (!bug) {
    const cands = game.bugs.filter((b) => !b.dying && b.target[0] === ch);
    if (cands.length === 0) return recordMiss(game);

    const m = lizardMouth(game);
    cands.sort((a, c) => Math.hypot(a.x - m.x, a.y - m.y) - Math.hypot(c.x - m.x, c.y - m.y));
    bug = cands[0];
    game.locked = bug.id;
    game.typed = '';
  }

  const expected = bug.target[game.typed.length];
  if (ch === expected) {
    game.attempts += 1;
    game.correctKeys += 1;
    game.wrongStreak = 0;
    game.typed += ch;
    bug.pop = 0.12;
    if (game.typed.length === bug.target.length) {
      bug.dying = true;
      bug.vx = 0;
      bug.vy = 0;
      fireTongue(game, bug);
      game.score += 1;
      game.locked = null;
      game.typed = '';
    }
    return true;
  }

  // Wrong key: forgiving — buzz and keep the lock so the kid can try again.
  return recordMiss(game);
}

function update(game, dt) {
  if (game.lizard.mouth > 0) game.lizard.mouth = Math.max(0, game.lizard.mouth - dt * 3);
  if (game.missFlash > 0) game.missFlash = Math.max(0, game.missFlash - dt);
  if (game.slowFlash > 0) game.slowFlash = Math.max(0, game.slowFlash - dt);
  if (game.inputCooldown > 0) game.inputCooldown = Math.max(0, game.inputCooldown - dt);
  game.lizard.x = game.width / 2;

  if (game.mode !== 'playing') return;

  // Feed bugs from the queue, keeping only a few on screen at once.
  const alive = game.bugs.filter((b) => !b.dying).length;
  game.spawnTimer -= dt;
  if (game.queue.length > 0 && alive < game.onScreen && game.spawnTimer <= 0) {
    spawnBug(game, game.queue.shift());
    game.spawnTimer = 0.55;
  }

  const b = bugBounds(game);
  for (const bug of game.bugs) {
    bug.wing += dt * 14;
    bug.wob += dt * 2.4;
    if (bug.dying) continue;
    bug.x += bug.vx * dt;
    bug.y += bug.vy * dt;
    if (bug.x < b.minX) {
      bug.x = b.minX;
      bug.vx = Math.abs(bug.vx);
    } else if (bug.x > b.maxX) {
      bug.x = b.maxX;
      bug.vx = -Math.abs(bug.vx);
    }
    if (bug.y < b.minY) {
      bug.y = b.minY;
      bug.vy = Math.abs(bug.vy);
    } else if (bug.y > b.maxY) {
      bug.y = b.maxY;
      bug.vy = -Math.abs(bug.vy);
    }
  }

  // Tongue reaches out, grabs the bug, then we clear it.
  for (const t of game.tongues) {
    t.t += dt;
    if (!t.retract && t.t >= t.dur && t.bug && !t.bug.cleared) {
      t.bug.cleared = true;
      spawnParticles(game, t.bug.x, t.bug.y, t.bug.color);
      game.cleared += 1;
      t.retract = true;
      t.t = 0;
    }
  }
  game.tongues = game.tongues.filter((t) => !(t.retract && t.t >= t.dur));
  game.bugs = game.bugs.filter((bug) => !bug.cleared);

  for (const p of game.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.92;
    p.vy *= 0.92;
    p.life -= dt;
  }
  game.particles = game.particles.filter((p) => p.life > 0);

  if (game.cleared >= game.total && game.bugs.length === 0) {
    game.mode = 'won';
  }
}

function drawBackground(ctx, game) {
  const g = ctx.createLinearGradient(0, 0, 0, game.height);
  g.addColorStop(0, '#0a2018');
  g.addColorStop(1, '#04100c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, game.width, game.height);

  // Fireflies / distant sparkles.
  ctx.fillStyle = 'rgba(180, 255, 210, 0.5)';
  for (let i = 0; i < 40; i++) {
    const x = (i * 97) % game.width;
    const y = (i * 53) % (game.height * 0.7);
    const r = i % 5 === 0 ? 2 : 1;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  if (game.missFlash > 0) {
    ctx.fillStyle = `rgba(255, 90, 80, ${game.missFlash * 0.5})`;
    ctx.fillRect(0, 0, game.width, game.height);
  }

  if (game.slowFlash > 0) {
    ctx.fillStyle = `rgba(255, 211, 91, ${game.slowFlash * 0.35})`;
    ctx.fillRect(0, 0, game.width, game.height);
  }
}

function drawBug(ctx, bug) {
  ctx.save();
  ctx.translate(bug.x, bug.y + Math.sin(bug.wob) * 4);
  const scale = bug.pop > 0 ? 1 + bug.pop : 1;
  ctx.scale(scale, scale);

  // Wings (flapping).
  const flap = Math.abs(Math.sin(bug.wing)) * 0.6 + 0.4;
  ctx.fillStyle = 'rgba(255,255,255,0.42)';
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * BUG_R * 0.5, -BUG_R * 0.3);
    ctx.scale(side, flap);
    ctx.beginPath();
    ctx.ellipse(side * BUG_R * 0.5, 0, BUG_R * 0.7, BUG_R * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Body.
  ctx.fillStyle = bug.color;
  ctx.beginPath();
  ctx.ellipse(0, 0, BUG_R * 0.78, BUG_R, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Antennae.
  ctx.strokeStyle = bug.color;
  ctx.lineWidth = 2;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 5, -BUG_R * 0.8);
    ctx.quadraticCurveTo(side * 14, -BUG_R * 1.4, side * 10, -BUG_R * 1.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(side * 10, -BUG_R * 1.6, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = bug.color;
    ctx.fill();
  }

  // Eyes.
  ctx.fillStyle = '#fff';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(side * 7, -BUG_R * 0.3, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#16201b';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(side * 7, -BUG_R * 0.3, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawTarget(ctx, bug, typed) {
  ctx.save();
  ctx.translate(bug.x, bug.y - BUG_R - 22 + Math.sin(bug.wob) * 4);
  const text = bug.target;
  ctx.font = '700 30px "Inter", system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  const padding = 14;
  const w = ctx.measureText(text).width + padding * 2;
  const h = 42;

  // Badge.
  ctx.fillStyle = typed != null ? 'rgba(8, 24, 18, 0.95)' : 'rgba(8, 24, 18, 0.8)';
  ctx.strokeStyle = typed != null ? '#a6ff7a' : 'rgba(255,255,255,0.3)';
  ctx.lineWidth = typed != null ? 3 : 2;
  const x = -w / 2;
  const y = -h / 2;
  const r = 12;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Text — typed portion glows.
  ctx.textAlign = 'left';
  let cx = -w / 2 + padding;
  for (let i = 0; i < text.length; i++) {
    const done = typed != null && i < typed.length;
    ctx.fillStyle = done ? '#a6ff7a' : '#f7fbff';
    const ch = text[i];
    ctx.fillText(ch, cx, 1);
    cx += ctx.measureText(ch).width;
  }
  ctx.restore();
}

function drawTongue(ctx, game, t) {
  if (!t.bug) return;
  const m = lizardMouth(game);
  let reach = t.retract ? 1 - t.t / t.dur : t.t / t.dur;
  reach = Math.max(0, Math.min(1, reach));
  const tipX = m.x + (t.bug.x - m.x) * reach;
  const tipY = m.y + (t.bug.y - m.y) * reach;
  const midX = (m.x + tipX) / 2 + Math.sin(reach * Math.PI) * 12;
  const midY = (m.y + tipY) / 2;

  ctx.strokeStyle = '#ff4d7d';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(m.x, m.y);
  ctx.quadraticCurveTo(midX, midY, tipX, tipY);
  ctx.stroke();
  ctx.fillStyle = '#ff7aa5';
  ctx.beginPath();
  ctx.arc(tipX, tipY, 9, 0, Math.PI * 2);
  ctx.fill();
}

function drawLizard(ctx, game) {
  const { x, y, mouth } = game.lizard;
  ctx.save();
  ctx.translate(x, y);

  // Body mound.
  ctx.fillStyle = '#2f9e5e';
  ctx.beginPath();
  ctx.ellipse(0, 60, 120, 70, 0, Math.PI, 0);
  ctx.fill();

  // Front legs.
  ctx.fillStyle = '#37b56c';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * 70, 50, 22, 14, side * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Head.
  ctx.fillStyle = '#3cc777';
  ctx.beginPath();
  ctx.ellipse(0, 0, 60, 52, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Cheeks.
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.ellipse(0, 10, 44, 30, 0, 0, Math.PI * 2);
  ctx.fill();

  // Eyes on top.
  for (const side of [-1, 1]) {
    ctx.fillStyle = '#eafff2';
    ctx.beginPath();
    ctx.arc(side * 26, -44, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#10241a';
    ctx.beginPath();
    ctx.arc(side * 26, -46, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(side * 23, -49, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Nostrils.
  ctx.fillStyle = '#1d6e42';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(side * 8, -8, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Mouth — opens when the tongue fires.
  ctx.fillStyle = '#7a1f3a';
  ctx.beginPath();
  const open = 6 + mouth * 16;
  ctx.ellipse(0, 22, 26, open, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function buildSnapshot(game) {
  const alive = game.bugs.filter((b) => !b.dying);
  const locked =
    game.locked != null ? game.bugs.find((b) => b.id === game.locked && !b.dying) : null;
  let nextKey = null;
  let hintKeys = [];
  if (locked) {
    nextKey = locked.target[game.typed.length] || null;
    hintKeys = nextKey ? [nextKey] : [];
  } else {
    hintKeys = [...new Set(alive.map((b) => b.target[0]))];
  }
  const accuracy = accuracyFor(game);
  const grade = gradeFor(accuracy);
  return {
    mode: game.mode,
    content: game.content,
    score: game.score,
    attempts: game.attempts,
    correctKeys: game.correctKeys,
    misses: game.misses,
    accuracy,
    grade: grade.grade,
    gradeLabel: grade.label,
    inputPaused: game.inputCooldown > 0,
    bugsLeft: game.total - game.cleared,
    total: game.total,
    nextKey,
    hintKeys,
  };
}

export function LizardLunchPage() {
  const canvasRef = useRef(null);
  const gameRef = useRef(newGame(960, 640, null));
  const frameRef = useRef(0);
  const [snapshot, setSnapshot] = useState(() => buildSnapshot(gameRef.current));

  const sync = useCallback(() => setSnapshot(buildSnapshot(gameRef.current)), []);

  const startRound = useCallback(
    (content) => {
      const { width, height } = gameRef.current;
      gameRef.current = newGame(width, height, content);
      sync();
    },
    [sync]
  );

  const goChoose = useCallback(() => {
    const { width, height } = gameRef.current;
    gameRef.current = newGame(width, height, null);
    sync();
  }, [sync]);

  const onChar = useCallback(
    (ch) => {
      applyChar(gameRef.current, ch);
      sync();
    },
    [sync]
  );

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
      game.lizard.y = height - KEYBOARD_SPACE - 50;
    };

    const draw = (game) => {
      drawBackground(ctx, game);
      for (const bug of game.bugs) {
        if (!bug.dying) drawBug(ctx, bug);
      }
      for (const t of game.tongues) drawTongue(ctx, game, t);
      drawLizard(ctx, game);
      // Targets on top so badges never hide behind bugs.
      for (const bug of game.bugs) {
        if (bug.dying) continue;
        const showTyped = game.locked === bug.id ? game.typed : null;
        drawTarget(ctx, bug, showTyped);
      }
      for (const p of game.particles) {
        ctx.globalAlpha = Math.max(0, p.life / p.max);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const loop = (now) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      const game = gameRef.current;
      const prevMode = game.mode;
      update(game, dt);
      draw(game);
      if (game.mode !== prevMode || now - game.lastSnapshot > 90) {
        game.lastSnapshot = now;
        setSnapshot(buildSnapshot(game));
      }
      frameRef.current = requestAnimationFrame(loop);
    };

    const onKeyDown = (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.repeat) return;
      if (gameRef.current.mode !== 'playing') return;
      if (event.key.length === 1 && /[a-z0-9]/i.test(event.key)) {
        event.preventDefault();
        applyChar(gameRef.current, event.key);
        setSnapshot(buildSnapshot(gameRef.current));
      }
    };

    resize();
    window.addEventListener('resize', resize);
    document.addEventListener('keydown', onKeyDown);
    frameRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener('resize', resize);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const showKeyboard = snapshot.mode === 'playing';
  const rows = KEY_ROWS[snapshot.content] || KEY_ROWS.letters;

  return (
    <main className="game-route game-route--lizard-lunch">
      <nav className="game-chrome" data-game-chrome aria-label="Game navigation">
        <Link className="game-back" to="/">
          Games
        </Link>
        <span>Lizard Lunch</span>
      </nav>

      <canvas ref={canvasRef} className="lizard-canvas" aria-label="Lizard Lunch typing game" />

      {showKeyboard && (
        <>
          <div className="lizard-hud" aria-live="polite">
            <span>Bugs left {snapshot.bugsLeft}</span>
            <span>
              Zapped {snapshot.score}/{snapshot.total}
            </span>
            <span>Accuracy {snapshot.accuracy}%</span>
            <span>Misses {snapshot.misses}</span>
            {snapshot.inputPaused && <span className="lizard-hud__warning">Slow down</span>}
          </div>

          <div
            className={`lizard-keyboard${snapshot.inputPaused ? ' is-paused' : ''}`}
            aria-hidden="true"
          >
            {rows.map((row) => (
              <div className="lizard-keyrow" key={row.join('')}>
                {row.map((key) => {
                  const isNext = snapshot.nextKey === key;
                  const isHint = !isNext && snapshot.hintKeys.includes(key);
                  return (
                    <button
                      type="button"
                      key={key}
                      className={`lizard-key${isNext ? ' is-next' : ''}${isHint ? ' is-hint' : ''}`}
                      disabled={snapshot.inputPaused}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        onChar(key);
                      }}
                    >
                      {key}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}

      {snapshot.mode === 'choose' && (
        <section className="lizard-overlay" aria-labelledby="lizard-title">
          <p className="eyebrow">Type to zap</p>
          <h1 id="lizard-title">Lizard Lunch</h1>
          <p>Pick what to practice. Type each bug to flick out the tongue!</p>
          <div className="lizard-modes">
            {Object.entries(ROUND).map(([key, cfg]) => (
              <button
                type="button"
                key={key}
                className={`lizard-mode lizard-mode--${key}`}
                onClick={() => startRound(key)}
              >
                {cfg.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {snapshot.mode === 'won' && (
        <section className="lizard-overlay" aria-labelledby="lizard-win-title">
          <p className="eyebrow">Round grade</p>
          <h1 id="lizard-win-title">Grade {snapshot.grade}</h1>
          <p>
            {snapshot.accuracy}% accuracy. You zapped {snapshot.score} bugs with {snapshot.misses}{' '}
            {snapshot.misses === 1 ? 'miss' : 'misses'}.
          </p>
          <div className="lizard-report">
            <span>
              <strong>{snapshot.correctKeys}</strong> right keys
            </span>
            <span>
              <strong>{snapshot.attempts}</strong> total tries
            </span>
            <span>
              <strong>{snapshot.gradeLabel}</strong>
            </span>
          </div>
          <div className="lizard-modes">
            <button
              type="button"
              className="lizard-mode lizard-mode--again"
              onClick={() => startRound(snapshot.content)}
            >
              Play again
            </button>
            <button type="button" className="lizard-mode" onClick={goChoose}>
              Change mode
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
