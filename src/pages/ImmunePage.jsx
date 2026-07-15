import { Link } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';

const TAU = Math.PI * 2;
const ROUND_TIME = 52;
const MAX_BACTERIA = 72;
const SNAPSHOT_INTERVAL = 100;

const ROLES = {
  macrophage: {
    name: 'Macrophage',
    short: 'Engulf',
    special: 'Phagocyte rush',
    description: 'Grab nearby bacteria with reaching arms and digest them whole.',
    color: '#58d7ff',
    speed: 205,
  },
  neutrophil: {
    name: 'Neutrophil',
    short: 'Toxin burst',
    special: 'DNA net',
    description: 'Spray bacteria from a distance, then cast a huge trapping net.',
    color: '#ffca72',
    speed: 245,
  },
  helper: {
    name: 'Helper T cell',
    short: 'Signal',
    special: 'Rally cells',
    description: 'Tag invaders and reactivate tired macrophages around the wound.',
    color: '#8df29a',
    speed: 230,
  },
};

const ROLE_KEYS = Object.keys(ROLES);
const PLAYER_COLORS = ['#ffffff', '#ff83cf'];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function cycleRole(role, direction) {
  const index = ROLE_KEYS.indexOf(role);
  return ROLE_KEYS[(index + direction + ROLE_KEYS.length) % ROLE_KEYS.length];
}

function makeBacterium(game, x, y, generation = 0) {
  const angle = Math.random() * TAU;
  const speed = randomBetween(22, 50);
  return {
    id: game.nextId++,
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    angle,
    hp: generation > 2 ? 1.3 : 1,
    maxHp: generation > 2 ? 1.3 : 1,
    generation,
    wiggle: Math.random() * TAU,
    hit: 0,
    marked: 0,
    clumped: 0,
    dividing: 0,
    dead: false,
  };
}

function spawnInitialBacteria(game, count = 20) {
  for (let index = 0; index < count; index += 1) {
    const angle = Math.random() * TAU;
    const radius = randomBetween(24, 118);
    game.bacteria.push(
      makeBacterium(
        game,
        game.breach.x + Math.cos(angle) * radius,
        game.breach.y + Math.sin(angle) * radius
      )
    );
  }
}

function makeDefender(game, role, index, isPlayer) {
  const angle = (index / 6) * TAU + Math.PI * 0.6;
  const radius = isPlayer ? 190 : 245;
  return {
    id: game.nextId++,
    role,
    playerIndex: isPlayer ? index : null,
    isPlayer,
    x: game.breach.x + Math.cos(angle) * radius,
    y: game.breach.y + Math.sin(angle) * radius,
    vx: 0,
    vy: 0,
    facing: angle + Math.PI,
    actionCd: 0,
    specialCd: 0,
    fatigued: 0,
    exhausted: 0,
    rage: 0,
    exhaustion: 0,
    actionPulse: 0,
    specialPulse: 0,
    kills: 0,
    label: isPlayer ? `P${index + 1}` : `AI ${ROLES[role].name}`,
  };
}

function makeGame(width, height, config) {
  const game = {
    mode: 'playing',
    phase: 'innate',
    width,
    height,
    elapsed: 0,
    timeLeft: ROUND_TIME,
    integrity: 100,
    bacteria: [],
    defenders: [],
    projectiles: [],
    effects: [],
    particles: [],
    nextId: 1,
    nextDivision: 5.4,
    nextAntibody: 0,
    nextComplement: 1.4,
    lastSnapshot: 0,
    responseStartedAt: 0,
    antibodyHits: 0,
    totalDestroyed: 0,
    earlyClear: false,
    breach: { x: width * 0.5, y: height * 0.47, pulse: 0 },
    message: 'Resident cells are holding the breach',
    messageTime: 2.8,
    reducedMotion: Boolean(config.reducedMotion),
  };

  const roles = config.roles.slice(0, config.playerCount);
  roles.forEach((role, index) => {
    game.defenders.push(makeDefender(game, role, index, true));
  });

  const squad = ['macrophage', 'neutrophil', 'helper'];
  squad.forEach((role, index) => {
    game.defenders.push(makeDefender(game, role, roles.length + index, false));
  });
  spawnInitialBacteria(game);
  return game;
}

function setMessage(game, message, time = 2.3) {
  game.message = message;
  game.messageTime = time;
}

function nearestBacterium(game, source, range = Number.POSITIVE_INFINITY) {
  let target = null;
  let best = range;
  for (const bacterium of game.bacteria) {
    if (bacterium.dead) continue;
    const d = distance(source, bacterium);
    if (d < best) {
      best = d;
      target = bacterium;
    }
  }
  return target;
}

function addParticles(game, x, y, color, count = 10, speed = 130) {
  const particleCount = game.reducedMotion ? Math.min(count, 3) : count;
  for (let index = 0; index < particleCount; index += 1) {
    const angle = Math.random() * TAU;
    const velocity = Math.random() * speed;
    game.particles.push({
      x,
      y,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity,
      life: randomBetween(0.35, 0.8),
      maxLife: 0.8,
      radius: randomBetween(2, 5),
      color,
    });
  }
}

function destroyBacterium(game, bacterium, source, style = 'burst') {
  if (!bacterium || bacterium.dead) return;
  bacterium.dead = true;
  game.totalDestroyed += 1;
  if (source?.isPlayer && game.phase === 'innate') {
    game.timeLeft = Math.max(0, game.timeLeft - 0.18);
  }
  if (source) source.kills += 1;
  game.effects.push({
    type: style,
    x: bacterium.x,
    y: bacterium.y,
    fromX: source?.x ?? bacterium.x,
    fromY: source?.y ?? bacterium.y,
    color: source ? ROLES[source.role].color : '#fff4a3',
    life: style === 'engulf' ? 0.48 : 0.34,
    maxLife: style === 'engulf' ? 0.48 : 0.34,
  });
  addParticles(game, bacterium.x, bacterium.y, '#fb7d92', style === 'engulf' ? 7 : 12);
}

function damageBacterium(game, bacterium, amount, source, style = 'burst') {
  if (!bacterium || bacterium.dead) return;
  const bonus = bacterium.marked > 0 ? 1.35 : 1;
  bacterium.hp -= amount * bonus;
  bacterium.hit = 0.14;
  if (bacterium.hp <= 0) destroyBacterium(game, bacterium, source, style);
}

function firePrimary(game, defender) {
  if (game.mode !== 'playing' || defender.actionCd > 0 || defender.fatigued > 0) return;
  if (defender.role === 'macrophage' && defender.exhausted > 0) return;
  defender.actionPulse = 0.34;

  if (defender.role === 'macrophage') {
    const target = nearestBacterium(game, defender, defender.rage > 0 ? 112 : 92);
    defender.actionCd = defender.rage > 0 ? 0.3 : 0.58;
    if (target) {
      defender.facing = Math.atan2(target.y - defender.y, target.x - defender.x);
      damageBacterium(game, target, defender.rage > 0 ? 1.5 : 1.05, defender, 'engulf');
      defender.exhaustion += 1;
      if (defender.exhaustion >= 5 && defender.rage <= 0) {
        defender.exhaustion = 0;
        defender.exhausted = 3.8;
        setMessage(game, `${defender.label} is exhausted and needs a Helper T cell`);
      }
    }
    return;
  }

  if (defender.role === 'neutrophil') {
    const target = nearestBacterium(game, defender, 340);
    if (target) defender.facing = Math.atan2(target.y - defender.y, target.x - defender.x);
    defender.actionCd = 0.36;
    game.projectiles.push({
      x: defender.x + Math.cos(defender.facing) * 22,
      y: defender.y + Math.sin(defender.facing) * 22,
      vx: Math.cos(defender.facing) * 440,
      vy: Math.sin(defender.facing) * 440,
      life: 0.8,
      owner: defender,
      color: '#ffe09e',
    });
    return;
  }

  defender.actionCd = 0.48;
  const target = nearestBacterium(game, defender, 250);
  if (target) {
    target.marked = Math.max(target.marked, 5.5);
    if (defender.isPlayer && game.phase === 'innate') {
      game.timeLeft = Math.max(0, game.timeLeft - 0.12);
    }
    defender.facing = Math.atan2(target.y - defender.y, target.x - defender.x);
    game.effects.push({
      type: 'signal',
      x: target.x,
      y: target.y,
      fromX: defender.x,
      fromY: defender.y,
      color: ROLES.helper.color,
      life: 0.42,
      maxLife: 0.42,
    });
  }
  const tiredMacrophage = game.defenders
    .filter((cell) => cell.role === 'macrophage' && distance(cell, defender) < 190)
    .sort(
      (a, b) => b.exhausted + b.fatigued + b.actionCd - (a.exhausted + a.fatigued + a.actionCd)
    )[0];
  if (tiredMacrophage) {
    tiredMacrophage.fatigued = 0;
    tiredMacrophage.exhausted = 0;
    tiredMacrophage.exhaustion = 0;
    tiredMacrophage.actionCd = Math.min(tiredMacrophage.actionCd, 0.08);
    tiredMacrophage.rage = Math.max(tiredMacrophage.rage, 2.8);
  }
}

function fireSpecial(game, defender) {
  if (game.mode !== 'playing' || defender.specialCd > 0 || defender.fatigued > 0) return;
  defender.specialPulse = 0.8;

  if (defender.role === 'macrophage') {
    defender.specialCd = 9;
    defender.rage = 4.5;
    defender.exhaustion = 0;
    defender.exhausted = 0;
    const targets = game.bacteria
      .filter((bacterium) => !bacterium.dead && distance(defender, bacterium) < 175)
      .sort((a, b) => distance(defender, a) - distance(defender, b))
      .slice(0, 4);
    targets.forEach((target, index) => {
      damageBacterium(game, target, 1.5, defender, 'engulf');
      game.effects.push({
        type: 'pseudopod',
        x: target.x,
        y: target.y,
        fromX: defender.x,
        fromY: defender.y,
        color: ROLES.macrophage.color,
        life: 0.44 + index * 0.05,
        maxLife: 0.6,
      });
    });
    setMessage(game, `${defender.label} begins a phagocyte rush`);
    return;
  }

  if (defender.role === 'neutrophil') {
    defender.specialCd = 12;
    defender.fatigued = 1.25;
    game.effects.push({
      type: 'net',
      x: defender.x,
      y: defender.y,
      radius: 205,
      color: '#fff1c7',
      life: 2.8,
      maxLife: 2.8,
      hit: new Set(),
    });
    setMessage(game, `${defender.label} explodes into a DNA net`);
    return;
  }

  defender.specialCd = 8;
  game.effects.push({
    type: 'rally',
    x: defender.x,
    y: defender.y,
    radius: 240,
    color: ROLES.helper.color,
    life: 1.1,
    maxLife: 1.1,
  });
  for (const ally of game.defenders) {
    if (distance(defender, ally) > 240) continue;
    ally.actionCd = 0;
    ally.fatigued = Math.min(ally.fatigued, 0.3);
    if (ally.role === 'macrophage') {
      ally.exhaustion = 0;
      ally.exhausted = 0;
      ally.rage = Math.max(ally.rage, 6);
    }
  }
  for (const bacterium of game.bacteria) {
    if (distance(defender, bacterium) < 240) bacterium.marked = Math.max(bacterium.marked, 6);
  }
  game.timeLeft = Math.max(0, game.timeLeft - (defender.isPlayer ? 2.5 : 0.75));
  setMessage(game, `${defender.label} rallies the whole squad`);
}

function divideBacteria(game) {
  if (game.phase !== 'innate' || game.bacteria.length >= MAX_BACTERIA) return;
  const living = game.bacteria.filter((bacterium) => !bacterium.dead && bacterium.clumped <= 0);
  if (living.length === 0) return;
  const count = Math.min(2 + Math.floor(game.elapsed / 18), 4, MAX_BACTERIA - living.length);
  const chosen = living.sort(() => Math.random() - 0.5).slice(0, count);
  for (const parent of chosen) {
    parent.dividing = 0.7;
    const angle = Math.random() * TAU;
    game.bacteria.push(
      makeBacterium(
        game,
        parent.x + Math.cos(angle) * 24,
        parent.y + Math.sin(angle) * 24,
        parent.generation + 1
      )
    );
  }
}

function beginAdaptiveResponse(game) {
  if (game.phase === 'adaptive') return;
  game.phase = 'adaptive';
  game.responseStartedAt = game.elapsed;
  game.nextAntibody = 0;
  for (const defender of game.defenders) {
    if (defender.role === 'macrophage') defender.rage = 20;
  }
  game.effects.push({
    type: 'flood',
    x: game.width / 2,
    y: game.height / 2,
    color: '#fff2a6',
    life: 3,
    maxLife: 3,
  });
  setMessage(game, 'Antibodies have arrived. Finish the fight!', 4);
}

function activateComplement(game) {
  const target = game.bacteria
    .filter((bacterium) => !bacterium.dead)
    .sort((a, b) => a.marked - b.marked || Math.random() - 0.5)[0];
  if (!target) return;
  const wasMarked = target.marked > 0;
  target.marked = Math.max(target.marked, 4.5);
  damageBacterium(game, target, wasMarked ? 0.42 : 0.12, null, wasMarked ? 'mac' : 'burst');
  game.effects.push({
    type: 'complement',
    x: target.x,
    y: target.y,
    fromX: target.x + randomBetween(-160, 160),
    fromY: target.y + randomBetween(-130, 130),
    color: '#91e7ff',
    life: 0.65,
    maxLife: 0.65,
  });
  if (game.elapsed < 10 || (wasMarked && Math.random() < 0.24)) {
    setMessage(
      game,
      wasMarked
        ? 'Complement proteins punch through a marked bacterium'
        : 'C3b glues itself to an invader',
      1.7
    );
  }
}

function updateAI(game, cell, dt) {
  if (cell.fatigued > 0) return;
  let target = null;
  if (cell.role === 'helper') {
    target = game.defenders
      .filter((ally) => ally.role === 'macrophage')
      .sort((a, b) => b.actionCd - a.actionCd)[0];
    if (!target || target.actionCd < 0.2) target = nearestBacterium(game, cell);
  } else {
    const marked = game.bacteria
      .filter((bacterium) => bacterium.marked > 0 && !bacterium.dead)
      .sort((a, b) => distance(cell, a) - distance(cell, b))[0];
    target = marked || nearestBacterium(game, cell);
  }
  if (!target) return;

  const dx = target.x - cell.x;
  const dy = target.y - cell.y;
  const d = Math.hypot(dx, dy) || 1;
  const desired = cell.role === 'neutrophil' ? 180 : cell.role === 'helper' ? 120 : 58;
  cell.facing = Math.atan2(dy, dx);
  if (d > desired) {
    const speed = ROLES[cell.role].speed * (cell.rage > 0 ? 1.2 : 1) * 0.78;
    cell.x += (dx / d) * speed * dt;
    cell.y += (dy / d) * speed * dt;
  }
  if (d < desired + 28 && cell.actionCd <= 0) {
    firePrimary(game, cell);
    const aiDelay = cell.role === 'macrophage' ? 2.8 : cell.role === 'neutrophil' ? 2 : 2.1;
    cell.actionCd = Math.max(cell.actionCd, aiDelay);
  }
  if (cell.specialCd <= 0 && game.elapsed > 16) {
    const nearby = game.bacteria.filter((bacterium) => distance(cell, bacterium) < 185).length;
    if ((cell.role === 'neutrophil' && nearby >= 9) || (cell.role === 'helper' && nearby >= 8)) {
      fireSpecial(game, cell);
    }
  }
}

function updatePlayers(game, dt, keys, gamepads, buttonEdges, touchInput) {
  const controlSets = [
    { left: 'KeyA', right: 'KeyD', up: 'KeyW', down: 'KeyS' },
    { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown' },
  ];

  const players = game.defenders.filter((cell) => cell.isPlayer);
  players.forEach((player, index) => {
    const controls = controlSets[index];
    const pad = gamepads[index];
    let x = 0;
    let y = 0;
    if (keys.has(controls.left)) x -= 1;
    if (keys.has(controls.right)) x += 1;
    if (keys.has(controls.up)) y -= 1;
    if (keys.has(controls.down)) y += 1;
    if (pad) {
      const padX = Math.abs(pad.axes[0] || 0) > 0.2 ? pad.axes[0] : 0;
      const padY = Math.abs(pad.axes[1] || 0) > 0.2 ? pad.axes[1] : 0;
      x += padX + (pad.buttons[15]?.pressed ? 1 : 0) - (pad.buttons[14]?.pressed ? 1 : 0);
      y += padY + (pad.buttons[13]?.pressed ? 1 : 0) - (pad.buttons[12]?.pressed ? 1 : 0);
    }
    if (index === 0 && touchInput) {
      x += touchInput.x;
      y += touchInput.y;
    }
    const magnitude = Math.hypot(x, y);
    if (magnitude > 0 && player.fatigued <= 0) {
      x /= magnitude;
      y /= magnitude;
      const exhaustionSpeed = player.exhausted > 0 ? 0.62 : 1;
      const speed = ROLES[player.role].speed * (player.rage > 0 ? 1.18 : 1) * exhaustionSpeed;
      player.x += x * speed * dt;
      player.y += y * speed * dt;
      player.facing = Math.atan2(y, x);
    }
    if (buttonEdges[index]?.primary) firePrimary(game, player);
    if (buttonEdges[index]?.special) fireSpecial(game, player);
  });
}

function updateGame(game, dt, keys, gamepads, buttonEdges, touchInput) {
  game.elapsed += dt;
  game.breach.pulse += dt;
  game.messageTime = Math.max(0, game.messageTime - dt);
  updatePlayers(game, dt, keys, gamepads, buttonEdges, touchInput);

  game.nextComplement -= dt;
  if (game.nextComplement <= 0) {
    activateComplement(game);
    game.nextComplement = game.phase === 'adaptive' ? 1.25 : 2.2;
  }

  if (game.phase === 'innate') {
    game.timeLeft = Math.max(0, game.timeLeft - dt);
    game.nextDivision -= dt;
    if (game.nextDivision <= 0) {
      divideBacteria(game);
      game.nextDivision = Math.max(3.1, 4.9 - game.elapsed * 0.025);
    }
    if (game.timeLeft <= 0) beginAdaptiveResponse(game);
  } else {
    game.nextAntibody -= dt;
    if (game.nextAntibody <= 0) {
      const targets = game.bacteria
        .filter((bacterium) => !bacterium.dead)
        .sort(() => Math.random() - 0.5)
        .slice(0, 2);
      for (const target of targets) {
        target.clumped = Math.max(target.clumped, 4);
        target.marked = Math.max(target.marked, 5);
        damageBacterium(game, target, 0.22, null, 'antibody');
        game.effects.push({
          type: 'antibody',
          x: target.x,
          y: target.y,
          fromX: target.x + randomBetween(-100, 100),
          fromY: -30,
          color: '#fff1a8',
          life: 0.75,
          maxLife: 0.75,
        });
        game.antibodyHits += 1;
      }
      game.nextAntibody = 0.2;
    }
  }

  for (const cell of game.defenders) {
    cell.actionCd = Math.max(0, cell.actionCd - dt);
    cell.specialCd = Math.max(0, cell.specialCd - dt);
    cell.fatigued = Math.max(0, cell.fatigued - dt);
    cell.exhausted = Math.max(0, cell.exhausted - dt);
    cell.rage = Math.max(0, cell.rage - dt);
    cell.actionPulse = Math.max(0, cell.actionPulse - dt);
    cell.specialPulse = Math.max(0, cell.specialPulse - dt);
    if (!cell.isPlayer) updateAI(game, cell, dt);
    cell.x = clamp(cell.x, 30, game.width - 30);
    cell.y = clamp(cell.y, 78, game.height - 30);
  }

  for (const bacterium of game.bacteria) {
    bacterium.hit = Math.max(0, bacterium.hit - dt);
    bacterium.marked = Math.max(0, bacterium.marked - dt);
    bacterium.clumped = Math.max(0, bacterium.clumped - dt);
    bacterium.dividing = Math.max(0, bacterium.dividing - dt);
    bacterium.wiggle += dt * 7;
    if (bacterium.dead) continue;
    const speedFactor = bacterium.clumped > 0 ? 0.1 : bacterium.marked > 0 ? 0.62 : 1;
    bacterium.x += bacterium.vx * dt * speedFactor;
    bacterium.y += bacterium.vy * dt * speedFactor;
    if (bacterium.x < 22 || bacterium.x > game.width - 22) bacterium.vx *= -1;
    if (bacterium.y < 78 || bacterium.y > game.height - 22) bacterium.vy *= -1;
    bacterium.x = clamp(bacterium.x, 22, game.width - 22);
    bacterium.y = clamp(bacterium.y, 78, game.height - 22);
  }

  const livingCount = game.bacteria.filter((bacterium) => !bacterium.dead).length;
  if (livingCount > 0) {
    const pressureRamp = 1 + game.elapsed / 45;
    const pressure =
      Math.max(0, livingCount - 5) * (game.phase === 'adaptive' ? 0.028 : 0.18) * pressureRamp;
    const breachAttackers = game.bacteria.filter(
      (bacterium) => !bacterium.dead && distance(bacterium, game.breach) < 82
    ).length;
    const breachDamage = breachAttackers * (game.phase === 'adaptive' ? 0.025 : 0.15);
    game.integrity = Math.max(0, game.integrity - (pressure + breachDamage) * dt);
  }

  for (const projectile of game.projectiles) {
    projectile.x += projectile.vx * dt;
    projectile.y += projectile.vy * dt;
    projectile.life -= dt;
    if (projectile.life <= 0) continue;
    const hit = game.bacteria.find(
      (bacterium) => !bacterium.dead && distance(projectile, bacterium) < 23
    );
    if (hit) {
      damageBacterium(game, hit, 0.7, projectile.owner, 'burst');
      projectile.life = 0;
      addParticles(game, hit.x, hit.y, '#ffe4a8', 6, 90);
    }
  }
  game.projectiles = game.projectiles.filter((projectile) => projectile.life > 0);

  for (const effect of game.effects) {
    effect.life -= dt;
    if (effect.type === 'net') {
      const progress = 1 - effect.life / effect.maxLife;
      const radius = effect.radius * Math.min(1, progress * 3.5);
      for (const bacterium of game.bacteria) {
        if (bacterium.dead || effect.hit.has(bacterium.id)) continue;
        if (Math.hypot(bacterium.x - effect.x, bacterium.y - effect.y) < radius) {
          effect.hit.add(bacterium.id);
          bacterium.clumped = Math.max(bacterium.clumped, 3.5);
          damageBacterium(game, bacterium, 0.78, null, 'net-hit');
        }
      }
    }
  }
  game.effects = game.effects.filter((effect) => effect.life > 0);

  for (const particle of game.particles) {
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= 0.93;
    particle.vy *= 0.93;
    particle.life -= dt;
  }
  game.particles = game.particles.filter((particle) => particle.life > 0);
  game.bacteria = game.bacteria.filter((bacterium) => !bacterium.dead);

  if (game.integrity <= 0) {
    game.mode = 'lost';
    setMessage(game, 'The bacteria overwhelmed the tissue', 10);
  } else if (game.bacteria.length === 0) {
    game.earlyClear = game.phase === 'innate';
    game.mode = 'won';
    setMessage(
      game,
      game.earlyClear ? 'The innate squad cleared the breach early' : 'The last bacterium is gone',
      10
    );
  }
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function drawBackground(ctx, game) {
  const gradient = ctx.createRadialGradient(
    game.breach.x,
    game.breach.y,
    10,
    game.breach.x,
    game.breach.y,
    Math.max(game.width, game.height) * 0.75
  );
  gradient.addColorStop(0, game.phase === 'adaptive' ? '#682c67' : '#51234f');
  gradient.addColorStop(0.45, '#291f52');
  gradient.addColorStop(1, '#11182d');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, game.width, game.height);

  ctx.globalAlpha = 0.25;
  for (let index = 0; index < 28; index += 1) {
    const x = (index * 173 + 42) % game.width;
    const y = 78 + ((index * 97 + 31) % Math.max(1, game.height - 90));
    const radius = 28 + (index % 5) * 7;
    ctx.fillStyle = index % 2 ? '#bd629d' : '#684f9c';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const pulse = game.reducedMotion ? 1 : 1 + Math.sin(game.breach.pulse * 3) * 0.08;
  ctx.save();
  ctx.translate(game.breach.x, game.breach.y);
  ctx.scale(pulse, pulse);
  const wound = ctx.createRadialGradient(0, 0, 8, 0, 0, 100);
  wound.addColorStop(0, 'rgba(255, 118, 136, 0.85)');
  wound.addColorStop(0.5, 'rgba(171, 50, 100, 0.34)');
  wound.addColorStop(1, 'rgba(255, 92, 120, 0)');
  ctx.fillStyle = wound;
  ctx.beginPath();
  ctx.arc(0, 0, 104, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 158, 166, 0.75)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-38, -30);
  ctx.bezierCurveTo(-15, -8, -24, 22, 8, 40);
  ctx.bezierCurveTo(20, 15, 15, -8, 38, -38);
  ctx.stroke();

  ctx.restore();

  if (game.phase === 'adaptive') {
    const wash = ctx.createLinearGradient(0, 0, 0, game.height);
    wash.addColorStop(0, 'rgba(255, 239, 157, 0.18)');
    wash.addColorStop(1, 'rgba(255, 196, 99, 0.02)');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, game.width, game.height);
  }
}

function drawBacterium(ctx, bacterium) {
  ctx.save();
  ctx.translate(bacterium.x, bacterium.y);
  ctx.rotate(bacterium.angle + Math.sin(bacterium.wiggle) * 0.08);
  const split = bacterium.dividing > 0 ? 1 + Math.sin(bacterium.dividing * 10) * 0.25 : 1;
  ctx.scale(split, 1 / split);
  if (bacterium.clumped > 0) {
    ctx.shadowColor = '#fff2a6';
    ctx.shadowBlur = 18;
  } else if (bacterium.marked > 0) {
    ctx.shadowColor = '#8df29a';
    ctx.shadowBlur = 14;
  }
  ctx.fillStyle = bacterium.hit > 0 ? '#fff' : '#ef507d';
  ctx.strokeStyle = '#721b4b';
  ctx.lineWidth = 3;
  roundedRect(ctx, -22, -12, 44, 24, 12);
  ctx.fill();
  ctx.stroke();

  if (bacterium.maxHp > 1) {
    ctx.strokeStyle = bacterium.marked > 0 ? '#c8ffd0' : 'rgba(255, 226, 239, 0.72)';
    ctx.lineWidth = 2;
    roundedRect(ctx, -28, -17, 56, 34, 16);
    ctx.stroke();
  }

  ctx.fillStyle = '#ffb2ca';
  for (const x of [-10, 3, 13]) {
    ctx.beginPath();
    ctx.arc(x, x % 2 ? -4 : 4, 2.3, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = '#ff87ac';
  ctx.lineWidth = 1.5;
  for (const y of [-7, 0, 7]) {
    ctx.beginPath();
    ctx.moveTo(-20, y);
    ctx.quadraticCurveTo(-31, y + Math.sin(bacterium.wiggle + y) * 8, -36, y + 3);
    ctx.stroke();
  }
  if (bacterium.marked > 0) {
    ctx.fillStyle = '#c8ffd0';
    ctx.beginPath();
    ctx.arc(0, -21, 4, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawMacrophage(ctx, cell, color) {
  const pulse = cell.actionPulse > 0 ? 1.14 : 1;
  ctx.save();
  ctx.scale(pulse, pulse);
  ctx.fillStyle = color;
  ctx.strokeStyle = cell.rage > 0 ? '#ffffff' : '#176c96';
  ctx.lineWidth = cell.rage > 0 ? 4 : 2.5;
  ctx.beginPath();
  for (let index = 0; index < 16; index += 1) {
    const angle = (index / 16) * TAU;
    const radius = 29 + Math.sin(angle * 5 + cell.actionPulse * 15) * 5;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(22, 62, 118, 0.62)';
  ctx.beginPath();
  ctx.arc(-5, 2, 12, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#eafcff';
  ctx.beginPath();
  ctx.arc(10, -9, 4, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawNeutrophil(ctx, color) {
  ctx.fillStyle = color;
  ctx.strokeStyle = '#a76a30';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, 25, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#9a6595';
  for (const [x, y] of [
    [-8, -3],
    [7, -7],
    [7, 9],
  ]) {
    ctx.beginPath();
    ctx.ellipse(x, y, 8, 6, 0.5, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  for (let index = 0; index < 7; index += 1) {
    const angle = (index / 7) * TAU;
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * 17, Math.sin(angle) * 17, 1.6, 0, TAU);
    ctx.fill();
  }
}

function drawHelper(ctx, color) {
  ctx.fillStyle = color;
  ctx.strokeStyle = '#247e4e';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, 24, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#d7ffde';
  ctx.lineWidth = 2;
  for (let index = 0; index < 9; index += 1) {
    const angle = (index / 9) * TAU;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * 23, Math.sin(angle) * 23);
    ctx.lineTo(Math.cos(angle) * 31, Math.sin(angle) * 31);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * 33, Math.sin(angle) * 33, 2.5, 0, TAU);
    ctx.fillStyle = '#d7ffde';
    ctx.fill();
  }
  ctx.fillStyle = '#23655d';
  ctx.beginPath();
  ctx.arc(2, 1, 12, 0, TAU);
  ctx.fill();
}

function drawDefender(ctx, cell) {
  ctx.save();
  ctx.translate(cell.x, cell.y);
  ctx.rotate(cell.facing);
  const roleColor = ROLES[cell.role].color;
  ctx.globalAlpha = cell.fatigued > 0 ? 0.5 : 1;
  ctx.shadowColor = cell.rage > 0 ? '#ffffff' : roleColor;
  ctx.shadowBlur = cell.rage > 0 ? 18 : 8;
  if (cell.role === 'macrophage') drawMacrophage(ctx, cell, roleColor);
  else if (cell.role === 'neutrophil') drawNeutrophil(ctx, roleColor);
  else drawHelper(ctx, roleColor);
  ctx.restore();

  ctx.save();
  ctx.translate(cell.x, cell.y);
  if (cell.isPlayer) {
    ctx.strokeStyle = PLAYER_COLORS[cell.playerIndex];
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.arc(0, 0, 38, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.font = '700 12px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = '#11182d';
  ctx.shadowBlur = 5;
  ctx.fillText(cell.label, 0, -42);
  ctx.restore();
}

function drawAntibody(ctx, x, y, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.strokeStyle = '#fff3ad';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 12);
  ctx.lineTo(0, -2);
  ctx.lineTo(-9, -12);
  ctx.moveTo(0, -2);
  ctx.lineTo(9, -12);
  ctx.stroke();
  ctx.restore();
}

function drawEffects(ctx, game) {
  for (const projectile of game.projectiles) {
    ctx.fillStyle = projectile.color;
    ctx.shadowColor = projectile.color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(projectile.x, projectile.y, 5, 0, TAU);
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  for (const effect of game.effects) {
    const progress = 1 - effect.life / effect.maxLife;
    const alpha = Math.min(1, effect.life * 2.6);
    ctx.save();
    ctx.globalAlpha = alpha;
    if (effect.type === 'engulf' || effect.type === 'pseudopod') {
      ctx.strokeStyle = effect.color;
      ctx.lineWidth = effect.type === 'engulf' ? 15 * (1 - progress) + 3 : 8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(effect.fromX, effect.fromY);
      ctx.quadraticCurveTo(
        (effect.fromX + effect.x) / 2 + Math.sin(progress * Math.PI) * 24,
        (effect.fromY + effect.y) / 2 - 18,
        effect.x,
        effect.y
      );
      ctx.stroke();
    } else if (effect.type === 'signal') {
      ctx.strokeStyle = effect.color;
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 6]);
      ctx.beginPath();
      ctx.moveTo(effect.fromX, effect.fromY);
      ctx.lineTo(effect.x, effect.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, 15 + progress * 25, 0, TAU);
      ctx.stroke();
    } else if (effect.type === 'rally') {
      ctx.strokeStyle = effect.color;
      ctx.lineWidth = 7 * (1 - progress) + 2;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, effect.radius * progress, 0, TAU);
      ctx.stroke();
    } else if (effect.type === 'net') {
      const radius = effect.radius * Math.min(1, progress * 3.5);
      ctx.strokeStyle = '#fff6df';
      ctx.lineWidth = 2;
      for (let index = 0; index < 8; index += 1) {
        const angle = (index / 8) * TAU + progress;
        ctx.beginPath();
        ctx.moveTo(effect.x, effect.y);
        ctx.quadraticCurveTo(
          effect.x + Math.cos(angle + 0.5) * radius * 0.65,
          effect.y + Math.sin(angle + 0.5) * radius * 0.65,
          effect.x + Math.cos(angle) * radius,
          effect.y + Math.sin(angle) * radius
        );
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, radius * 0.72, 0, TAU);
      ctx.stroke();
    } else if (effect.type === 'antibody') {
      const x = effect.fromX + (effect.x - effect.fromX) * progress;
      const y = effect.fromY + (effect.y - effect.fromY) * progress;
      drawAntibody(ctx, x, y, 1.1);
    } else if (effect.type === 'complement') {
      const x = effect.fromX + (effect.x - effect.fromX) * progress;
      const y = effect.fromY + (effect.y - effect.fromY) * progress;
      ctx.fillStyle = effect.color;
      ctx.shadowColor = effect.color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#eaffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, 8 + progress * 15, 0, TAU);
      ctx.stroke();
    } else if (effect.type === 'flood' && !game.reducedMotion) {
      ctx.fillStyle = `rgba(255, 241, 168, ${0.24 * (1 - progress)})`;
      ctx.fillRect(0, 0, game.width, game.height);
    } else {
      ctx.strokeStyle = effect.color;
      ctx.lineWidth = 4 * (1 - progress);
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, 8 + progress * 32, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  for (const particle of game.particles) {
    ctx.save();
    ctx.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.radius, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

function drawGame(ctx, game) {
  drawBackground(ctx, game);
  for (const bacterium of game.bacteria) drawBacterium(ctx, bacterium);
  for (const cell of game.defenders) drawDefender(ctx, cell);
  drawEffects(ctx, game);
}

function snapshotFromGame(game) {
  const players = game.defenders
    .filter((cell) => cell.isPlayer)
    .map((cell) => ({
      role: cell.role,
      playerIndex: cell.playerIndex,
      specialCd: Math.ceil(cell.specialCd),
      fatigued: cell.fatigued > 0,
      exhausted: Math.ceil(cell.exhausted),
      kills: cell.kills,
    }));
  return {
    mode: game.mode,
    phase: game.phase,
    timeLeft: Math.ceil(game.timeLeft),
    nextDivision: Math.max(0, Math.ceil(game.nextDivision)),
    integrity: Math.ceil(game.integrity),
    bacteria: game.bacteria.length,
    destroyed: game.totalDestroyed,
    players,
    message: game.messageTime > 0 ? game.message : '',
    earlyClear: game.earlyClear,
    antibodyHits: game.antibodyHits,
  };
}

const INITIAL_SNAPSHOT = {
  mode: 'setup',
  phase: 'innate',
  timeLeft: ROUND_TIME,
  nextDivision: 0,
  integrity: 100,
  bacteria: 0,
  destroyed: 0,
  players: [],
  message: '',
  earlyClear: false,
  antibodyHits: 0,
};

export function ImmunePage() {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const previewRef = useRef(null);
  const snapshotModeRef = useRef('setup');
  const frameRef = useRef(0);
  const keysRef = useRef(new Set());
  const pressedRef = useRef([new Set(), new Set()]);
  const keyboardEdgesRef = useRef([{}, {}]);
  const touchInputRef = useRef({ x: 0, y: 0 });
  const touchPointerRef = useRef(null);
  const touchStickRef = useRef(null);
  const configRef = useRef({ playerCount: 1, roles: ['macrophage', 'neutrophil'] });
  const [config, setConfig] = useState(configRef.current);
  const [snapshot, setSnapshot] = useState(INITIAL_SNAPSHOT);

  const updateConfig = useCallback((updater) => {
    setConfig((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater;
      configRef.current = next;
      return next;
    });
  }, []);

  const startGame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    touchInputRef.current = { x: 0, y: 0 };
    if (touchStickRef.current) touchStickRef.current.style.transform = 'translate(0px, 0px)';
    previewRef.current = null;
    gameRef.current = makeGame(width, height, {
      ...configRef.current,
      reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    });
    snapshotModeRef.current = gameRef.current.mode;
    setSnapshot(snapshotFromGame(gameRef.current));
  }, []);

  const returnToSetup = useCallback(() => {
    gameRef.current = null;
    touchInputRef.current = { x: 0, y: 0 };
    if (touchStickRef.current) touchStickRef.current.style.transform = 'translate(0px, 0px)';
    snapshotModeRef.current = 'setup';
    setSnapshot(INITIAL_SNAPSHOT);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let lastTime = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = window.innerWidth;
      const height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (gameRef.current) {
        const game = gameRef.current;
        const previousWidth = game.width || width;
        const previousHeight = game.height || height;
        const scaleX = width / previousWidth;
        const scaleY = height / previousHeight;
        game.width = width;
        game.height = height;
        game.breach.x = width * 0.5;
        game.breach.y = height * 0.47;
        for (const entity of [...game.bacteria, ...game.defenders]) {
          entity.x = clamp(entity.x * scaleX, 24, width - 24);
          entity.y = clamp(entity.y * scaleY, 78, height - 24);
        }
      } else {
        previewRef.current = null;
      }
    };

    const loop = (now) => {
      const dt = Math.min((now - lastTime) / 1000, 0.04);
      lastTime = now;
      const game = gameRef.current;
      if (game) {
        const pads = navigator.getGamepads
          ? Array.from(navigator.getGamepads()).filter(Boolean).slice(0, 2)
          : [];
        const edges = [{ ...keyboardEdgesRef.current[0] }, { ...keyboardEdgesRef.current[1] }];
        keyboardEdgesRef.current = [{}, {}];
        for (let index = 0; index < 2; index += 1) {
          const pad = pads[index];
          const pressed = new Set();
          if (pad) {
            pad.buttons.forEach((button, buttonIndex) => {
              if (button.pressed) pressed.add(buttonIndex);
            });
            edges[index].primary ||= pressed.has(0) && !pressedRef.current[index].has(0);
            edges[index].special ||=
              (pressed.has(2) && !pressedRef.current[index].has(2)) ||
              (pressed.has(1) && !pressedRef.current[index].has(1));
            edges[index].pause ||= pressed.has(9) && !pressedRef.current[index].has(9);
          }
          pressedRef.current[index] = pressed;
        }

        if (edges.some((edge) => edge.pause) && ['playing', 'paused'].includes(game.mode)) {
          game.mode = game.mode === 'paused' ? 'playing' : 'paused';
        }
        if (game.mode === 'playing') {
          updateGame(game, dt, keysRef.current, pads, edges, touchInputRef.current);
        }
        drawGame(ctx, game);
        if (now - game.lastSnapshot > SNAPSHOT_INTERVAL || game.mode !== snapshotModeRef.current) {
          game.lastSnapshot = now;
          snapshotModeRef.current = game.mode;
          setSnapshot(snapshotFromGame(game));
        }
      } else {
        if (!previewRef.current) {
          previewRef.current = makeGame(window.innerWidth, window.innerHeight, {
            playerCount: 0,
            roles: [],
            reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
          });
          previewRef.current.bacteria = previewRef.current.bacteria.slice(0, 9);
          previewRef.current.defenders = previewRef.current.defenders.slice(0, 3);
          previewRef.current.defenders.forEach((defender) => {
            defender.label = '';
          });
        }
        const preview = previewRef.current;
        preview.breach.pulse = now / 1000;
        for (const bacterium of preview.bacteria) bacterium.wiggle += dt * 3;
        drawGame(ctx, preview);

        const pads = navigator.getGamepads
          ? Array.from(navigator.getGamepads()).filter(Boolean).slice(0, 2)
          : [];
        pads.forEach((pad, index) => {
          const pressed = new Set();
          pad.buttons.forEach((button, buttonIndex) => {
            if (button.pressed) pressed.add(buttonIndex);
          });
          const fresh = (buttonIndex) =>
            pressed.has(buttonIndex) && !pressedRef.current[index].has(buttonIndex);
          const left = fresh(14) || fresh(4);
          const right = fresh(15) || fresh(5);
          if (left || right) {
            updateConfig((current) => {
              const roles = [...current.roles];
              roles[index] = cycleRole(roles[index], left ? -1 : 1);
              return {
                ...current,
                playerCount: index === 1 ? 2 : current.playerCount,
                roles,
              };
            });
          }
          if (fresh(0)) {
            if (index === 1 && configRef.current.playerCount === 1) {
              updateConfig((current) => ({ ...current, playerCount: 2 }));
            } else {
              startGame();
            }
          }
          if (index === 0 && fresh(9)) startGame();
          pressedRef.current[index] = pressed;
        });
      }
      frameRef.current = requestAnimationFrame(loop);
    };

    const onKeyDown = (event) => {
      if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Enter'].includes(event.code)
      ) {
        event.preventDefault();
      }
      if (event.repeat) {
        keysRef.current.add(event.code);
        return;
      }
      if (!gameRef.current) {
        if (event.code === 'Digit1' || event.code === 'Digit2') {
          updateConfig((current) => ({
            ...current,
            playerCount: Number(event.code.slice(-1)),
          }));
        } else if (event.code === 'KeyQ' || event.code === 'KeyE') {
          updateConfig((current) => ({
            ...current,
            roles: [cycleRole(current.roles[0], event.code === 'KeyQ' ? -1 : 1), current.roles[1]],
          }));
        } else if (event.code === 'BracketLeft' || event.code === 'BracketRight') {
          updateConfig((current) => ({
            ...current,
            roles: [
              current.roles[0],
              cycleRole(current.roles[1], event.code === 'BracketLeft' ? -1 : 1),
            ],
          }));
        } else if (event.code === 'Enter' || event.code === 'Space') {
          startGame();
        }
        return;
      }
      if (
        event.code === 'KeyP' &&
        (gameRef.current.mode === 'playing' || gameRef.current.mode === 'paused')
      ) {
        gameRef.current.mode = gameRef.current.mode === 'paused' ? 'playing' : 'paused';
        snapshotModeRef.current = gameRef.current.mode;
        setSnapshot(snapshotFromGame(gameRef.current));
        return;
      }
      if (gameRef.current.mode === 'paused') {
        if (event.code === 'Enter' || event.code === 'Space') {
          gameRef.current.mode = 'playing';
          snapshotModeRef.current = gameRef.current.mode;
          setSnapshot(snapshotFromGame(gameRef.current));
        }
        if (event.code === 'KeyR') startGame();
        if (event.code === 'Escape') returnToSetup();
        return;
      }
      if (gameRef.current.mode !== 'playing') {
        if (event.code === 'KeyR' || event.code === 'Enter' || event.code === 'Space') {
          startGame();
        }
        if (event.code === 'Escape') returnToSetup();
        return;
      }
      if (event.code === 'KeyF') keyboardEdgesRef.current[0].primary = true;
      if (event.code === 'KeyG') keyboardEdgesRef.current[0].special = true;
      if (event.code === 'Enter') keyboardEdgesRef.current[1].primary = true;
      if (event.code === 'ShiftRight' || event.code === 'Slash') {
        keyboardEdgesRef.current[1].special = true;
      }
      keysRef.current.add(event.code);
    };

    const onKeyUp = (event) => keysRef.current.delete(event.code);
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    frameRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [returnToSetup, startGame, updateConfig]);

  const changeRole = (playerIndex, role) => {
    updateConfig((current) => {
      const roles = [...current.roles];
      roles[playerIndex] = role;
      return { ...current, roles };
    });
  };

  const moveTouchStick = useCallback((event) => {
    if (touchPointerRef.current !== event.pointerId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const maxDistance = rect.width * 0.32;
    const rawX = event.clientX - centerX;
    const rawY = event.clientY - centerY;
    const distanceFromCenter = Math.hypot(rawX, rawY) || 1;
    const scale = Math.min(1, maxDistance / distanceFromCenter);
    const x = rawX * scale;
    const y = rawY * scale;
    touchInputRef.current = { x: x / maxDistance, y: y / maxDistance };
    if (touchStickRef.current) {
      touchStickRef.current.style.transform = `translate(${x}px, ${y}px)`;
    }
  }, []);

  const startTouchStick = useCallback(
    (event) => {
      event.preventDefault();
      touchPointerRef.current = event.pointerId;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      moveTouchStick(event);
    },
    [moveTouchStick]
  );

  const stopTouchStick = useCallback((event) => {
    if (touchPointerRef.current !== event.pointerId) return;
    touchPointerRef.current = null;
    touchInputRef.current = { x: 0, y: 0 };
    if (touchStickRef.current) touchStickRef.current.style.transform = 'translate(0px, 0px)';
  }, []);

  const pressTouchAction = useCallback((action, event) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.currentTarget.dataset.pressed = 'true';
    keyboardEdgesRef.current[0][action] = true;
    navigator.vibrate?.(action === 'special' ? 24 : 10);
  }, []);

  const releaseTouchAction = useCallback((event) => {
    event.currentTarget.dataset.pressed = 'false';
  }, []);

  return (
    <main className="game-route game-route--immune">
      <canvas className="immune-canvas" ref={canvasRef} />

      <nav className="game-chrome immune-chrome" aria-label="Game navigation">
        <Link className="game-back" to="/">
          Games
        </Link>
        <span>Immune</span>
      </nav>

      {snapshot.mode !== 'setup' && (
        <section className="immune-hud">
          <div className="immune-hud__mission">
            <strong>{snapshot.phase === 'innate' ? 'Hold the breach' : 'Antibody response'}</strong>
            <span>
              {snapshot.phase === 'innate'
                ? `Big guns in ${snapshot.timeLeft}s`
                : 'Antibodies are clumping invaders'}
            </span>
          </div>
          <div className="immune-hud__stats">
            <span>
              <b>{snapshot.bacteria}</b> bacteria
            </span>
            <span>
              <b>{snapshot.integrity}%</b> tissue
            </span>
            {snapshot.phase === 'innate' && (
              <span className="immune-hud__division">Division in {snapshot.nextDivision}s</span>
            )}
          </div>
          <div
            className="immune-response-track"
            aria-label="Adaptive response progress"
            aria-valuemax={ROUND_TIME}
            aria-valuemin={0}
            aria-valuenow={
              snapshot.phase === 'adaptive' ? ROUND_TIME : ROUND_TIME - snapshot.timeLeft
            }
            aria-valuetext={
              snapshot.phase === 'adaptive'
                ? 'Antibodies have arrived'
                : `${snapshot.timeLeft} seconds until antibodies arrive`
            }
            role="progressbar"
          >
            <span
              style={{
                transform: `scaleX(${snapshot.phase === 'adaptive' ? 1 : 1 - snapshot.timeLeft / ROUND_TIME})`,
              }}
            />
          </div>
        </section>
      )}

      {snapshot.mode === 'playing' && snapshot.players.length > 0 && (
        <aside className="immune-player-status" aria-label="Player abilities">
          {snapshot.players.map((player, index) => (
            <div
              className={`immune-player-pill immune-player-pill--p${index + 1}`}
              key={`player-${player.playerIndex + 1}`}
            >
              <span>P{index + 1}</span>
              <strong>{ROLES[player.role].name}</strong>
              <small>
                {player.fatigued
                  ? 'Recovering'
                  : player.exhausted > 0
                    ? `Too tired to engulf ${player.exhausted}s`
                    : player.specialCd > 0
                      ? `${ROLES[player.role].special} ${player.specialCd}s`
                      : `${ROLES[player.role].special} ready`}
              </small>
            </div>
          ))}
        </aside>
      )}

      {snapshot.message && snapshot.mode === 'playing' && (
        <div className="immune-callout" role="status">
          {snapshot.message}
        </div>
      )}

      {snapshot.mode === 'playing' && snapshot.players[0] && (
        <section className="immune-touch-controls" aria-label="Player 1 touch controls">
          <button
            aria-label="Movement joystick"
            className="immune-touch-joystick"
            onContextMenu={(event) => event.preventDefault()}
            onPointerCancel={stopTouchStick}
            onPointerDown={startTouchStick}
            onPointerMove={moveTouchStick}
            onPointerUp={stopTouchStick}
            type="button"
          >
            <span className="immune-touch-joystick__arrows" aria-hidden="true">
              +
            </span>
            <span className="immune-touch-joystick__knob" ref={touchStickRef} />
            <small>P1 move</small>
          </button>
          <div className="immune-touch-actions">
            <button
              aria-label={`${ROLES[snapshot.players[0].role].short} action`}
              className="immune-touch-action immune-touch-action--primary"
              data-pressed="false"
              onContextMenu={(event) => event.preventDefault()}
              onPointerCancel={releaseTouchAction}
              onPointerDown={(event) => pressTouchAction('primary', event)}
              onPointerUp={releaseTouchAction}
              type="button"
            >
              <strong>{ROLES[snapshot.players[0].role].short}</strong>
              <small>Action</small>
            </button>
            <button
              aria-label={`${ROLES[snapshot.players[0].role].special} special`}
              className="immune-touch-action immune-touch-action--special"
              data-pressed="false"
              onContextMenu={(event) => event.preventDefault()}
              onPointerCancel={releaseTouchAction}
              onPointerDown={(event) => pressTouchAction('special', event)}
              onPointerUp={releaseTouchAction}
              type="button"
            >
              <strong>{ROLES[snapshot.players[0].role].special}</strong>
              <small>Special</small>
            </button>
          </div>
        </section>
      )}

      {snapshot.mode === 'paused' && (
        <section className="immune-pause" aria-labelledby="immune-pause-title">
          <p>Battle paused</p>
          <h1 id="immune-pause-title">The bacteria are holding still.</h1>
          <button
            className="immune-start"
            onClick={() => {
              if (!gameRef.current) return;
              gameRef.current.mode = 'playing';
              snapshotModeRef.current = gameRef.current.mode;
              setSnapshot(snapshotFromGame(gameRef.current));
            }}
            type="button"
          >
            Resume defense
          </button>
          <small>Press P, Enter, or gamepad Start to resume</small>
        </section>
      )}

      {snapshot.mode === 'setup' && (
        <section className="immune-setup" aria-labelledby="immune-title">
          <div className="immune-alert">
            <span className="immune-alert__pulse" />
            Breach detected
          </div>
          <h1 id="immune-title">Immune</h1>
          <p className="immune-setup__intro">
            Damaged cells are crying for help. Choose your defenders, then hold back the multiplying
            bacteria until antibodies arrive.
          </p>

          <fieldset className="immune-count">
            <legend>Local defenders</legend>
            {[1, 2].map((count) => (
              <button
                className={config.playerCount === count ? 'is-selected' : ''}
                key={count}
                onClick={() => updateConfig((current) => ({ ...current, playerCount: count }))}
                type="button"
              >
                {count} player{count > 1 ? 's' : ''}
              </button>
            ))}
          </fieldset>

          <div className="immune-role-selectors">
            {['player-1', 'player-2'].slice(0, config.playerCount).map((playerKey, playerIndex) => (
              <fieldset
                className={`immune-role-picker immune-role-picker--p${playerIndex + 1}`}
                key={playerKey}
              >
                <legend>Player {playerIndex + 1}</legend>
                {ROLE_KEYS.map((role) => (
                  <button
                    className={config.roles[playerIndex] === role ? 'is-selected' : ''}
                    key={role}
                    onClick={() => changeRole(playerIndex, role)}
                    type="button"
                  >
                    <span
                      className={`immune-role-icon immune-role-icon--${role}`}
                      aria-hidden="true"
                    />
                    <span>
                      <strong>{ROLES[role].name}</strong>
                      <small>{ROLES[role].description}</small>
                    </span>
                  </button>
                ))}
              </fieldset>
            ))}
          </div>

          <button className="immune-start" onClick={startGame} type="button">
            Defend the tissue
          </button>
          <div className="immune-controls">
            <span>P1: WASD, F action, G special</span>
            {config.playerCount === 2 && <span>P2: Arrows, Enter action, / special</span>}
            <span>Gamepad: Stick, A action, X or B special</span>
            <span>Setup: D-pad picks a cell, A starts or joins</span>
            <span>Touch: joystick and action buttons control P1</span>
          </div>
        </section>
      )}

      {(snapshot.mode === 'won' || snapshot.mode === 'lost') && (
        <section className="immune-result" aria-labelledby="immune-result-title">
          <p className="immune-result__status">
            {snapshot.mode === 'won' ? 'Breach contained' : 'Tissue overwhelmed'}
          </p>
          <h1 id="immune-result-title">
            {snapshot.mode === 'won'
              ? snapshot.earlyClear
                ? 'Innate victory!'
                : 'The big guns finished it.'
              : 'The bacteria broke through.'}
          </h1>
          <p>
            {snapshot.mode === 'won'
              ? snapshot.earlyClear
                ? 'Your squad eliminated every bacterium before the adaptive response was needed.'
                : 'Antibodies pinned the survivors while the cell squad cleared the wound.'
              : 'Try mixing cell roles and use special actions when bacteria divide.'}
          </p>
          <div className="immune-result__stats">
            <span>
              <strong>{snapshot.destroyed}</strong> destroyed
            </span>
            <span>
              <strong>{snapshot.integrity}%</strong> tissue left
            </span>
            <span>
              <strong>{snapshot.antibodyHits}</strong> antibody hits
            </span>
          </div>
          <div className="immune-result__actions">
            <button className="immune-start" onClick={startGame} type="button">
              Defend again
            </button>
            <button className="immune-secondary" onClick={returnToSetup} type="button">
              Change cells
            </button>
          </div>
          <small>Press R or Enter to defend again</small>
        </section>
      )}
    </main>
  );
}
