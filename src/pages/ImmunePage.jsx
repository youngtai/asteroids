import { Link } from '@tanstack/react-router';
import { Volume2, VolumeX } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createImmuneSoundEngine } from '../lib/immuneAudio.js';

const TAU = Math.PI * 2;
const ROUND_TIME = 52;
const MAX_BACTERIA = 180;
const BASELINE_ARENA_AREA = 1280 * 720;
const SNAPSHOT_INTERVAL = 100;
const SOUND_PREFERENCE_KEY = 'immune-sound-muted';
const ADAPTIVE_RESPONSE_STAGES = [
  { id: 'sampling', icon: '🔎', label: 'Gather germ bits' },
  { id: 'delivery', icon: '🛡️', label: 'Follow the lymph path' },
  { id: 'matching', icon: '🧩', label: 'Match helper and B cells' },
  { id: 'cloning', icon: '🫧', label: 'Grow plasma cells' },
];

const ROLES = {
  macrophage: {
    name: 'Macrophage',
    short: 'Engulf',
    special: 'Phagocyte rush',
    description: 'Wrap bacteria in pseudopods and digest them through phagocytosis.',
    color: '#58d7ff',
    speed: 205,
    specialCooldown: 9,
  },
  neutrophil: {
    name: 'Neutrophil',
    short: 'Toxin burst',
    special: 'DNA net',
    description: 'Spray bacteria from a distance, then cast a huge trapping net.',
    color: '#ffca72',
    speed: 245,
    specialCooldown: 12,
  },
  helper: {
    name: 'Helper T cell',
    short: 'Mark + boost',
    special: 'Team boost',
    description: 'Mark germs, recharge macrophages, and help matching B cells become plasma cells.',
    color: '#8df29a',
    speed: 230,
    specialCooldown: 8,
  },
  dendritic: {
    name: 'Dendritic cell',
    short: 'Sample',
    special: 'Antigen call',
    description: 'Gather germ pieces, carry their clues, and present them at the lymph node.',
    color: '#62e2c7',
    speed: 218,
    specialCooldown: 10,
  },
};

const ROLE_KEYS = Object.keys(ROLES);
const PLAYER_COLORS = ['#ffffff', '#ff83cf'];

const LEARNING_STAGES = [
  {
    id: 'alarm',
    icon: '🚨',
    ctaIcon: '👣',
    progressIcons: ['👣', '👣', '👣'],
    title: 'Germs got in!',
    cell: 'Mo the macrophage',
    objective: 'Follow the glow',
    fact: 'Hurt cells call nearby immune cells for help.',
    narration: "Uh-oh! Your body got an owie, and germs got in. Let's go help!",
    cta: 'Go',
  },
  {
    id: 'macrophage',
    icon: '😋',
    ctaIcon: '😋',
    progressIcons: ['🦠', '🦠', '🦠', '🦠'],
    title: 'Chomp the germs!',
    cell: 'Macrophage',
    objective: 'Gobble the pink germs',
    fact: 'Macrophages wrap around germs and gobble them up.',
    narration: "Hi, I'm Mo! I'm a macrophage, a germ eater. Chomp, chomp!",
    cta: 'Eat',
  },
  {
    id: 'neutrophil',
    icon: '⚡',
    ctaIcon: '💦',
    progressIcons: ['💧', '💧', '💧', '🕸️'],
    title: 'Zip sprays germs!',
    cell: 'Neutrophil',
    objective: 'Spray the germs',
    fact: 'Neutrophils are fast, but their powerful tools can hurt healthy cells too.',
    narration: 'This is Zip, a neutrophil. Zip is super fast! Spray the germs.',
    cta: 'Spray',
    next: {
      icon: '🕸️',
      ctaIcon: '🕸️',
      title: 'Throw the sticky net!',
      objective: 'Catch lots at once',
      narration: 'Great spraying! Now throw a sticky net. It catches lots of germs at once!',
      cta: 'Net',
    },
  },
  {
    id: 'dendritic',
    icon: '🔎',
    ctaIcon: '🛡️',
    progressIcons: ['🛡️', '🛡️', '🛡️', '🏠'],
    title: 'Guard the runner!',
    cell: 'Dendritic cell',
    objective: 'Keep the runner safe',
    fact: 'A dendritic cell carries a tiny germ clue to the lymph node.',
    narration: 'This little runner has a piece of a germ. Keep it safe on the way to helper base!',
    cta: 'Protect',
  },
  {
    id: 'helper',
    icon: '🧩',
    ctaIcon: '✨',
    progressIcons: ['✨', '⭐'],
    title: 'Find the glowing helper!',
    cell: 'Helper T cell',
    objective: 'Touch the one that glows',
    fact: 'After a few days, one helper T cell matches the germ clue.',
    narration: 'A few sleeps go by. We need the right helper T cell. Touch the one that glows!',
    cta: 'Match',
    next: {
      icon: '⭐',
      ctaIcon: '⭐',
      title: 'Wake the sleepy eaters!',
      objective: 'Send a big cheer',
      narration: "That's the one! Cheer to wake up the sleepy germ eaters.",
      cta: 'Cheer',
    },
  },
  {
    id: 'antibodies',
    icon: '🫧',
    ctaIcon: '😋',
    progressIcons: ['🦠', '🦠', '🦠', '🦠', '🦠'],
    title: 'Sticky stars!',
    cell: 'B cell + macrophage',
    objective: 'Gobble the stuck germs',
    fact: 'B cells make sticky antibodies that grab germs together.',
    narration:
      'The helper made sticky stars called antibodies. They glue germs together. Gobble them!',
    cta: 'Eat',
  },
  {
    id: 'memory',
    icon: '⭐',
    ctaIcon: '👀',
    progressIcons: ['⭐', '⭐', '⭐', '⭐', '⭐'],
    title: 'The body remembers!',
    cell: 'Memory B + T cells',
    objective: 'Watch the fast cleanup',
    fact: 'Memory cells remember this germ and fight it faster next time.',
    narration:
      'Some helpers remember these germs. If they come back, the body can fight super fast!',
    cta: 'Watch',
  },
];

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

function getArenaScale(width, height) {
  const shortSide = Math.min(width, height);
  const responsiveScale = clamp(Math.sqrt(shortSide / 720), 0.72, 1.08);
  return {
    bacteriaScale: clamp(0.48, 0.68 * responsiveScale, 0.76),
    cellScale: clamp(0.56, 0.75 * responsiveScale, 0.84),
  };
}

function getArenaPopulationProfile(width, height) {
  const areaScale = clamp(Math.sqrt((width * height) / BASELINE_ARENA_AREA), 0.62, 3);
  return {
    initialBacteria: Math.round(clamp(26 * Math.sqrt(areaScale), 20, 46)),
    maxBacteria: Math.round(clamp(96 * areaScale, 72, MAX_BACTERIA)),
    ingressWaveSize: Math.round(clamp(areaScale + 0.5, 1, 4)),
    reinforcementWaveSize: Math.round(clamp(areaScale * 1.15, 1, 3)),
    maxAiDefenders: Math.round(clamp(4 + areaScale * 2, 6, 12)),
  };
}

function makeAdaptiveResponse(width, height, population) {
  const startX = width * 0.5;
  const startY = height * 0.47;
  return {
    stage: 'sampling',
    stageIndex: 0,
    progress: 0,
    elapsed: 0,
    samples: 0,
    samplesNeeded: Math.round(clamp(population.initialBacteria * 0.9, 18, 32)),
    passiveSampleTimer: 4,
    phase: 0,
    courier: {
      x: startX + 72,
      y: startY - 44,
      startX: startX + 72,
      startY: startY - 44,
      targetX: width - 104,
      targetY: 124,
      controlX: width * 0.72,
      controlY: height * 0.25,
      wanderX: startX + 72,
      wanderY: startY - 44,
      wanderTimer: 0,
      sampleCooldown: 0,
      travelSpeed: 68,
      facing: 0,
    },
    node: { x: width - 104, y: 124 },
    bCellCopies: 1,
    plasmaCells: [],
  };
}

function adaptiveOverallProgress(game) {
  if (game.phase === 'adaptive') return 1;
  const response = game.adaptive;
  if (!response) return 0;
  return clamp((response.stageIndex + response.progress) / ADAPTIVE_RESPONSE_STAGES.length, 0, 1);
}

function playerDendritic(game) {
  return game.defenders.find((cell) => cell.isPlayer && cell.role === 'dendritic') ?? null;
}

function adaptiveStatus(game) {
  if (game.phase === 'adaptive') {
    return {
      title: 'Plasma-cell factories are here!',
      detail: 'Antibodies pin germs; defender cells must clear them',
    };
  }
  const response = game.adaptive;
  if (!response || response.stage === 'sampling') {
    const isPlayerScout = Boolean(playerDendritic(game));
    return {
      title: isPlayerScout ? 'Gather germ bits' : 'Dendritic scout is sampling',
      detail: `${response?.samples ?? 0}/${response?.samplesNeeded ?? 0} germ bits gathered`,
    };
  }
  if (response.stage === 'delivery') {
    game.antigenFragments.length = 0;
    const hasDendriticPlayer = game.defenders.some(
      (cell) => cell.isPlayer && cell.role === 'dendritic'
    );
    return {
      title: hasDendriticPlayer ? 'Carry the clue to the lymph node' : 'Guard the dendritic cell',
      detail: hasDendriticPlayer
        ? 'Follow the glowing guide and present the sample'
        : 'Clear germs away from its path',
    };
  }
  if (response.stage === 'matching') {
    return {
      title: 'Find the matching cells',
      detail: 'Helper T cell is activating a B cell',
    };
  }
  return {
    title: 'Grow antibody factories',
    detail: `${response.bCellCopies} B-cell ${response.bCellCopies === 1 ? 'copy' : 'copies'} becoming plasma cells`,
  };
}

const TISSUE_COLORS = [
  { at: 0, value: [74, 58, 82] },
  { at: 0.3, value: [255, 106, 77] },
  { at: 0.62, value: [255, 207, 90] },
  { at: 1, value: [63, 216, 192] },
];

function tissueHealthColor(health, alpha = 1) {
  const value = clamp(health, 0, 1);
  let lower = TISSUE_COLORS[0];
  let upper = TISSUE_COLORS[TISSUE_COLORS.length - 1];
  for (let index = 1; index < TISSUE_COLORS.length; index += 1) {
    if (value <= TISSUE_COLORS[index].at) {
      upper = TISSUE_COLORS[index];
      lower = TISSUE_COLORS[index - 1];
      break;
    }
  }
  const progress = clamp((value - lower.at) / Math.max(0.001, upper.at - lower.at), 0, 1);
  const rgb = lower.value.map((channel, index) =>
    Math.round(channel + (upper.value[index] - channel) * progress)
  );
  return `rgba(${rgb.join(', ')}, ${alpha})`;
}

function makeTissue(width, height, previous = null) {
  const top = 76;
  const patchSize = clamp(Math.min(width, height) * 0.072, 48, 56);
  const columns = Math.max(1, Math.ceil(width / patchSize));
  const rows = Math.max(1, Math.ceil((height - top) / patchSize));
  const health = new Float32Array(columns * rows);
  const danger = new Float32Array(columns * rows);
  health.fill(1);

  if (previous) {
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const previousColumn = clamp(
          Math.floor(((column + 0.5) / columns) * previous.columns),
          0,
          previous.columns - 1
        );
        const previousRow = clamp(
          Math.floor(((row + 0.5) / rows) * previous.rows),
          0,
          previous.rows - 1
        );
        const previousIndex = previousRow * previous.columns + previousColumn;
        const index = row * columns + column;
        health[index] = previous.health[previousIndex];
        danger[index] = previous.danger[previousIndex];
      }
    }
  }

  return {
    top,
    columns,
    rows,
    cellWidth: width / columns,
    cellHeight: Math.max(1, height - top) / rows,
    health,
    danger,
  };
}

function tissueIndexAt(game, x, y) {
  const tissue = game.tissue;
  const column = clamp(Math.floor((x / game.width) * tissue.columns), 0, tissue.columns - 1);
  const row = clamp(
    Math.floor(((y - tissue.top) / Math.max(1, game.height - tissue.top)) * tissue.rows),
    0,
    tissue.rows - 1
  );
  return row * tissue.columns + column;
}

function damageTissueArea(game, x, y, radius, amount) {
  const tissue = game.tissue;
  for (let row = 0; row < tissue.rows; row += 1) {
    for (let column = 0; column < tissue.columns; column += 1) {
      const index = row * tissue.columns + column;
      const centerX = (column + 0.5) * tissue.cellWidth;
      const centerY = tissue.top + (row + 0.5) * tissue.cellHeight;
      const distanceFromDamage = Math.hypot(centerX - x, centerY - y);
      if (distanceFromDamage > radius) continue;
      const falloff = 1 - distanceFromDamage / radius;
      tissue.health[index] = Math.max(0, tissue.health[index] - amount * falloff);
      tissue.danger[index] = Math.max(tissue.danger[index], 0.85 * falloff);
    }
  }
}

function readSoundPreference() {
  try {
    return window.localStorage.getItem(SOUND_PREFERENCE_KEY) === 'true';
  } catch {
    return false;
  }
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
    markedBy: null,
    bonusHit: 0,
    clumped: 0,
    antibodyCoated: 0,
    antibodyCluster: null,
    antibodyPulse: 0,
    dividing: 0,
    hunter: Math.random() < 0.28,
    hostTargetId: null,
    latchedTo: null,
    corroding: false,
    sampledByDendritic: false,
    dead: false,
  };
}

function spawnInitialBacteria(game, count = 26) {
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

function getEdgeEntry(game, edge, position, offset = 0) {
  const margin = 22;
  const topBound = 82;
  let x;
  let y;
  let fromX;
  let fromY;

  if (edge === 0) {
    x = clamp(game.width * position + offset, margin, game.width - margin);
    y = topBound;
    fromX = x;
    fromY = topBound - 54;
  } else if (edge === 1) {
    x = game.width - margin;
    y = clamp(game.height * position + offset, topBound, game.height - margin);
    fromX = game.width + 54;
    fromY = y;
  } else if (edge === 2) {
    x = clamp(game.width * position + offset, margin, game.width - margin);
    y = game.height - margin;
    fromX = x;
    fromY = game.height + 54;
  } else {
    x = margin;
    y = clamp(game.height * position + offset, topBound, game.height - margin);
    fromX = -54;
    fromY = y;
  }

  return { x, y, fromX, fromY };
}

function spawnIncomingBacterium(game, edge, position, offset = 0) {
  const maxBacteria = game.population?.maxBacteria ?? MAX_BACTERIA;
  if (game.bacteria.length >= maxBacteria) return false;
  const { x, y, fromX, fromY } = getEdgeEntry(game, edge, position, offset);

  const bacterium = makeBacterium(game, x, y);
  const heading =
    Math.atan2(game.breach.y - bacterium.y, game.breach.x - bacterium.x) +
    randomBetween(-0.24, 0.24);
  const speed = randomBetween(32, 48);
  bacterium.vx = Math.cos(heading) * speed;
  bacterium.vy = Math.sin(heading) * speed;
  bacterium.angle = heading;
  game.bacteria.push(bacterium);
  game.effects.push({
    type: 'arrival',
    x,
    y,
    fromX,
    fromY,
    color: '#ff9db8',
    life: game.reducedMotion ? 0.25 : 0.72,
    maxLife: game.reducedMotion ? 0.25 : 0.72,
  });
  playGameSound(game, 'arrival');
  return true;
}

function spawnIncomingBacteriaWave(game) {
  const edge = Math.floor(Math.random() * 4);
  const position = randomBetween(0.18, 0.82);
  const requested = game.experience === 'education' ? 1 : (game.population?.ingressWaveSize ?? 1);
  let entered = 0;
  for (let index = 0; index < requested; index += 1) {
    const centeredIndex = index - (requested - 1) / 2;
    if (spawnIncomingBacterium(game, edge, position, centeredIndex * 34)) entered += 1;
  }
  return entered;
}

function spawnDefenderReinforcementWave(game) {
  if (game.experience !== 'defense') return 0;
  const currentAi = game.defenders.filter((cell) => !cell.isPlayer).length;
  const available = Math.max(0, (game.population?.maxAiDefenders ?? 6) - currentAi);
  const requested = Math.min(game.population?.reinforcementWaveSize ?? 1, available);
  if (requested <= 0) return 0;

  const edge = Math.floor(Math.random() * 4);
  const position = randomBetween(0.22, 0.78);
  const roles =
    game.phase === 'adaptive'
      ? ['macrophage', 'helper', 'neutrophil']
      : ['neutrophil', 'macrophage', 'neutrophil', 'helper'];
  for (let index = 0; index < requested; index += 1) {
    const role = roles[(game.reinforcementWave + index) % roles.length];
    const cell = makeDefender(game, role, game.defenders.length, false);
    const centeredIndex = index - (requested - 1) / 2;
    const entry = getEdgeEntry(game, edge, position, centeredIndex * 52);
    cell.x = entry.x;
    cell.y = entry.y;
    cell.facing = Math.atan2(game.breach.y - cell.y, game.breach.x - cell.x);
    cell.label = '';
    game.defenders.push(cell);
    game.effects.push({
      type: 'arrival',
      x: entry.x,
      y: entry.y,
      fromX: entry.fromX,
      fromY: entry.fromY,
      color: ROLES[role].color,
      life: game.reducedMotion ? 0.25 : 0.86,
      maxLife: game.reducedMotion ? 0.25 : 0.86,
    });
  }
  game.reinforcementWave += requested;
  playGameSound(game, 'arrival');
  return requested;
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
    rallied: 0,
    exhaustion: 0,
    actionPulse: 0,
    specialPulse: 0,
    kills: 0,
    label: isPlayer ? `P${index + 1}` : `AI ${ROLES[role].name}`,
  };
}

function makeHostCell(game) {
  const direction = Math.random() < 0.5 ? 1 : -1;
  const margin = 34;
  const baseY = randomBetween(112, Math.max(132, game.height - 58));
  return {
    id: game.nextId++,
    x: direction > 0 ? -margin : game.width + margin,
    y: baseY,
    baseY,
    direction,
    speed: randomBetween(24, 36),
    phase: Math.random() * TAU,
    health: 1,
    attackerId: null,
    rescued: 0,
    dying: 0,
    dead: false,
  };
}

function releaseHostCell(game, bacterium, rescued = false) {
  if (!bacterium?.latchedTo) return;
  const hostCell = game.hostCells.find((cell) => cell.id === bacterium.latchedTo);
  bacterium.latchedTo = null;
  bacterium.hostTargetId = null;
  const escapeAngle = Math.random() * TAU;
  bacterium.vx = Math.cos(escapeAngle) * randomBetween(26, 44);
  bacterium.vy = Math.sin(escapeAngle) * randomBetween(26, 44);
  if (!hostCell || hostCell.dying > 0) return;
  hostCell.attackerId = null;
  if (!rescued) return;
  hostCell.health = Math.max(0.58, hostCell.health);
  hostCell.rescued = game.reducedMotion ? 0.4 : 0.9;
  game.hostCellsSaved += 1;
  playGameSound(game, 'cellRescue');
  addParticles(game, hostCell.x, hostCell.y, '#8fffdc', 10, 82);
  game.effects.push({
    type: 'cell-rescue',
    x: hostCell.x,
    y: hostCell.y,
    color: '#8fffdc',
    life: hostCell.rescued,
    maxLife: hostCell.rescued,
  });
}

function updateHostCells(game, dt) {
  const maximum = game.width < 700 ? 3 : 5;
  game.nextHostCell -= dt;
  if (game.nextHostCell <= 0 && game.hostCells.length < maximum) {
    game.hostCells.push(makeHostCell(game));
    game.nextHostCell = randomBetween(2.8, 4.2);
  }

  for (const hostCell of game.hostCells) {
    hostCell.phase += dt * 2.3;
    hostCell.rescued = Math.max(0, hostCell.rescued - dt);
    if (hostCell.dead) {
      hostCell.dying = Math.max(0, hostCell.dying - dt);
      continue;
    }

    hostCell.x += hostCell.direction * hostCell.speed * dt;
    hostCell.y = hostCell.baseY + (game.reducedMotion ? 0 : Math.sin(hostCell.phase) * 7);
    if (!hostCell.attackerId) {
      hostCell.health = Math.min(1, hostCell.health + dt * 0.035);
      continue;
    }

    const attacker = game.bacteria.find(
      (bacterium) => bacterium.id === hostCell.attackerId && !bacterium.dead
    );
    if (!attacker) {
      hostCell.attackerId = null;
      continue;
    }
    hostCell.health = Math.max(0, hostCell.health - dt / 3.8);
    if (hostCell.health > 0) continue;

    hostCell.dead = true;
    hostCell.dying = game.reducedMotion ? 0.25 : 0.58;
    game.hostCellsLost += 1;
    playGameSound(game, 'cellPop');
    addParticles(game, hostCell.x, hostCell.y, '#ff8066', 14, 96);
    damageTissueArea(game, hostCell.x, hostCell.y, 78, 0.075);
    releaseHostCell(game, attacker, false);
  }

  game.hostCells = game.hostCells.filter(
    (hostCell) =>
      (hostCell.dead && hostCell.dying > 0) ||
      (!hostCell.dead && (hostCell.direction > 0 ? hostCell.x < game.width + 46 : hostCell.x > -46))
  );
}

function updateTissue(game, dt) {
  const tissue = game.tissue;
  const activeAttackers = game.bacteria.filter(
    (bacterium) => !bacterium.dead && !bacterium.latchedTo && bacterium.antibodyCoated <= 0
  ).length;
  const baselineAttackers = Math.max(20, (game.population?.initialBacteria ?? 26) * 1.5);
  const crowdDamageScale = clamp(
    Math.sqrt(baselineAttackers / Math.max(baselineAttackers, activeAttackers)),
    0.58,
    1
  );
  const patchDamageScale = clamp(Math.sqrt(tissue.health.length / 300), 0.7, 2.4);
  const educationDamageScale = game.experience === 'education' ? 0.45 : 1;
  const damageRate =
    (game.phase === 'adaptive' ? 0.018 : 0.072) *
    patchDamageScale *
    crowdDamageScale *
    educationDamageScale;
  for (let index = 0; index < tissue.danger.length; index += 1) {
    tissue.danger[index] = Math.max(0, tissue.danger[index] - dt * 0.7);
  }

  for (const bacterium of game.bacteria) {
    bacterium.corroding = false;
    if (bacterium.dead || bacterium.latchedTo || bacterium.antibodyCoated > 0) continue;
    const index = tissueIndexAt(game, bacterium.x, bacterium.y);
    const nearBreach = distance(bacterium, game.breach) < 92;
    tissue.health[index] = Math.max(
      0,
      tissue.health[index] - damageRate * (nearBreach ? 1.18 : 1) * dt
    );
    tissue.danger[index] = Math.max(tissue.danger[index], nearBreach ? 1 : 0.74);
    bacterium.corroding = true;
  }

  const woundHealth = [];
  let criticalPatches = 0;
  let collapsingWoundPatches = 0;
  const woundRadius = clamp(Math.min(game.width, game.height) * 0.34, 170, 260);
  for (let row = 0; row < tissue.rows; row += 1) {
    for (let column = 0; column < tissue.columns; column += 1) {
      const index = row * tissue.columns + column;
      const health = tissue.health[index];
      if (health < 0.32) criticalPatches += 1;
      const centerX = (column + 0.5) * tissue.cellWidth;
      const centerY = tissue.top + (row + 0.5) * tissue.cellHeight;
      if (Math.hypot(centerX - game.breach.x, centerY - game.breach.y) <= woundRadius) {
        woundHealth.push(health);
        if (health < 0.32) collapsingWoundPatches += 1;
      }
    }
  }
  woundHealth.sort((a, b) => a - b);
  const visibleHealth = tissue.health.reduce((total, health) => total + health, 0);
  const visibleIntegrity = (visibleHealth / tissue.health.length) * 100;
  const woundAverage =
    woundHealth.reduce((total, health) => total + health, 0) / Math.max(1, woundHealth.length);
  const localWoundPenalty = (1 - woundAverage) * 12;
  const collapsingShare = collapsingWoundPatches / Math.max(1, woundHealth.length);
  const modeledIntegrity = visibleIntegrity - localWoundPenalty;
  game.integrity = Math.max(
    0,
    Math.min(game.integrity, modeledIntegrity) - collapsingShare * 0.18 * dt
  );
  game.criticalTissue = Math.ceil((criticalPatches / tissue.health.length) * 100);
}

function makeGame(width, height, config) {
  const arenaScale = getArenaScale(width, height);
  const population = getArenaPopulationProfile(width, height);
  const experience = config.experience === 'education' ? 'education' : 'defense';
  const game = {
    mode: experience === 'education' ? 'tour' : 'playing',
    experience,
    phase: 'innate',
    width,
    height,
    ...arenaScale,
    population,
    elapsed: 0,
    timeLeft: ROUND_TIME,
    integrity: 100,
    tissue: makeTissue(width, height),
    criticalTissue: 0,
    bacteria: [],
    antigenFragments: [],
    hostCells: [],
    defenders: [],
    projectiles: [],
    effects: [],
    particles: [],
    nextId: 1,
    nextDivision: 4.6,
    nextIngress: 4.2,
    nextReinforcement: 8.5,
    reinforcementWave: 0,
    nextHostCell: 6.5,
    nextAntibody: 0,
    nextComplement: 1.4,
    lastSnapshot: 0,
    responseStartedAt: 0,
    responsePulse: 0,
    adaptive: null,
    antibodyHits: 0,
    germsCoated: 0,
    totalDestroyed: 0,
    hostCellsSaved: 0,
    hostCellsLost: 0,
    earlyClear: false,
    sound: config.sound ?? null,
    integrityWarnings: new Set(),
    breach: { x: width * 0.5, y: height * 0.47, pulse: 0 },
    reducedMotion: Boolean(config.reducedMotion),
    education:
      experience === 'education'
        ? {
            stage: 0,
            beat: 0,
            stageElapsed: 0,
            progress: 0,
            primaryActions: 0,
            specialActions: 0,
            stageStartKills: 0,
            stageStartBacteria: 0,
            courier: null,
            plasmaCell: null,
            helperTargets: [],
            helperMatched: false,
            memoryCells: [],
          }
        : null,
  };

  if (experience === 'defense') {
    game.adaptive = makeAdaptiveResponse(width, height, population);
  }

  const roles =
    experience === 'education' ? ['macrophage'] : config.roles.slice(0, config.playerCount);
  roles.forEach((role, index) => {
    game.defenders.push(makeDefender(game, role, index, true));
  });

  const squad = experience === 'education' ? [] : ['macrophage', 'neutrophil', 'helper'];
  squad.forEach((role, index) => {
    game.defenders.push(makeDefender(game, role, roles.length + index, false));
  });
  spawnInitialBacteria(game, experience === 'education' ? 12 : population.initialBacteria);
  return game;
}

function playGameSound(game, name) {
  game.sound?.play(name);
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

function helperBoostTarget(game, defender) {
  return game.defenders
    .filter(
      (cell) =>
        cell.role === 'macrophage' && cell.id !== defender.id && distance(cell, defender) < 190
    )
    .sort((a, b) => {
      const fatigueA = a.exhausted * 2 + a.exhaustion + a.fatigued + a.actionCd;
      const fatigueB = b.exhausted * 2 + b.exhaustion + b.fatigued + b.actionCd;
      return fatigueB - fatigueA || distance(a, defender) - distance(b, defender);
    })[0];
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

function leaveAntigenFragment(game, x, y, sourceRole = null) {
  if (
    game.experience !== 'defense' ||
    game.phase !== 'innate' ||
    game.adaptive?.stage !== 'sampling'
  ) {
    return;
  }
  const angle = Math.random() * TAU;
  game.antigenFragments.push({
    id: game.nextId++,
    x: clamp(x + Math.cos(angle) * randomBetween(8, 22), 28, game.width - 28),
    y: clamp(y + Math.sin(angle) * randomBetween(8, 22), 86, game.height - 28),
    phase: Math.random() * TAU,
    life: 24,
    collected: false,
    color:
      sourceRole === 'macrophage' ? '#7de4ff' : sourceRole === 'neutrophil' ? '#ffe09e' : '#ff9bb6',
  });
  if (game.antigenFragments.length > 56) game.antigenFragments.shift();
}

function lymphaticPathPoint(courier, progress) {
  const inverse = 1 - progress;
  return {
    x:
      inverse * inverse * courier.startX +
      2 * inverse * progress * courier.controlX +
      progress * progress * courier.targetX,
    y:
      inverse * inverse * courier.startY +
      2 * inverse * progress * courier.controlY +
      progress * progress * courier.targetY,
  };
}

function advanceCourierAtSteadySpeed(courier, progress, dt, speed = 84) {
  const inverse = 1 - progress;
  const derivativeX =
    2 * inverse * (courier.controlX - courier.startX) +
    2 * progress * (courier.targetX - courier.controlX);
  const derivativeY =
    2 * inverse * (courier.controlY - courier.startY) +
    2 * progress * (courier.targetY - courier.controlY);
  const pathSpeed = Math.max(32, Math.hypot(derivativeX, derivativeY));
  const nextProgress = clamp(progress + (speed * dt) / pathSpeed, 0, 1);
  const pathPoint = lymphaticPathPoint(courier, nextProgress);
  courier.facing = Math.atan2(pathPoint.y - courier.y, pathPoint.x - courier.x);
  courier.x = pathPoint.x;
  courier.y = pathPoint.y;
  return nextProgress;
}

function advanceAdaptiveResponseStage(game) {
  const response = game.adaptive;
  if (!response || game.phase === 'adaptive') return;
  const nextIndex = response.stageIndex + 1;
  if (nextIndex >= ADAPTIVE_RESPONSE_STAGES.length) {
    beginAdaptiveResponse(game);
    return;
  }
  response.stageIndex = nextIndex;
  response.stage = ADAPTIVE_RESPONSE_STAGES[nextIndex].id;
  response.progress = 0;
  response.phase = 0;
  if (response.stage === 'delivery') {
    const playableCourier = playerDendritic(game);
    response.courier.startX = playableCourier?.x ?? response.courier.x;
    response.courier.startY = playableCourier?.y ?? response.courier.y;
    response.courier.x = response.courier.startX;
    response.courier.y = response.courier.startY;
    response.courier.controlX = clamp(
      (response.courier.startX + response.node.x) / 2 + game.width * 0.08,
      80,
      game.width - 80
    );
    response.courier.controlY = clamp(
      Math.min(response.courier.startY, response.node.y) - game.height * 0.08,
      96,
      game.height - 80
    );
  }
  game.responsePulse = 0.9;
  playGameSound(game, 'stageComplete');
  const focus =
    response.stage === 'delivery' ? (playerDendritic(game) ?? response.courier) : response.node;
  game.effects.push({
    type: 'rally',
    x: focus.x,
    y: focus.y,
    radius: response.stage === 'delivery' ? 92 : 78,
    color: '#d9fff7',
    life: game.reducedMotion ? 0.28 : 0.8,
    maxLife: game.reducedMotion ? 0.28 : 0.8,
  });
}

function accelerateAdaptiveResponse(game, amount) {
  const response = game.adaptive;
  if (!response || game.phase === 'adaptive' || !['matching', 'cloning'].includes(response.stage)) {
    return false;
  }
  response.progress = clamp(response.progress + amount, 0, 1);
  response.bCellCopies = Math.max(1, 1 + Math.floor(response.progress * 7));
  game.responsePulse = 0.85;
  if (response.progress >= 1) advanceAdaptiveResponseStage(game);
  return true;
}

function addAntigenClue(game, fromX, fromY, collector = null) {
  const response = game.adaptive;
  if (
    game.experience !== 'defense' ||
    game.phase !== 'innate' ||
    !response ||
    response.stage !== 'sampling' ||
    response.samples >= response.samplesNeeded
  ) {
    return;
  }
  response.samples += 1;
  response.progress = response.samples / response.samplesNeeded;
  game.responsePulse = 0.5;
  const clueCollector = collector ?? response.courier;
  if (collector?.isPlayer) {
    collector.carriedSamples = Math.min(4, (collector.carriedSamples ?? 0) + 1);
  }
  game.effects.push({
    type: 'antigen-clue',
    x: clueCollector.x,
    y: clueCollector.y,
    fromX,
    fromY,
    owner: clueCollector,
    color: '#ff9bb6',
    life: game.reducedMotion ? 0.3 : 0.78,
    maxLife: game.reducedMotion ? 0.3 : 0.78,
  });
  if (response.samples >= response.samplesNeeded) advanceAdaptiveResponseStage(game);
}

function destroyBacterium(game, bacterium, source, style = 'burst') {
  if (!bacterium || bacterium.dead) return;
  releaseHostCell(game, bacterium, true);
  bacterium.dead = true;
  game.totalDestroyed += 1;
  leaveAntigenFragment(game, bacterium.x, bacterium.y, source?.role ?? null);
  if (source) source.kills += 1;
  const isPhagocytosis = style === 'engulf';
  const effectLife = isPhagocytosis ? (game.reducedMotion ? 0.28 : 0.82) : 0.34;
  game.effects.push({
    type: isPhagocytosis ? 'phagocytosis' : style,
    x: bacterium.x,
    y: bacterium.y,
    fromX: source?.x ?? bacterium.x,
    fromY: source?.y ?? bacterium.y,
    owner: isPhagocytosis ? source : null,
    bacteriumAngle: bacterium.angle,
    armored: bacterium.maxHp > 1,
    color: source ? ROLES[source.role].color : '#fff4a3',
    life: effectLife,
    maxLife: effectLife,
  });
  if (!isPhagocytosis) addParticles(game, bacterium.x, bacterium.y, '#fb7d92', 12);
}

function damageBacterium(game, bacterium, amount, source, style = 'burst') {
  if (!bacterium || bacterium.dead) return;
  const bonus = bacterium.marked > 0 ? 1.35 : 1;
  if (bonus > 1 && source) bacterium.bonusHit = 0.22;
  bacterium.hp -= amount * bonus;
  bacterium.hit = 0.14;
  if (bacterium.hp <= 0) destroyBacterium(game, bacterium, source, style);
}

function recordEducationAction(game, defender, action) {
  if (game.experience !== 'education' || !defender.isPlayer || !game.education) return;
  if (action === 'primary') game.education.primaryActions += 1;
  if (action === 'special') game.education.specialActions += 1;
}

function firePrimary(game, defender) {
  if (game.mode !== 'playing' || defender.actionCd > 0 || defender.fatigued > 0) return;
  if (
    game.experience === 'education' &&
    game.education?.stage === 2 &&
    game.education.beat === 1 &&
    defender.isPlayer
  ) {
    return;
  }
  if (defender.role === 'macrophage' && defender.exhausted > 0) return;
  defender.actionPulse = 0.34;

  if (defender.role === 'dendritic') {
    const response = game.adaptive;
    defender.actionCd = 0.72;
    if (response?.stage === 'sampling') {
      const fragment = game.antigenFragments
        .filter((candidate) => !candidate.collected && distance(defender, candidate) < 112)
        .sort((a, b) => distance(defender, a) - distance(defender, b))[0];
      if (!fragment) return;
      fragment.collected = true;
      defender.facing = Math.atan2(fragment.y - defender.y, fragment.x - defender.x);
      addAntigenClue(game, fragment.x, fragment.y, defender);
      playGameSound(game, 'collect');
      game.effects.push({
        type: 'sample-touch',
        x: fragment.x,
        y: fragment.y,
        fromX: defender.x,
        fromY: defender.y,
        color: ROLES.dendritic.color,
        life: game.reducedMotion ? 0.24 : 0.55,
        maxLife: game.reducedMotion ? 0.24 : 0.55,
      });
      return;
    }

    if (response && ['delivery', 'matching', 'cloning'].includes(response.stage)) {
      const atNode = distance(defender, response.node) < 138;
      if (response.stage === 'delivery') {
        if (!atNode) {
          playGameSound(game, 'signal');
          return;
        }
        response.progress = clamp(response.progress + 0.18, 0, 1);
        if (response.progress >= 1) advanceAdaptiveResponseStage(game);
      } else {
        accelerateAdaptiveResponse(game, atNode ? 0.12 : 0.045);
      }
      defender.facing = Math.atan2(response.node.y - defender.y, response.node.x - defender.x);
      playGameSound(game, atNode ? 'adaptive' : 'signal');
      game.effects.push({
        type: 'signal',
        x: response.node.x,
        y: response.node.y,
        fromX: defender.x,
        fromY: defender.y,
        color: ROLES.dendritic.color,
        life: 0.52,
        maxLife: 0.52,
      });
      return;
    }

    const target = nearestBacterium(game, defender, 250);
    if (target) {
      target.marked = Math.max(target.marked, 4.5);
      target.markedBy = defender.id;
      defender.facing = Math.atan2(target.y - defender.y, target.x - defender.x);
      playGameSound(game, 'signal');
      game.effects.push({
        type: 'signal',
        x: target.x,
        y: target.y,
        fromX: defender.x,
        fromY: defender.y,
        color: ROLES.dendritic.color,
        life: 0.42,
        maxLife: 0.42,
      });
    }
    return;
  }

  if (defender.role === 'macrophage') {
    const target = nearestBacterium(game, defender, defender.rage > 0 ? 112 : 92);
    const opsonizedMeal = target?.antibodyCoated > 0;
    defender.actionCd = defender.rage > 0 ? 0.3 : opsonizedMeal ? 0.26 : 0.58;
    if (target) {
      recordEducationAction(game, defender, 'primary');
      defender.facing = Math.atan2(target.y - defender.y, target.x - defender.x);
      playGameSound(game, 'engulf');
      damageBacterium(
        game,
        target,
        defender.rage > 0 ? 1.5 : opsonizedMeal ? 1.18 : 1.05,
        defender,
        'engulf'
      );
      defender.exhaustion += opsonizedMeal ? 0.45 : 1;
      if (defender.exhaustion >= 5 && defender.rage <= 0) {
        defender.exhaustion = 0;
        defender.exhausted = 3.8;
        playGameSound(game, 'exhaust');
        game.effects.push({
          type: 'metabolic-low',
          owner: defender,
          x: defender.x,
          y: defender.y,
          color: '#8ba0bd',
          life: game.reducedMotion ? 0.3 : 0.75,
          maxLife: game.reducedMotion ? 0.3 : 0.75,
        });
      }
    }
    return;
  }

  if (defender.role === 'neutrophil') {
    const target = nearestBacterium(game, defender, 340);
    if (target) {
      recordEducationAction(game, defender, 'primary');
      defender.facing = Math.atan2(target.y - defender.y, target.x - defender.x);
    }
    defender.actionCd = 0.36;
    playGameSound(game, 'shot');
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

  if (
    game.experience === 'education' &&
    game.education?.stage === 4 &&
    defender.role === 'helper'
  ) {
    defender.actionCd = 0.42;
    const target = game.education.helperTargets
      .map((candidate) => ({ candidate, distance: distance(defender, candidate) }))
      .sort((a, b) => a.distance - b.distance)[0];
    if (!target || target.distance > 72) return;
    defender.facing = Math.atan2(target.candidate.y - defender.y, target.candidate.x - defender.x);
    target.candidate.pulse = 0.6;
    if (!target.candidate.matches) {
      playGameSound(game, 'shot');
      return;
    }
    if (!game.education.helperMatched) {
      game.education.helperMatched = true;
      recordEducationAction(game, defender, 'primary');
      playGameSound(game, 'adaptive');
      game.effects.push({
        type: 'rally',
        x: target.candidate.x,
        y: target.candidate.y,
        radius: 120,
        color: ROLES.helper.color,
        life: 1.1,
        maxLife: 1.1,
      });
    }
    return;
  }

  defender.actionCd = 0.48;
  const target = nearestBacterium(game, defender, 250);
  if (target) {
    recordEducationAction(game, defender, 'primary');
    playGameSound(game, 'signal');
    target.marked = Math.max(target.marked, 5.5);
    target.markedBy = defender.id;
    if (defender.isPlayer) accelerateAdaptiveResponse(game, 0.035);
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
  const tiredMacrophage = helperBoostTarget(game, defender);
  if (tiredMacrophage) {
    const wasTired = tiredMacrophage.exhausted > 0 || tiredMacrophage.fatigued > 0;
    tiredMacrophage.fatigued = 0;
    tiredMacrophage.exhausted = 0;
    tiredMacrophage.exhaustion = 0;
    tiredMacrophage.actionCd = Math.min(tiredMacrophage.actionCd, 0.08);
    tiredMacrophage.rage = Math.max(tiredMacrophage.rage, 2.8);
    tiredMacrophage.rallied = Math.max(tiredMacrophage.rallied, 2.8);
    game.effects.push({
      type: 'cell-recharge',
      owner: tiredMacrophage,
      x: tiredMacrophage.x,
      y: tiredMacrophage.y,
      fromX: defender.x,
      fromY: defender.y,
      color: ROLES.helper.color,
      life: game.reducedMotion ? 0.28 : wasTired ? 0.72 : 0.48,
      maxLife: game.reducedMotion ? 0.28 : wasTired ? 0.72 : 0.48,
    });
    if (wasTired) {
      playGameSound(game, 'recharge');
    }
  }
}

function fireSpecial(game, defender) {
  if (game.mode !== 'playing' || defender.specialCd > 0 || defender.fatigued > 0) return;
  if (
    game.experience === 'education' &&
    game.education?.stage === 2 &&
    game.education.beat === 0 &&
    defender.isPlayer
  ) {
    return;
  }
  if (
    game.experience === 'education' &&
    game.education?.stage === 4 &&
    defender.role === 'helper' &&
    !game.education.helperMatched
  ) {
    return;
  }
  if (
    game.experience !== 'education' ||
    game.education?.stage !== 4 ||
    defender.role !== 'helper' ||
    game.education.helperMatched
  ) {
    recordEducationAction(game, defender, 'special');
  }
  defender.specialPulse = 0.8;

  if (defender.role === 'dendritic') {
    const response = game.adaptive;
    defender.specialCd = ROLES.dendritic.specialCooldown;
    playGameSound(game, 'rally');
    game.effects.push({
      type: 'rally',
      x: defender.x,
      y: defender.y,
      radius: 250,
      color: ROLES.dendritic.color,
      life: game.reducedMotion ? 0.3 : 0.9,
      maxLife: game.reducedMotion ? 0.3 : 0.9,
    });

    if (response?.stage === 'sampling') {
      const fragments = game.antigenFragments
        .filter((fragment) => !fragment.collected && distance(defender, fragment) < 250)
        .sort((a, b) => distance(defender, a) - distance(defender, b))
        .slice(0, 3);
      for (const fragment of fragments) {
        fragment.collected = true;
        addAntigenClue(game, fragment.x, fragment.y, defender);
      }
      if (fragments.length > 0) playGameSound(game, 'collect');
      return;
    }

    if (response && ['delivery', 'matching', 'cloning'].includes(response.stage)) {
      const atNode = distance(defender, response.node) < 160;
      if (response.stage === 'delivery') {
        if (!atNode) return;
        response.progress = clamp(response.progress + 0.32, 0, 1);
        if (response.progress >= 1) advanceAdaptiveResponseStage(game);
      } else {
        accelerateAdaptiveResponse(game, atNode ? 0.28 : 0.16);
      }
      game.effects.push({
        type: 'signal',
        x: response.node.x,
        y: response.node.y,
        fromX: defender.x,
        fromY: defender.y,
        color: ROLES.dendritic.color,
        life: 0.7,
        maxLife: 0.7,
      });
      return;
    }

    for (const bacterium of game.bacteria) {
      if (distance(defender, bacterium) >= 250) continue;
      bacterium.marked = Math.max(bacterium.marked, 5.5);
      bacterium.markedBy = defender.id;
    }
    for (const ally of game.defenders) {
      if (ally.id === defender.id || distance(defender, ally) >= 250) continue;
      ally.actionCd = Math.min(ally.actionCd, 0.08);
      ally.rallied = Math.max(ally.rallied, 1.6);
    }
    return;
  }

  if (defender.role === 'macrophage') {
    playGameSound(game, 'rush');
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
    return;
  }

  if (defender.role === 'neutrophil') {
    playGameSound(game, 'net');
    defender.specialCd = 12;
    defender.fatigued = 1.25;
    defender.netosisReplacement = game.experience === 'education';
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
    damageTissueArea(game, defender.x, defender.y, 205, 0.018);
    return;
  }

  playGameSound(game, 'rally');
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
  const isEducationCommand =
    game.experience === 'education' && game.education?.stage === 4 && defender.isPlayer;
  const rallyRange = isEducationCommand ? Number.POSITIVE_INFINITY : 240;
  for (const ally of game.defenders) {
    if (distance(defender, ally) > rallyRange) continue;
    ally.actionCd = 0;
    ally.fatigued = Math.min(ally.fatigued, 0.3);
    ally.rallied = Math.max(ally.rallied, 1.4);
    if (ally.id !== defender.id) {
      game.effects.push({
        type: 'rally-link',
        owner: ally,
        x: ally.x,
        y: ally.y,
        fromX: defender.x,
        fromY: defender.y,
        color: ROLES.helper.color,
        life: game.reducedMotion ? 0.25 : 0.68,
        maxLife: game.reducedMotion ? 0.25 : 0.68,
      });
    }
    if (ally.role === 'macrophage') {
      const wasTired = ally.exhausted > 0 || ally.exhaustion > 0;
      ally.exhaustion = 0;
      ally.exhausted = 0;
      ally.rage = Math.max(ally.rage, 6);
      if (isEducationCommand && wasTired) {
        game.effects.push({
          type: 'cell-recharge',
          owner: ally,
          x: ally.x,
          y: ally.y,
          fromX: defender.x,
          fromY: defender.y,
          color: ROLES.helper.color,
          life: game.reducedMotion ? 0.3 : 1.1,
          maxLife: game.reducedMotion ? 0.3 : 1.1,
        });
        playGameSound(game, 'recharge');
      }
    }
  }
  for (const bacterium of game.bacteria) {
    if (distance(defender, bacterium) < 240) {
      bacterium.marked = Math.max(bacterium.marked, 6);
      bacterium.markedBy = defender.id;
    }
  }
  const responseAdvanced = accelerateAdaptiveResponse(game, defender.isPlayer ? 0.18 : 0.05);
  if (responseAdvanced) {
    game.effects.push({
      type: 'response-boost',
      x: defender.x,
      y: defender.y,
      color: '#fff3a8',
      life: game.reducedMotion ? 0.4 : 1.05,
      maxLife: game.reducedMotion ? 0.4 : 1.05,
    });
  }
}

function divideBacteria(game) {
  const maxBacteria = game.population?.maxBacteria ?? MAX_BACTERIA;
  if (game.phase !== 'innate' || game.bacteria.length >= maxBacteria) return;
  const living = game.bacteria.filter((bacterium) => !bacterium.dead && bacterium.clumped <= 0);
  if (living.length === 0) return;
  const count = Math.min(2 + Math.floor(game.elapsed / 18), 4, maxBacteria - living.length);
  const chosen = living.sort(() => Math.random() - 0.5).slice(0, count);
  if (chosen.length > 0) playGameSound(game, 'division');
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
  playGameSound(game, 'adaptive');
  game.phase = 'adaptive';
  game.responseStartedAt = game.elapsed;
  game.timeLeft = 0;
  game.nextAntibody = 0;
  if (game.adaptive) {
    const node = game.adaptive.node;
    game.adaptive.stage = 'antibodies';
    game.adaptive.stageIndex = ADAPTIVE_RESPONSE_STAGES.length;
    game.adaptive.progress = 1;
    game.adaptive.phase = 0;
    const patrolPoints = [
      { x: game.width * 0.72, y: game.height * 0.32 },
      { x: game.width * 0.5, y: game.height * 0.68 },
      { x: game.width * 0.28, y: game.height * 0.38 },
    ];
    game.adaptive.plasmaCells = patrolPoints.map((target, index) => ({
      id: game.nextId++,
      x: node.x,
      y: node.y + 28,
      targetX: target.x,
      targetY: target.y,
      phase: index * 1.8,
      entryDelay: index * 0.34,
      active: index === 0,
    }));
  }
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
}

function updateDendriticSampling(game, response, dt) {
  const courier = response.courier;
  courier.sampleCooldown = Math.max(0, courier.sampleCooldown - dt);
  response.passiveSampleTimer -= dt;
  if (response.passiveSampleTimer <= 0) {
    response.passiveSampleTimer = 4;
    leaveAntigenFragment(game, courier.x + randomBetween(-8, 8), courier.y + randomBetween(-8, 8));
  }

  const nearestFragment = game.antigenFragments
    .filter((fragment) => !fragment.collected)
    .sort((a, b) => distance(courier, a) - distance(courier, b))[0];
  const touchingLivingSample = game.bacteria
    .filter((bacterium) => !bacterium.dead && !bacterium.sampledByDendritic)
    .map((bacterium) => ({ bacterium, distance: distance(courier, bacterium) }))
    .filter((candidate) => candidate.distance < 38 * game.cellScale)
    .sort((a, b) => a.distance - b.distance)[0]?.bacterium;

  let target = nearestFragment;
  if (!target) {
    courier.wanderTimer -= dt;
    if (
      courier.wanderTimer <= 0 ||
      Math.hypot(courier.x - courier.wanderX, courier.y - courier.wanderY) < 12
    ) {
      const angle = Math.random() * TAU;
      const radius = randomBetween(45, Math.min(180, game.width * 0.2));
      courier.wanderX = clamp(game.breach.x + Math.cos(angle) * radius, 40, game.width - 40);
      courier.wanderY = clamp(game.breach.y + Math.sin(angle) * radius, 96, game.height - 40);
      courier.wanderTimer = randomBetween(1.5, 2.8);
    }
    target = { x: courier.wanderX, y: courier.wanderY };
  }

  const dx = target.x - courier.x;
  const dy = target.y - courier.y;
  const targetDistance = Math.hypot(dx, dy) || 1;
  const speed = nearestFragment ? 112 : 58;
  courier.x += (dx / targetDistance) * Math.min(targetDistance, speed * dt);
  courier.y += (dy / targetDistance) * Math.min(targetDistance, speed * dt);
  courier.facing = Math.atan2(dy, dx);

  if (nearestFragment && targetDistance < 28 * game.cellScale && courier.sampleCooldown <= 0) {
    nearestFragment.collected = true;
    courier.sampleCooldown = 0.62;
    addAntigenClue(game, nearestFragment.x, nearestFragment.y);
    playGameSound(game, 'collect');
  } else if (!nearestFragment && touchingLivingSample && courier.sampleCooldown <= 0) {
    touchingLivingSample.sampledByDendritic = true;
    courier.sampleCooldown = 1.1;
    addAntigenClue(game, touchingLivingSample.x, touchingLivingSample.y);
    game.effects.push({
      type: 'sample-touch',
      x: touchingLivingSample.x,
      y: touchingLivingSample.y,
      fromX: courier.x,
      fromY: courier.y,
      color: '#d9fff7',
      life: game.reducedMotion ? 0.24 : 0.55,
      maxLife: game.reducedMotion ? 0.24 : 0.55,
    });
    playGameSound(game, 'collect');
  }
}

function updatePlasmaCells(game, plasmaCells, dt) {
  for (const plasmaCell of plasmaCells) {
    plasmaCell.phase += dt * 3.4;
    plasmaCell.entryDelay = Math.max(0, (plasmaCell.entryDelay ?? 0) - dt);
    if (plasmaCell.entryDelay > 0) continue;
    plasmaCell.active = true;
    const dx = plasmaCell.targetX - plasmaCell.x;
    const dy = plasmaCell.targetY - plasmaCell.y;
    const targetDistance = Math.hypot(dx, dy) || 1;
    if (targetDistance < 24) {
      const nearbyTarget = game.bacteria
        .filter((bacterium) => !bacterium.dead)
        .sort(() => Math.random() - 0.5)[0];
      plasmaCell.targetX = clamp(
        (nearbyTarget?.x ?? game.breach.x) + randomBetween(-95, 95),
        56,
        game.width - 56
      );
      plasmaCell.targetY = clamp(
        (nearbyTarget?.y ?? game.breach.y) + randomBetween(-85, 85),
        108,
        game.height - 56
      );
      continue;
    }
    const speed = 68;
    plasmaCell.x += (dx / targetDistance) * Math.min(targetDistance, speed * dt);
    plasmaCell.y += (dy / targetDistance) * Math.min(targetDistance, speed * dt);
  }
}

function updateAdaptiveResponse(game, dt) {
  const response = game.adaptive;
  if (!response) return;
  response.elapsed += dt;
  response.phase += dt * 3;
  updatePlasmaCells(game, response.plasmaCells, dt);
  if (game.phase === 'adaptive') return;
  if (response.elapsed >= 85) {
    beginAdaptiveResponse(game);
    return;
  }

  if (response.stage === 'sampling') {
    const playableCourier = playerDendritic(game);
    if (playableCourier) {
      response.passiveSampleTimer -= dt;
      if (response.passiveSampleTimer <= 0) {
        response.passiveSampleTimer = 4;
        leaveAntigenFragment(
          game,
          game.breach.x + randomBetween(-42, 42),
          game.breach.y + randomBetween(-42, 42)
        );
      }
    } else {
      updateDendriticSampling(game, response, dt);
    }
    if (response.stage === 'sampling') {
      response.progress = response.samples / response.samplesNeeded;
    }
  } else if (response.stage === 'delivery') {
    const playableCourier = playerDendritic(game);
    if (playableCourier) {
      const atNode = distance(playableCourier, response.node) < 128;
      if (atNode) response.progress = clamp(response.progress + dt * 0.34, 0, 1);
    } else {
      const nearbyThreat = nearestBacterium(game, response.courier, 118);
      const targetSpeed = nearbyThreat ? 58 : 84;
      response.courier.travelSpeed +=
        (targetSpeed - response.courier.travelSpeed) * Math.min(1, dt * 1.6);
      response.progress = advanceCourierAtSteadySpeed(
        response.courier,
        response.progress,
        dt,
        response.courier.travelSpeed
      );
    }
  } else if (response.stage === 'matching') {
    response.progress = clamp(response.progress + dt / 6.5, 0, 1);
  } else if (response.stage === 'cloning') {
    response.progress = clamp(response.progress + dt / 6.5, 0, 1);
    response.bCellCopies = Math.max(1, 1 + Math.floor(response.progress * 7));
  }

  game.timeLeft = Math.ceil((1 - adaptiveOverallProgress(game)) * ROUND_TIME);
  if (response.progress >= 1 && response.stage !== 'sampling') {
    advanceAdaptiveResponseStage(game);
  }
}

function addComplementEffect(game, target) {
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
}

function ruptureWithComplement(game, target) {
  if (!target || target.dead) return;
  addComplementEffect(game, target);
  damageBacterium(game, target, target.maxHp + 1, null, 'complement-lysis');
}

function activateComplement(game) {
  const target = game.bacteria
    .filter((bacterium) => !bacterium.dead)
    .sort(
      (a, b) =>
        Number(b.antibodyCoated > 0) - Number(a.antibodyCoated > 0) ||
        a.marked - b.marked ||
        Math.random() - 0.5
    )[0];
  if (!target) return;
  const isAntibodyCoated = target.antibodyCoated > 0;
  const membraneRupture = isAntibodyCoated && Math.random() < 0.08;
  target.marked = Math.max(target.marked, 4.5);
  if (membraneRupture) {
    ruptureWithComplement(game, target);
    return;
  }
  if (isAntibodyCoated) {
    target.antibodyCoated = Math.max(target.antibodyCoated, 3.5);
    target.clumped = Math.max(target.clumped, 2.4);
  }
  addComplementEffect(game, target);
}

function applyAntibodyCoating(game, target) {
  if (!target || target.dead) return;
  const clusterId = target.antibodyCluster ?? target.id;
  const partners =
    Math.random() < 0.3
      ? game.bacteria
          .filter(
            (bacterium) =>
              bacterium.id !== target.id &&
              !bacterium.dead &&
              distance(target, bacterium) < 82 &&
              bacterium.antibodyCoated <= 0
          )
          .sort((a, b) => distance(target, a) - distance(target, b))
          .slice(0, 1)
      : [];

  for (const [index, bacterium] of [target, ...partners].entries()) {
    const newlyCoated = bacterium.antibodyCoated <= 0;
    if (bacterium.latchedTo) releaseHostCell(game, bacterium, true);
    bacterium.hostTargetId = null;
    bacterium.antibodyCoated = Math.max(bacterium.antibodyCoated, index === 0 ? 7.5 : 5.5);
    bacterium.antibodyPulse = Math.max(bacterium.antibodyPulse, 0.32);
    bacterium.clumped = Math.max(bacterium.clumped, index === 0 ? 5.5 : 4.5);
    bacterium.marked = Math.max(bacterium.marked, 7.5);
    bacterium.markedBy = null;
    bacterium.antibodyCluster = clusterId;
    if (newlyCoated) game.germsCoated += 1;
  }
  addParticles(game, target.x, target.y, '#fff1a8', 6, 55);
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
    const baseDelay = cell.role === 'macrophage' ? 2.8 : cell.role === 'neutrophil' ? 2 : 2.1;
    const aiDelay = baseDelay * (game.phase === 'adaptive' ? 1.35 : 1);
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

function ensureEducationBacteria(game, count) {
  while (game.bacteria.filter((bacterium) => !bacterium.dead).length < count) {
    const angle = Math.random() * TAU;
    const radius = randomBetween(58, 148);
    const bacterium = makeBacterium(
      game,
      game.breach.x + Math.cos(angle) * radius,
      game.breach.y + Math.sin(angle) * radius
    );
    bacterium.hunter = Math.random() < 0.16;
    game.bacteria.push(bacterium);
  }
}

function addEducationAlly(game, role) {
  const existing = game.defenders.find((cell) => !cell.isPlayer && cell.role === role);
  if (existing) return existing;
  const ally = makeDefender(game, role, game.defenders.length, false);
  ally.label = role === 'macrophage' ? 'Resident ally' : `${ROLES[role].name} ally`;
  game.defenders.push(ally);
  return ally;
}

function setEducationPlayerRole(game, role, x = null, y = null) {
  const player = game.defenders.find((cell) => cell.isPlayer);
  if (!player) return null;
  player.role = role;
  player.label = 'YOU';
  player.actionCd = 0;
  player.specialCd = 0;
  player.fatigued = 0;
  player.netosisReplacement = false;
  player.exhausted = 0;
  player.exhaustion = 0;
  player.rage = 0;
  player.rallied = 0;
  if (x !== null) player.x = x;
  if (y !== null) player.y = y;
  game.effects.push({
    type: 'lesson-transition',
    x: player.x,
    y: player.y,
    color: ROLES[role].color,
    life: game.reducedMotion ? 0.25 : 0.8,
    maxLife: game.reducedMotion ? 0.25 : 0.8,
  });
  playGameSound(game, 'recharge');
  return player;
}

function advanceEducationStage(game) {
  const education = game.education;
  if (!education) return;
  const nextStage = education.stage + 1;
  if (nextStage >= LEARNING_STAGES.length) {
    education.progress = 1;
    game.earlyClear = false;
    game.mode = 'won';
    playGameSound(game, 'win');
    return;
  }

  education.stage = nextStage;
  education.beat = 0;
  education.stageElapsed = 0;
  education.progress = 0;
  education.primaryActions = 0;
  education.specialActions = 0;
  education.courier = null;
  education.helperTargets = [];
  education.helperMatched = false;
  education.memoryCells = [];
  const node = { x: game.width - 104, y: 124 };
  let player = game.defenders.find((cell) => cell.isPlayer);

  if (nextStage === 1) {
    player = setEducationPlayerRole(game, 'macrophage');
    ensureEducationBacteria(game, 10);
  } else if (nextStage === 2) {
    addEducationAlly(game, 'macrophage');
    player = setEducationPlayerRole(game, 'neutrophil');
    ensureEducationBacteria(game, 14);
  } else if (nextStage === 3) {
    player = setEducationPlayerRole(game, 'neutrophil');
    education.courier = {
      x: game.breach.x,
      y: game.breach.y,
      startX: game.breach.x,
      startY: game.breach.y,
      targetX: node.x,
      targetY: node.y,
      controlX: game.width * 0.7,
      controlY: Math.max(96, game.breach.y - game.height * 0.18),
      progress: 0,
      phase: 0,
      travelSpeed: 68,
    };
    ensureEducationBacteria(game, 12);
  } else if (nextStage === 4) {
    addEducationAlly(game, 'neutrophil');
    const macrophage = addEducationAlly(game, 'macrophage');
    macrophage.exhausted = 8;
    macrophage.exhaustion = 5;
    player = setEducationPlayerRole(game, 'helper', node.x - 24, node.y + 54);
    education.helperTargets = [
      { x: node.x - 118, y: node.y + 18, shape: 0, matches: false, pulse: 0 },
      { x: node.x - 54, y: node.y + 92, shape: 1, matches: true, pulse: 0 },
      { x: node.x + 28, y: node.y + 76, shape: 2, matches: false, pulse: 0 },
    ];
    ensureEducationBacteria(game, 9);
  } else if (nextStage === 5) {
    addEducationAlly(game, 'helper');
    player = setEducationPlayerRole(game, 'macrophage', game.breach.x - 72, game.breach.y + 24);
    game.bacteria = game.bacteria.filter((bacterium) => !bacterium.dead).slice(0, 18);
    ensureEducationBacteria(game, 16);
    for (let index = 0; index < game.tissue.health.length; index += 1) {
      game.tissue.health[index] = Math.max(0.46, game.tissue.health[index]);
    }
    game.integrity = Math.max(55, game.integrity);
    education.plasmaCell = {
      id: game.nextId++,
      x: node.x,
      y: node.y + 28,
      targetX: game.width * 0.58,
      targetY: game.height * 0.38,
      phase: 0,
      entryDelay: 0,
      active: true,
    };
    game.nextIngress = Number.POSITIVE_INFINITY;
    game.nextDivision = Number.POSITIVE_INFINITY;
    beginAdaptiveResponse(game);
  } else if (nextStage === 6) {
    player = setEducationPlayerRole(game, 'macrophage', game.breach.x - 80, game.breach.y + 40);
    game.bacteria.length = 0;
    ensureEducationBacteria(game, 8);
    for (const bacterium of game.bacteria) {
      bacterium.marked = 8;
      bacterium.clumped = 8;
    }
    education.memoryCells = [
      { x: node.x - 30, y: node.y + 58, color: '#8df29a', phase: 0 },
      { x: node.x + 28, y: node.y + 54, color: '#c58cff', phase: 1.8 },
    ];
    game.nextAntibody = 0;
  }

  education.stageStartKills = player?.kills ?? 0;
  education.stageStartBacteria = Math.max(1, game.bacteria.length);
  game.mode = 'tour';
  playGameSound(game, 'stageComplete');
}

function continueEducationTour(game) {
  if (game.mode !== 'tour' || !game.education) return false;
  game.mode = 'playing';
  game.education.stageElapsed = 0;
  playGameSound(game, 'guide');
  return true;
}

function updateEducation(game, dt) {
  const education = game.education;
  if (!education) return;
  education.stageElapsed += dt;
  for (const target of education.helperTargets) {
    target.pulse = Math.max(0, target.pulse - dt);
  }
  for (const memoryCell of education.memoryCells) memoryCell.phase += dt * 2.2;
  if (education.plasmaCell) updatePlasmaCells(game, [education.plasmaCell], dt);
  const player = game.defenders.find((cell) => cell.isPlayer);
  if (!player) return;

  if (education.stage === 0) {
    const remaining = distance(player, game.breach);
    education.progress = clamp(1 - (remaining - 100) / 100, 0, 1);
    if (remaining < 112 && education.stageElapsed > 0.35) advanceEducationStage(game);
    return;
  }

  if (education.stage === 1) {
    const engulfed = player.kills - education.stageStartKills;
    education.progress = clamp(engulfed / 4, 0, 1);
    if (engulfed >= 4) advanceEducationStage(game);
    else ensureEducationBacteria(game, 6);
    return;
  }

  if (education.stage === 2) {
    const toxinProgress = Math.min(3, education.primaryActions);
    const netProgress = Math.min(1, education.specialActions);
    education.progress = (toxinProgress + netProgress) / 4;
    if (toxinProgress >= 3 && education.beat === 0) {
      education.beat = 1;
      education.stageElapsed = 0;
      game.mode = 'tour';
      playGameSound(game, 'stageComplete');
      return;
    }
    if (
      toxinProgress >= 3 &&
      netProgress >= 1 &&
      player.fatigued === 0 &&
      education.stageElapsed > 1.5
    ) {
      advanceEducationStage(game);
    } else {
      ensureEducationBacteria(game, 8);
    }
    return;
  }

  if (education.stage === 3) {
    const courier = education.courier;
    if (!courier) return;
    courier.phase += dt * 4;
    const nearbyThreat = nearestBacterium(game, courier, 118);
    const targetSpeed = nearbyThreat ? 58 : 84;
    courier.travelSpeed += (targetSpeed - courier.travelSpeed) * Math.min(1, dt * 1.6);
    courier.progress = advanceCourierAtSteadySpeed(
      courier,
      courier.progress,
      dt,
      courier.travelSpeed
    );
    education.progress = courier.progress;
    if (courier.progress >= 1) advanceEducationStage(game);
    else ensureEducationBacteria(game, 7);
    return;
  }

  if (education.stage === 4) {
    const matchProgress = education.helperMatched ? 1 : 0;
    const rallyProgress = Math.min(1, education.specialActions);
    education.progress = (matchProgress + rallyProgress) / 2;
    if (matchProgress >= 1 && education.beat === 0) {
      education.beat = 1;
      education.stageElapsed = 0;
      game.mode = 'tour';
      playGameSound(game, 'stageComplete');
      return;
    }
    if (matchProgress >= 1 && rallyProgress >= 1 && education.stageElapsed > 1.5) {
      advanceEducationStage(game);
    } else {
      ensureEducationBacteria(game, 7);
    }
    return;
  }

  if (education.stage === 5) {
    education.progress = clamp(1 - game.bacteria.length / education.stageStartBacteria, 0, 1);
    if (game.bacteria.length === 0 && education.stageElapsed > 2) advanceEducationStage(game);
    return;
  }

  if (education.stage === 6) {
    education.progress = clamp(education.stageElapsed / 5, 0, 1);
    if ((game.bacteria.length === 0 && education.stageElapsed > 2) || education.stageElapsed > 7) {
      game.bacteria.length = 0;
      advanceEducationStage(game);
    }
  }
}

function updateGame(game, dt, keys, gamepads, buttonEdges, touchInput) {
  game.elapsed += dt;
  game.breach.pulse += dt;
  game.responsePulse = Math.max(0, game.responsePulse - dt);
  updatePlayers(game, dt, keys, gamepads, buttonEdges, touchInput);

  game.nextComplement -= dt;
  if (game.nextComplement <= 0) {
    activateComplement(game);
    game.nextComplement = game.phase === 'adaptive' ? 2.4 : 2.2;
  }

  game.nextIngress -= dt;
  if (game.nextIngress <= 0) {
    const entered = spawnIncomingBacteriaWave(game);
    game.nextIngress = entered
      ? game.phase === 'adaptive'
        ? randomBetween(8, 11)
        : randomBetween(6.2, 8.2)
      : 1.5;
  }

  if (game.experience === 'defense') {
    updateAdaptiveResponse(game, dt);
    game.nextReinforcement -= dt;
    if (game.nextReinforcement <= 0) {
      const reinforced = spawnDefenderReinforcementWave(game);
      game.nextReinforcement = reinforced ? randomBetween(10.5, 13.5) : 4;
    }
  }

  if (game.phase === 'innate' && game.experience === 'defense') {
    game.nextDivision -= dt;
    if (game.nextDivision <= 0) {
      divideBacteria(game);
      game.nextDivision = Math.max(2.7, 4.2 - game.elapsed * 0.025);
    }
  } else if (game.phase === 'innate') {
    game.timeLeft = ROUND_TIME;
    if (game.education?.stage >= 1 && game.education.stage <= 3) {
      game.nextDivision -= dt;
      if (game.nextDivision <= 0) {
        divideBacteria(game);
        game.nextDivision = 7.4;
      }
    }
  } else {
    game.nextAntibody -= dt;
    if (game.nextAntibody <= 0) {
      const targets = game.bacteria
        .filter((bacterium) => !bacterium.dead)
        .sort(() => Math.random() - 0.5)
        .slice(0, 1);
      for (const [index, target] of targets.entries()) {
        const plasmaCells =
          game.adaptive?.plasmaCells ??
          (game.education?.plasmaCell ? [game.education.plasmaCell] : []);
        const activePlasmaCells = plasmaCells.filter((plasmaCell) => plasmaCell.active !== false);
        const factory = plasmaCells[(game.antibodyHits + index) % Math.max(1, plasmaCells.length)];
        const mobileFactory =
          activePlasmaCells[(game.antibodyHits + index) % Math.max(1, activePlasmaCells.length)] ??
          factory;
        game.effects.push({
          type: 'antibody',
          x: target.x,
          y: target.y,
          targetId: target.id,
          owner: target,
          applied: false,
          fromX: mobileFactory?.x ?? target.x + randomBetween(-100, 100),
          fromY: mobileFactory?.y ?? -30,
          color: '#fff1a8',
          life: 0.75,
          maxLife: 0.75,
        });
        game.antibodyHits += 1;
      }
      game.nextAntibody = 0.9;
    }
  }

  for (const cell of game.defenders) {
    cell.actionCd = Math.max(0, cell.actionCd - dt);
    cell.specialCd = Math.max(0, cell.specialCd - dt);
    const wasFatigued = cell.fatigued > 0;
    cell.fatigued = Math.max(0, cell.fatigued - dt);
    if (wasFatigued && cell.fatigued === 0 && cell.netosisReplacement) {
      cell.netosisReplacement = false;
      cell.x = 46;
      cell.y = clamp(game.breach.y + 150, 110, game.height - 46);
      game.effects.push({
        type: 'arrival',
        x: cell.x,
        y: cell.y,
        fromX: -32,
        fromY: cell.y,
        color: ROLES.neutrophil.color,
        life: game.reducedMotion ? 0.25 : 0.72,
        maxLife: game.reducedMotion ? 0.25 : 0.72,
      });
      playGameSound(game, 'arrival');
    }
    const wasExhausted = cell.exhausted > 0;
    cell.exhausted = Math.max(0, cell.exhausted - dt);
    if (wasExhausted && cell.exhausted === 0 && cell.role === 'macrophage') {
      playGameSound(game, 'recharge');
      game.effects.push({
        type: 'cell-recharge',
        owner: cell,
        x: cell.x,
        y: cell.y,
        fromX: cell.x,
        fromY: cell.y,
        color: '#baf8ff',
        life: game.reducedMotion ? 0.3 : 0.65,
        maxLife: game.reducedMotion ? 0.3 : 0.65,
      });
    }
    cell.rage = Math.max(0, cell.rage - dt);
    cell.rallied = Math.max(0, cell.rallied - dt);
    cell.actionPulse = Math.max(0, cell.actionPulse - dt);
    cell.specialPulse = Math.max(0, cell.specialPulse - dt);
    if (!cell.isPlayer) updateAI(game, cell, dt);
    cell.x = clamp(cell.x, 30, game.width - 30);
    cell.y = clamp(cell.y, 78, game.height - 30);
  }

  updateHostCells(game, dt);

  for (const fragment of game.antigenFragments) {
    fragment.life -= dt;
    fragment.phase += dt * 2.5;
  }
  game.antigenFragments = game.antigenFragments.filter(
    (fragment) => !fragment.collected && fragment.life > 0
  );

  for (const bacterium of game.bacteria) {
    bacterium.hit = Math.max(0, bacterium.hit - dt);
    bacterium.marked = Math.max(0, bacterium.marked - dt);
    bacterium.bonusHit = Math.max(0, bacterium.bonusHit - dt);
    if (bacterium.marked === 0) bacterium.markedBy = null;
    bacterium.clumped = Math.max(0, bacterium.clumped - dt);
    bacterium.antibodyCoated = Math.max(0, bacterium.antibodyCoated - dt);
    bacterium.antibodyPulse = Math.max(0, bacterium.antibodyPulse - dt);
    if (bacterium.antibodyCoated === 0) {
      bacterium.antibodyCluster = null;
    }
    bacterium.dividing = Math.max(0, bacterium.dividing - dt);
    bacterium.wiggle += dt * 7;
    if (bacterium.dead) continue;

    if (bacterium.antibodyCoated > 0 && bacterium.latchedTo) {
      releaseHostCell(game, bacterium, true);
    }

    if (bacterium.latchedTo) {
      const hostCell = game.hostCells.find(
        (cell) => cell.id === bacterium.latchedTo && cell.dying <= 0
      );
      if (hostCell) {
        const latchSide = bacterium.id % 2 === 0 ? 1 : -1;
        bacterium.x = hostCell.x + latchSide * 18 * game.cellScale;
        bacterium.y = hostCell.y + Math.sin(bacterium.wiggle) * 8 * game.cellScale;
        bacterium.angle = Math.atan2(hostCell.y - bacterium.y, hostCell.x - bacterium.x);
        continue;
      }
      releaseHostCell(game, bacterium, false);
    }

    let hostTarget = null;
    if (bacterium.hunter && bacterium.clumped <= 0 && bacterium.antibodyCoated <= 0) {
      hostTarget = game.hostCells.find(
        (cell) => cell.id === bacterium.hostTargetId && cell.dying <= 0 && !cell.attackerId
      );
      if (!hostTarget) {
        hostTarget = game.hostCells
          .filter((cell) => cell.dying <= 0 && !cell.attackerId)
          .map((cell) => ({ cell, distance: distance(bacterium, cell) }))
          .filter((candidate) => candidate.distance < 190)
          .sort((a, b) => a.distance - b.distance)[0]?.cell;
        bacterium.hostTargetId = hostTarget?.id ?? null;
      }
    }

    if (hostTarget) {
      const dx = hostTarget.x - bacterium.x;
      const dy = hostTarget.y - bacterium.y;
      const targetDistance = Math.hypot(dx, dy) || 1;
      if (targetDistance < 23 * game.cellScale + 10) {
        bacterium.latchedTo = hostTarget.id;
        hostTarget.attackerId = bacterium.id;
        playGameSound(game, 'cellAlert');
        continue;
      }
      const chaseSpeed = 56;
      const steer = Math.min(1, dt * 3.4);
      bacterium.vx += ((dx / targetDistance) * chaseSpeed - bacterium.vx) * steer;
      bacterium.vy += ((dy / targetDistance) * chaseSpeed - bacterium.vy) * steer;
      bacterium.angle = Math.atan2(dy, dx);
    }

    const speedFactor =
      bacterium.clumped > 0
        ? 0.08
        : bacterium.antibodyCoated > 0
          ? 0.25
          : bacterium.marked > 0
            ? 0.62
            : 1;
    bacterium.x += bacterium.vx * dt * speedFactor;
    bacterium.y += bacterium.vy * dt * speedFactor;
    if (bacterium.x < 22 || bacterium.x > game.width - 22) bacterium.vx *= -1;
    if (bacterium.y < 78 || bacterium.y > game.height - 22) bacterium.vy *= -1;
    bacterium.x = clamp(bacterium.x, 22, game.width - 22);
    bacterium.y = clamp(bacterium.y, 78, game.height - 22);
  }

  updateTissue(game, dt);
  if (game.experience === 'education') game.integrity = Math.max(18, game.integrity);
  for (const threshold of [70, 35]) {
    if (game.integrity <= threshold && !game.integrityWarnings.has(threshold)) {
      game.integrityWarnings.add(threshold);
      playGameSound(game, 'warning');
    }
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
    if (effect.type === 'antibody' && !effect.applied && effect.life <= effect.maxLife * 0.18) {
      const target = game.bacteria.find(
        (bacterium) => bacterium.id === effect.targetId && !bacterium.dead
      );
      if (target) applyAntibodyCoating(game, target);
      effect.applied = true;
    }
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

  if (game.experience === 'education') updateEducation(game, dt);

  if (game.experience === 'education') {
    return;
  }
  if (game.integrity <= 0) {
    playGameSound(game, 'lose');
    game.mode = 'lost';
  } else if (game.bacteria.length === 0) {
    playGameSound(game, 'win');
    game.earlyClear = game.phase === 'innate';
    game.mode = 'won';
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

function drawTissue(ctx, game) {
  const tissue = game.tissue;
  const baseRadius = Math.min(tissue.cellWidth, tissue.cellHeight) * 0.43;
  for (let row = 0; row < tissue.rows; row += 1) {
    for (let column = 0; column < tissue.columns; column += 1) {
      const index = row * tissue.columns + column;
      const health = tissue.health[index];
      const danger = tissue.danger[index];
      const seed = index * 12.9898;
      const offsetX = Math.sin(seed) * tissue.cellWidth * 0.08;
      const offsetY = Math.cos(seed * 1.7) * tissue.cellHeight * 0.08;
      const x = (column + 0.5) * tissue.cellWidth + offsetX;
      const y = tissue.top + (row + 0.5) * tissue.cellHeight + offsetY;
      const damagedScale = 0.82 + health * 0.18;
      const pulse =
        danger > 0 && !game.reducedMotion
          ? 1 + Math.sin(game.elapsed * 5 + index) * 0.045 * danger
          : 1;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.sin(seed * 0.3) * 0.22);
      ctx.scale(pulse * damagedScale, pulse * damagedScale);
      ctx.fillStyle = tissueHealthColor(health, 0.13 + danger * 0.14 + (1 - health) * 0.12);
      ctx.strokeStyle = tissueHealthColor(health, 0.3 + danger * 0.42);
      ctx.lineWidth = danger > 0.2 ? 2.2 : 1.2;
      ctx.beginPath();
      ctx.ellipse(0, 0, baseRadius * 1.08, baseRadius * 0.86, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();

      if (health < 0.66) {
        ctx.strokeStyle = health < 0.3 ? 'rgba(57, 29, 53, 0.9)' : 'rgba(91, 48, 63, 0.68)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-baseRadius * 0.62, -baseRadius * 0.16);
        ctx.lineTo(-baseRadius * 0.18, baseRadius * 0.02);
        ctx.lineTo(baseRadius * 0.04, baseRadius * 0.48);
        ctx.moveTo(-baseRadius * 0.18, baseRadius * 0.02);
        ctx.lineTo(baseRadius * 0.42, -baseRadius * 0.32);
        ctx.stroke();
      }
      if (health < 0.25) {
        ctx.fillStyle = 'rgba(33, 24, 46, 0.7)';
        for (let dot = 0; dot < 4; dot += 1) {
          const angle = (dot / 4) * TAU + seed;
          ctx.beginPath();
          ctx.arc(
            Math.cos(angle) * baseRadius * 0.5,
            Math.sin(angle) * baseRadius * 0.4,
            2,
            0,
            TAU
          );
          ctx.fill();
        }
      }
      ctx.restore();
    }
  }
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
  drawTissue(ctx, game);

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

function drawHostCell(ctx, hostCell, game) {
  const health = clamp(hostCell.health, 0, 1);
  const distress = 1 - health;
  const dyingDuration = game.reducedMotion ? 0.25 : 0.58;
  const dyingProgress = hostCell.dying > 0 ? 1 - hostCell.dying / dyingDuration : 0;
  const wobble =
    !game.reducedMotion && hostCell.attackerId
      ? Math.sin(hostCell.phase * 7) * (0.04 + distress * 0.08)
      : 0;
  const scale = game.cellScale * (1 - distress * 0.2) * (1 - dyingProgress * 0.75);

  ctx.save();
  ctx.translate(hostCell.x, hostCell.y);
  ctx.rotate(wobble);
  ctx.scale(scale, scale);
  ctx.globalAlpha = Math.max(0, 1 - dyingProgress);
  ctx.shadowColor = tissueHealthColor(health);
  ctx.shadowBlur = hostCell.rescued > 0 ? 18 : hostCell.attackerId ? 10 : 4;
  ctx.fillStyle = tissueHealthColor(health);
  ctx.strokeStyle = health < 0.3 ? '#4a3a52' : 'rgba(232, 255, 250, 0.8)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(0, 0, 24, 20 - distress * 3, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = health < 0.3 ? '#3c2f4a' : '#24777a';
  ctx.beginPath();
  ctx.ellipse(-3, 1, 9, 7, 0.3, 0, TAU);
  ctx.fill();
  if (health < 0.62) {
    ctx.fillStyle = '#fff0c2';
    ctx.beginPath();
    ctx.arc(17, -9, 4 + distress * 3, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  if (hostCell.attackerId && hostCell.dying <= 0) {
    const attacker = game.bacteria.find((bacterium) => bacterium.id === hostCell.attackerId);
    if (attacker) {
      ctx.save();
      ctx.strokeStyle = tissueHealthColor(health, 0.9);
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.moveTo(attacker.x, attacker.y);
      ctx.lineTo(hostCell.x, hostCell.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
    ctx.save();
    ctx.translate(hostCell.x, hostCell.y - 30 * game.cellScale - 8);
    ctx.fillStyle = '#fff4d2';
    ctx.strokeStyle = '#7a293e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#7a293e';
    ctx.font = '900 14px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', 0, 1);
    ctx.restore();
  }
}

function drawAntibodyClusters(ctx, game) {
  const clusters = new Map();
  for (const bacterium of game.bacteria) {
    if (bacterium.antibodyCoated <= 0 || bacterium.antibodyCluster == null) continue;
    const members = clusters.get(bacterium.antibodyCluster) ?? [];
    members.push(bacterium);
    clusters.set(bacterium.antibodyCluster, members);
  }

  ctx.save();
  ctx.lineCap = 'round';
  for (const members of clusters.values()) {
    if (members.length < 2) continue;
    const anchor = members[0];
    for (const partner of members.slice(1)) {
      const midpointX = (anchor.x + partner.x) / 2;
      const midpointY = (anchor.y + partner.y) / 2;
      ctx.strokeStyle = 'rgba(255, 241, 168, 0.68)';
      ctx.lineWidth = Math.max(2, 3.5 * game.bacteriaScale);
      ctx.setLineDash([5 * game.bacteriaScale, 4 * game.bacteriaScale]);
      ctx.beginPath();
      ctx.moveTo(anchor.x, anchor.y);
      ctx.lineTo(partner.x, partner.y);
      ctx.stroke();
      ctx.setLineDash([]);
      drawAntibody(ctx, midpointX, midpointY, 0.48 * game.bacteriaScale);
    }
  }
  ctx.restore();
}

function drawBacterium(ctx, bacterium, game) {
  const { bacteriaScale, reducedMotion } = game;
  ctx.save();
  ctx.translate(bacterium.x, bacterium.y);
  ctx.rotate(bacterium.angle + Math.sin(bacterium.wiggle) * 0.08);
  const split = bacterium.dividing > 0 ? 1 + Math.sin(bacterium.dividing * 10) * 0.25 : 1;
  ctx.scale(split * bacteriaScale, bacteriaScale / split);
  if (bacterium.clumped > 0) {
    ctx.shadowColor = '#fff2a6';
    ctx.shadowBlur = 18;
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
  if (bacterium.corroding && !bacterium.latchedTo) {
    ctx.fillStyle = '#ffcf5a';
    for (let index = 0; index < 2; index += 1) {
      ctx.beginPath();
      ctx.arc(8 + index * 8, 15 + Math.sin(bacterium.wiggle + index) * 3, 2.4, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();

  if (bacterium.antibodyCoated > 0) {
    const expiryAlpha = clamp(bacterium.antibodyCoated / 0.8, 0.3, 1);
    const pulse = game.reducedMotion
      ? 0
      : Math.sin(game.elapsed * 8 + bacterium.id) * 1.4 * bacteriaScale;
    ctx.save();
    ctx.translate(bacterium.x, bacterium.y);
    ctx.globalAlpha *= expiryAlpha;
    for (let index = 0; index < 3; index += 1) {
      const angle = (index / 3) * TAU + bacterium.id * 0.47;
      const radius = 27 * bacteriaScale + pulse;
      ctx.save();
      ctx.translate(Math.cos(angle) * radius, Math.sin(angle) * radius);
      ctx.rotate(angle + Math.PI / 2);
      drawAntibody(ctx, 0, 0, 0.48 * bacteriaScale);
      ctx.restore();
    }
    if (bacterium.antibodyPulse > 0) {
      const progress = 1 - bacterium.antibodyPulse / 0.32;
      ctx.strokeStyle = '#fff3ad';
      ctx.lineWidth = Math.max(2, 3 * bacteriaScale * (1 - progress * 0.45));
      ctx.globalAlpha *= 1 - progress;
      ctx.beginPath();
      ctx.arc(0, 0, (28 + progress * 22) * bacteriaScale, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (bacterium.marked > 0 && bacterium.antibodyCoated <= 0) {
    const helperMarked = bacterium.markedBy != null;
    const pulse = reducedMotion ? 0 : (Math.sin(game.elapsed * 6 + bacterium.id) + 1) * 0.5;
    const radius = (31 + pulse * 1.5) * bacteriaScale;
    const expiryAlpha = clamp(bacterium.marked / 1.2, 0.24, 1);
    ctx.save();
    ctx.translate(bacterium.x, bacterium.y);
    if (helperMarked && !reducedMotion) ctx.rotate(game.elapsed * 0.52);
    ctx.globalAlpha *= expiryAlpha;
    ctx.strokeStyle = '#b8ffca';
    ctx.fillStyle = '#f4fff1';
    ctx.lineWidth = Math.max(2, 2.6 * bacteriaScale);
    for (let index = 0; index < 4; index += 1) {
      const angle = (index / 4) * TAU + Math.PI * 0.25;
      const outer = radius + 8 * bacteriaScale;
      const inner = radius - 4 * bacteriaScale;
      const spread = 5 * bacteriaScale;
      const nx = -Math.sin(angle);
      const ny = Math.cos(angle);
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * outer + nx * spread, Math.sin(angle) * outer + ny * spread);
      ctx.lineTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
      ctx.lineTo(Math.cos(angle) * outer - nx * spread, Math.sin(angle) * outer - ny * spread);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, -radius - 8 * bacteriaScale, 4.5 * bacteriaScale, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  if (bacterium.bonusHit > 0) {
    const hitProgress = reducedMotion ? 0.35 : 1 - bacterium.bonusHit / 0.22;
    ctx.save();
    ctx.translate(bacterium.x, bacterium.y);
    ctx.globalAlpha = 1 - hitProgress;
    ctx.strokeStyle = '#fff3a8';
    ctx.lineWidth = Math.max(2, 3 * bacteriaScale * (1 - hitProgress * 0.35));
    for (let index = 0; index < 8; index += 1) {
      const angle = (index / 8) * TAU;
      const inner = (22 + hitProgress * 6) * bacteriaScale;
      const outer = (35 + hitProgress * 20) * bacteriaScale;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
      ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawCapturedBacterium(ctx, x, y, scale, rotation, alpha = 1, armored = false) {
  if (scale <= 0.01 || alpha <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(scale, scale);
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = '#ef507d';
  ctx.strokeStyle = '#721b4b';
  ctx.lineWidth = 3;
  roundedRect(ctx, -22, -12, 44, 24, 12);
  ctx.fill();
  ctx.stroke();
  if (armored) {
    ctx.strokeStyle = 'rgba(255, 226, 239, 0.78)';
    ctx.lineWidth = 2;
    roundedRect(ctx, -28, -17, 56, 34, 16);
    ctx.stroke();
  }
  ctx.fillStyle = '#ffb2ca';
  for (const [spotX, spotY] of [
    [-10, 4],
    [3, -4],
    [13, 4],
  ]) {
    ctx.beginPath();
    ctx.arc(spotX, spotY, 2.3, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawMacrophage(ctx, cell, color, reducedMotion) {
  const exhausted = cell.exhausted > 0;
  const pulse = cell.actionPulse > 0 ? 1.14 : 1;
  ctx.save();
  if (exhausted) {
    ctx.translate(-3, 5);
    ctx.rotate(-0.08 + (reducedMotion ? 0 : Math.sin(cell.exhausted * 7) * 0.035));
    ctx.scale(1.06, 0.76);
  }
  ctx.scale(pulse, pulse);
  ctx.fillStyle = exhausted ? '#7787a4' : color;
  ctx.strokeStyle = cell.rage > 0 ? '#ffffff' : exhausted ? '#34425f' : '#176c96';
  ctx.lineWidth = cell.rage > 0 ? 4 : 2.5;
  ctx.beginPath();
  for (let index = 0; index < 16; index += 1) {
    const angle = (index / 16) * TAU;
    const membraneWave = exhausted ? 1.5 : cell.rage > 0 ? 8 : 5;
    const membraneLobes = cell.rage > 0 ? 7 : 5;
    const radius =
      (exhausted ? 26 : 29) +
      Math.sin(angle * membraneLobes + cell.actionPulse * 15) * membraneWave;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = exhausted ? 'rgba(42, 49, 72, 0.78)' : 'rgba(22, 62, 118, 0.62)';
  ctx.beginPath();
  ctx.arc(-5, exhausted ? 7 : 2, 12, 0, TAU);
  ctx.fill();
  if (exhausted) {
    ctx.strokeStyle = '#d5e0ee';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(6, -5);
    ctx.lineTo(14, -4);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#eafcff';
    ctx.beginPath();
    ctx.arc(10, -9, 4, 0, TAU);
    ctx.fill();
  }

  const chargedPips = exhausted ? 0 : Math.max(0, 5 - Math.ceil(cell.exhaustion));
  for (let index = 0; index < 5; index += 1) {
    const angle = Math.PI * 0.15 + (index / 4) * Math.PI * 0.7;
    const x = Math.cos(angle) * 19;
    const y = Math.sin(angle) * 19;
    ctx.fillStyle =
      index < chargedPips ? (cell.rage > 0 ? '#fff3a8' : '#d8fbff') : 'rgba(33, 53, 79, 0.72)';
    ctx.beginPath();
    ctx.arc(x, y, 2.6, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawNeutrophil(ctx, cell, color, reducedMotion) {
  if (cell.fatigued > 0 && cell.netosisReplacement) {
    const fade = clamp(cell.fatigued / 1.25, 0, 1);
    ctx.save();
    ctx.globalAlpha = 0.24 + fade * 0.5;
    ctx.strokeStyle = '#fff1c7';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([5, 6]);
    ctx.beginPath();
    ctx.arc(0, 0, 18 + (1 - fade) * 20, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#9a6595';
    for (let index = 0; index < 3; index += 1) {
      const angle = (index / 3) * TAU + (reducedMotion ? 0 : (1 - fade) * 1.4);
      ctx.beginPath();
      ctx.arc(Math.cos(angle) * (12 + (1 - fade) * 16), Math.sin(angle) * 14, 5, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    return;
  }
  if (cell.fatigued > 0) {
    const reform = 1 - clamp(cell.fatigued / 1.25, 0, 1);
    const orbit = 8 + (1 - reform) * 15;
    ctx.save();
    ctx.globalAlpha = 0.48 + reform * 0.42;
    for (let index = 0; index < 3; index += 1) {
      const angle =
        (index / 3) * TAU + (reducedMotion ? 0.35 : reform * Math.PI * 1.6 + cell.specialPulse);
      ctx.fillStyle = index === 1 ? '#b68bb1' : color;
      ctx.strokeStyle = '#fff1c7';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(Math.cos(angle) * orbit, Math.sin(angle) * orbit, 7 + reform * 2, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255, 241, 199, 0.72)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.arc(0, 0, 25, 0, TAU * reform);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    return;
  }
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

function drawPlayableDendritic(ctx, cell, game) {
  const pulse = game.reducedMotion ? 0 : cell.actionPulse * 3;
  ctx.strokeStyle = '#d9fff7';
  ctx.lineWidth = 4.5;
  ctx.lineCap = 'round';
  for (let index = 0; index < 8; index += 1) {
    const angle = (index / 8) * TAU + (game.reducedMotion ? 0 : game.elapsed * 0.08);
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * 13, Math.sin(angle) * 13);
    ctx.quadraticCurveTo(
      Math.cos(angle + 0.16) * (25 + pulse),
      Math.sin(angle + 0.16) * (25 + pulse),
      Math.cos(angle) * (34 + pulse),
      Math.sin(angle) * (34 + pulse)
    );
    ctx.stroke();
  }
  ctx.fillStyle = ROLES.dendritic.color;
  ctx.strokeStyle = '#176d78';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 22, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#276c78';
  ctx.beginPath();
  ctx.ellipse(2, 1, 11, 9, -0.35, 0, TAU);
  ctx.fill();

  const carriedClues = ['sampling', 'delivery'].includes(game.adaptive?.stage)
    ? Math.min(4, cell.carriedSamples ?? 0)
    : 0;
  for (let index = 0; index < carriedClues; index += 1) {
    const angle = (index / Math.max(1, carriedClues)) * TAU + 0.4;
    ctx.fillStyle = '#ff9bb6';
    ctx.strokeStyle = '#fff3d6';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * 18, Math.sin(angle) * 18, 3.8, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
}

function drawDefender(ctx, cell, game) {
  const { cellScale, reducedMotion } = game;
  ctx.save();
  ctx.translate(cell.x, cell.y);
  ctx.rotate(cell.facing);
  ctx.scale(cellScale, cellScale);
  const roleColor = ROLES[cell.role].color;
  ctx.shadowColor = cell.rage > 0 ? '#ffffff' : roleColor;
  ctx.shadowBlur = cell.rage > 0 ? 18 : 8;
  if (cell.role === 'macrophage') drawMacrophage(ctx, cell, roleColor, reducedMotion);
  else if (cell.role === 'neutrophil') drawNeutrophil(ctx, cell, roleColor, reducedMotion);
  else if (cell.role === 'helper') drawHelper(ctx, roleColor);
  else drawPlayableDendritic(ctx, cell, game);
  ctx.restore();

  ctx.save();
  ctx.translate(cell.x, cell.y);
  if (cell.rallied > 0) {
    const fade = clamp(cell.rallied / 0.45, 0, 1);
    const orbit = reducedMotion ? 0 : game.elapsed * 0.8;
    const boostRadius = 39 * cellScale + 3;
    ctx.globalAlpha = fade;
    ctx.strokeStyle = '#b8ffca';
    ctx.lineWidth = Math.max(2, 2.7 * cellScale);
    ctx.lineCap = 'round';
    for (let index = 0; index < 4; index += 1) {
      const angle = orbit + (index / 4) * TAU;
      const x = Math.cos(angle) * boostRadius;
      const y = Math.sin(angle) * boostRadius;
      const tangentX = -Math.sin(angle);
      const tangentY = Math.cos(angle);
      const radialX = Math.cos(angle);
      const radialY = Math.sin(angle);
      const wing = 5 * cellScale;
      const depth = 7 * cellScale;
      ctx.beginPath();
      ctx.moveTo(x + tangentX * wing + radialX * depth, y + tangentY * wing + radialY * depth);
      ctx.lineTo(x, y);
      ctx.lineTo(x - tangentX * wing + radialX * depth, y - tangentY * wing + radialY * depth);
      ctx.stroke();
    }
  }
  if (cell.role === 'macrophage') {
    const energy = cell.exhausted > 0 ? 0 : clamp(1 - cell.exhaustion / 5, 0, 1);
    const energyRadius = 31 * cellScale;
    ctx.strokeStyle = 'rgba(25, 53, 83, 0.82)';
    ctx.lineWidth = Math.max(2, 3 * cellScale);
    ctx.beginPath();
    ctx.arc(0, 0, energyRadius, -Math.PI / 2, Math.PI * 1.5);
    ctx.stroke();
    if (energy > 0) {
      ctx.strokeStyle = cell.rage > 0 ? '#fff3a8' : tissueHealthColor(energy);
      ctx.lineWidth = Math.max(2.5, 4 * cellScale);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, energyRadius, -Math.PI / 2, -Math.PI / 2 + TAU * energy);
      ctx.stroke();
    }
    if (cell.exhausted > 0) {
      const sweatX = 27 * cellScale + 4;
      const sweatY =
        -19 * cellScale + (reducedMotion ? 0 : Math.sin(cell.exhausted * 6) * 2 * cellScale);
      ctx.save();
      ctx.translate(sweatX, sweatY);
      ctx.fillStyle = '#d5e9ff';
      ctx.strokeStyle = '#324660';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.bezierCurveTo(6, -1, 7, 3, 4, 6);
      ctx.bezierCurveTo(1, 9, -5, 7, -5, 2);
      ctx.bezierCurveTo(-5, -1, -2, -4, 0, -7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }
  if (cell.isPlayer) {
    ctx.strokeStyle = PLAYER_COLORS[cell.playerIndex];
    ctx.lineWidth = Math.max(2, 3 * cellScale);
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.arc(0, 0, 34 * cellScale + 4, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);

    const specialProgress = 1 - clamp(cell.specialCd / ROLES[cell.role].specialCooldown, 0, 1);
    const abilityRadius = 41 * cellScale + 4;
    ctx.strokeStyle = '#ffe48d';
    ctx.lineWidth = Math.max(2, 2.5 * cellScale);
    ctx.beginPath();
    ctx.arc(0, 0, abilityRadius, -Math.PI / 2, -Math.PI / 2 + TAU * specialProgress);
    ctx.stroke();
    if (specialProgress >= 0.999) {
      ctx.fillStyle = '#fff4ad';
      ctx.shadowColor = '#fff4ad';
      ctx.shadowBlur = reducedMotion ? 0 : 10;
      ctx.beginPath();
      ctx.arc(0, -abilityRadius, Math.max(2.5, 3.5 * cellScale), 0, TAU);
      ctx.fill();
    }
  }
  const labelSize = Math.round(clamp(10, 12 * cellScale + 2, 12));
  ctx.font = `700 ${labelSize}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = '#11182d';
  ctx.shadowBlur = 5;
  ctx.fillText(cell.label, 0, -(36 * cellScale + 9));
  ctx.restore();
}

function drawHelperTargeting(ctx, game) {
  if (game.mode !== 'playing') return;
  const helper = game.defenders.find(
    (cell) => cell.isPlayer && cell.role === 'helper' && cell.fatigued <= 0
  );
  if (!helper) return;

  const germ = nearestBacterium(game, helper, 250);
  const macrophage = helperBoostTarget(game, helper);
  ctx.save();
  ctx.strokeStyle = 'rgba(184, 255, 202, 0.58)';
  ctx.fillStyle = 'rgba(232, 255, 237, 0.78)';
  ctx.lineWidth = Math.max(1.5, 2 * game.cellScale);
  ctx.lineCap = 'round';

  const drawPreviewLine = (target, radius, ally = false) => {
    if (!target) return;
    const dx = target.x - helper.x;
    const dy = target.y - helper.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const ux = dx / length;
    const uy = dy / length;
    ctx.setLineDash([4, 9]);
    ctx.beginPath();
    ctx.moveTo(helper.x + ux * 30 * game.cellScale, helper.y + uy * 30 * game.cellScale);
    ctx.lineTo(target.x - ux * radius, target.y - uy * radius);
    ctx.stroke();
    ctx.setLineDash([]);

    if (ally) {
      const y = target.y + radius + 5;
      ctx.beginPath();
      ctx.moveTo(target.x - 9, y + 5);
      ctx.lineTo(target.x, y);
      ctx.lineTo(target.x + 9, y + 5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(target.x - 7, y + 12);
      ctx.lineTo(target.x, y + 7);
      ctx.lineTo(target.x + 7, y + 12);
      ctx.stroke();
    } else {
      const previewRadius = radius + 8 + (game.reducedMotion ? 0 : Math.sin(game.elapsed * 5) * 2);
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.arc(target.x, target.y, previewRadius, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  };

  drawPreviewLine(germ, 27 * game.bacteriaScale);
  drawPreviewLine(macrophage, 32 * game.cellScale, true);
  ctx.restore();
}

function drawDendriticTargeting(ctx, game) {
  if (game.mode !== 'playing') return;
  const dendriticPlayers = game.defenders.filter(
    (cell) => cell.isPlayer && cell.role === 'dendritic' && cell.fatigued <= 0
  );
  if (dendriticPlayers.length === 0) return;

  for (const cell of dendriticPlayers) {
    const response = game.adaptive;
    let target = null;
    if (response?.stage === 'sampling') {
      target = game.antigenFragments
        .filter((fragment) => !fragment.collected)
        .sort((a, b) => distance(cell, a) - distance(cell, b))[0];
    } else if (response && ['delivery', 'matching', 'cloning'].includes(response.stage)) {
      target = response.node;
    } else {
      target = nearestBacterium(game, cell, 250);
    }
    if (!target) continue;
    const dx = target.x - cell.x;
    const dy = target.y - cell.y;
    const targetDistance = Math.hypot(dx, dy) || 1;
    const ux = dx / targetDistance;
    const uy = dy / targetDistance;
    ctx.save();
    ctx.strokeStyle = 'rgba(217, 255, 247, 0.68)';
    ctx.lineWidth = Math.max(1.5, 2.2 * game.cellScale);
    ctx.setLineDash([5, 7]);
    ctx.beginPath();
    ctx.moveTo(cell.x + ux * 35 * game.cellScale, cell.y + uy * 35 * game.cellScale);
    ctx.lineTo(target.x - ux * 18, target.y - uy * 18);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(
      target.x,
      target.y,
      18 + (game.reducedMotion ? 0 : Math.sin(game.elapsed * 6) * 2),
      0,
      TAU
    );
    ctx.stroke();
    ctx.restore();
  }
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
  const { bacteriaScale, cellScale } = game;
  for (const projectile of game.projectiles) {
    ctx.fillStyle = projectile.color;
    ctx.shadowColor = projectile.color;
    ctx.shadowBlur = 10 * bacteriaScale;
    ctx.beginPath();
    ctx.arc(projectile.x, projectile.y, Math.max(3, 5 * bacteriaScale), 0, TAU);
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  for (const effect of game.effects) {
    const progress = 1 - effect.life / effect.maxLife;
    const alpha =
      effect.type === 'phagocytosis'
        ? clamp((1 - progress) / 0.08, 0, 1)
        : Math.min(1, effect.life * 2.6);
    ctx.save();
    ctx.globalAlpha = alpha;
    if (effect.type === 'phagocytosis') {
      const sourceX = effect.owner?.x ?? effect.fromX;
      const sourceY = effect.owner?.y ?? effect.fromY;

      if (game.reducedMotion) {
        drawCapturedBacterium(
          ctx,
          effect.x,
          effect.y,
          bacteriaScale * (1 - progress * 0.35),
          effect.bacteriumAngle,
          1 - progress,
          effect.armored
        );
        ctx.strokeStyle = effect.color;
        ctx.lineWidth = Math.max(2, (5 * (1 - progress) + 2) * cellScale);
        ctx.beginPath();
        ctx.arc(sourceX, sourceY, (18 + progress * 18) * cellScale, 0, TAU);
        ctx.stroke();
      } else {
        const smooth = (value) => value * value * (3 - 2 * value);
        const reach = smooth(clamp(progress / 0.3, 0, 1));
        const pull = smooth(clamp((progress - 0.28) / 0.4, 0, 1));
        const digest = smooth(clamp((progress - 0.68) / 0.32, 0, 1));
        const dx = effect.x - sourceX;
        const dy = effect.y - sourceY;
        const length = Math.max(1, Math.hypot(dx, dy));
        const ux = dx / length;
        const uy = dy / length;
        const nx = -uy;
        const ny = ux;
        const swallowedX = sourceX + ux * 5 * cellScale;
        const swallowedY = sourceY + uy * 5 * cellScale;
        const bacteriumX = effect.x + (swallowedX - effect.x) * pull;
        const bacteriumY = effect.y + (swallowedY - effect.y) * pull;

        ctx.save();
        ctx.globalAlpha *= 1 - digest;
        ctx.lineCap = 'round';
        for (const side of [-1, 0, 1]) {
          const startX = sourceX + ux * 10 * cellScale + nx * side * 12 * cellScale;
          const startY = sourceY + uy * 10 * cellScale + ny * side * 12 * cellScale;
          const spread = side * (18 - pull * 8) * bacteriaScale;
          const targetX = bacteriumX - ux * (8 + pull * 5) * bacteriaScale + nx * spread;
          const targetY = bacteriumY - uy * (8 + pull * 5) * bacteriaScale + ny * spread;
          const tipX = startX + (targetX - startX) * reach;
          const tipY = startY + (targetY - startY) * reach;
          const curve =
            (side * 14 + Math.sin(progress * Math.PI) * (side === 0 ? 18 : 7)) * cellScale;
          const controlX = (startX + tipX) / 2 + nx * curve;
          const controlY = (startY + tipY) / 2 + ny * curve;

          ctx.strokeStyle = 'rgba(18, 93, 139, 0.6)';
          ctx.lineWidth = Math.max(4, (13 - pull * 3) * cellScale);
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.quadraticCurveTo(controlX, controlY, tipX, tipY);
          ctx.stroke();
          ctx.strokeStyle = effect.color;
          ctx.lineWidth = Math.max(3, (8 - pull * 2) * cellScale);
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.quadraticCurveTo(controlX, controlY, tipX, tipY);
          ctx.stroke();
        }
        ctx.restore();

        const membraneClose = smooth(clamp((progress - 0.08) / 0.48, 0, 1));
        const vesicleRadius = (30 - pull * 9 - digest * 7) * bacteriaScale;
        ctx.strokeStyle = 'rgba(204, 247, 255, 0.92)';
        ctx.lineWidth = Math.max(2, (4 - digest * 1.5) * bacteriaScale);
        ctx.beginPath();
        ctx.arc(
          bacteriumX,
          bacteriumY,
          vesicleRadius,
          -Math.PI / 2,
          -Math.PI / 2 + TAU * membraneClose
        );
        ctx.stroke();
        ctx.strokeStyle = effect.color;
        ctx.lineWidth = Math.max(1.5, 2 * bacteriaScale);
        ctx.beginPath();
        ctx.arc(bacteriumX, bacteriumY, vesicleRadius - 4 * bacteriaScale, 0, TAU);
        ctx.stroke();

        const bacteriumScale = bacteriaScale * (1 - pull * 0.58) * (1 - digest * 0.94);
        drawCapturedBacterium(
          ctx,
          bacteriumX,
          bacteriumY,
          bacteriumScale,
          effect.bacteriumAngle + pull * Math.PI * 1.4,
          1 - digest * 0.75,
          effect.armored
        );

        if (digest > 0) {
          for (let index = 0; index < 6; index += 1) {
            const angle = (index / 6) * TAU + digest * Math.PI * 2;
            const radius = 15 * bacteriaScale * (1 - digest * 0.55);
            ctx.fillStyle = index % 2 === 0 ? '#fff1a8' : '#9dffcf';
            ctx.beginPath();
            ctx.arc(
              swallowedX + Math.cos(angle) * radius,
              swallowedY + Math.sin(angle) * radius,
              Math.max(1.5, (2.5 + digest * 1.5) * bacteriaScale),
              0,
              TAU
            );
            ctx.fill();
          }
          ctx.globalAlpha *= 1 - digest;
          ctx.strokeStyle = '#fff4ad';
          ctx.lineWidth = Math.max(1.5, (5 - digest * 3) * cellScale);
          ctx.beginPath();
          ctx.arc(swallowedX, swallowedY, (20 + digest * 28) * cellScale, 0, TAU);
          ctx.stroke();
        }
      }
    } else if (effect.type === 'antigen-clue') {
      const targetX = effect.owner?.x ?? effect.x;
      const targetY = effect.owner?.y ?? effect.y;
      const travel = game.reducedMotion ? 1 : 1 - (1 - progress) ** 3;
      const x = effect.fromX + (targetX - effect.fromX) * travel;
      const y = effect.fromY + (targetY - effect.fromY) * travel;
      ctx.strokeStyle = 'rgba(255, 211, 224, 0.72)';
      ctx.lineWidth = Math.max(1.5, 2.4 * bacteriaScale);
      if (!game.reducedMotion) {
        ctx.beginPath();
        ctx.moveTo(effect.fromX, effect.fromY);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
      ctx.translate(x, y);
      if (!game.reducedMotion) ctx.rotate(progress * Math.PI * 3);
      ctx.fillStyle = effect.color;
      ctx.strokeStyle = '#fff3d6';
      ctx.lineWidth = Math.max(1.5, 2 * bacteriaScale);
      ctx.beginPath();
      ctx.moveTo(0, -8 * bacteriaScale);
      ctx.lineTo(8 * bacteriaScale, 5 * bacteriaScale);
      ctx.lineTo(-8 * bacteriaScale, 5 * bacteriaScale);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (effect.type === 'cell-rescue') {
      ctx.strokeStyle = effect.color;
      ctx.lineWidth = Math.max(2, 4 * cellScale * (1 - progress * 0.5));
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, (17 + progress * 26) * cellScale, 0, TAU);
      ctx.stroke();
      const plusY = effect.y - (24 + (game.reducedMotion ? 0 : progress * 22)) * cellScale;
      ctx.strokeStyle = '#eafff8';
      ctx.lineWidth = Math.max(2, 3.5 * cellScale);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(effect.x - 5 * cellScale, plusY);
      ctx.lineTo(effect.x + 5 * cellScale, plusY);
      ctx.moveTo(effect.x, plusY - 5 * cellScale);
      ctx.lineTo(effect.x, plusY + 5 * cellScale);
      ctx.stroke();
    } else if (effect.type === 'arrival') {
      const entryProgress = 1 - (1 - clamp(progress * 1.7, 0, 1)) ** 3;
      const entryX = effect.fromX + (effect.x - effect.fromX) * entryProgress;
      const entryY = effect.fromY + (effect.y - effect.fromY) * entryProgress;
      if (!game.reducedMotion) {
        ctx.strokeStyle = effect.color;
        ctx.lineWidth = Math.max(2, 4 * bacteriaScale * (1 - progress));
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(effect.fromX, effect.fromY);
        ctx.lineTo(entryX, entryY);
        ctx.stroke();
      }
      ctx.strokeStyle = '#ffd1de';
      ctx.lineWidth = Math.max(1.5, 3 * bacteriaScale * (1 - progress * 0.6));
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, (22 - progress * 13) * bacteriaScale, 0, TAU);
      ctx.stroke();
    } else if (effect.type === 'metabolic-low') {
      const x = effect.owner?.x ?? effect.x;
      const y = effect.owner?.y ?? effect.y;
      ctx.strokeStyle = effect.color;
      ctx.lineWidth = Math.max(2, 3 * cellScale * (1 - progress * 0.45));
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.arc(x, y, (28 + progress * 17) * cellScale, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      if (!game.reducedMotion) {
        for (let index = 0; index < 4; index += 1) {
          const angle = (index / 4) * TAU + progress * Math.PI;
          ctx.fillStyle = index % 2 === 0 ? '#d5e0ee' : '#647591';
          ctx.beginPath();
          ctx.arc(
            x + Math.cos(angle) * 22 * cellScale,
            y + Math.sin(angle) * 16 * cellScale - progress * 18 * cellScale,
            Math.max(1.5, 2.6 * cellScale * (1 - progress * 0.35)),
            0,
            TAU
          );
          ctx.fill();
        }
      }
    } else if (effect.type === 'cell-recharge') {
      const x = effect.owner?.x ?? effect.x;
      const y = effect.owner?.y ?? effect.y;
      ctx.strokeStyle = effect.color;
      ctx.lineWidth = Math.max(2, 4 * cellScale * (1 - progress * 0.55));
      ctx.setLineDash([5, 6]);
      ctx.beginPath();
      ctx.moveTo(effect.fromX, effect.fromY);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(x, y, (20 + progress * 28) * cellScale, 0, TAU);
      ctx.stroke();
      const packetCount = game.reducedMotion ? 1 : 3;
      for (let index = 0; index < packetCount; index += 1) {
        const travel = game.reducedMotion ? 1 : clamp(progress * 1.7 - index * 0.16, 0, 1);
        ctx.fillStyle = index % 2 === 0 ? '#fff3a8' : effect.color;
        ctx.beginPath();
        ctx.arc(
          effect.fromX + (x - effect.fromX) * travel,
          effect.fromY + (y - effect.fromY) * travel,
          Math.max(2, 3.4 * cellScale),
          0,
          TAU
        );
        ctx.fill();
      }
    } else if (effect.type === 'pseudopod') {
      ctx.strokeStyle = effect.color;
      ctx.lineWidth = Math.max(3, 8 * cellScale);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(effect.fromX, effect.fromY);
      ctx.quadraticCurveTo(
        (effect.fromX + effect.x) / 2 + Math.sin(progress * Math.PI) * 24 * cellScale,
        (effect.fromY + effect.y) / 2 - 18 * cellScale,
        effect.x,
        effect.y
      );
      ctx.stroke();
    } else if (effect.type === 'signal') {
      const travel = game.reducedMotion ? 1 : Math.min(1, progress * 2.8);
      ctx.strokeStyle = effect.color;
      ctx.lineWidth = Math.max(2, 3 * cellScale);
      ctx.setLineDash([5, 6]);
      ctx.beginPath();
      ctx.moveTo(effect.fromX, effect.fromY);
      ctx.lineTo(effect.x, effect.y);
      ctx.stroke();
      ctx.setLineDash([]);
      for (let index = 0; index < (game.reducedMotion ? 1 : 3); index += 1) {
        const packet = game.reducedMotion ? 1 : clamp(travel - index * 0.18, 0, 1);
        ctx.fillStyle = index === 1 ? '#fff3a8' : '#e8ffed';
        ctx.beginPath();
        ctx.arc(
          effect.fromX + (effect.x - effect.fromX) * packet,
          effect.fromY + (effect.y - effect.fromY) * packet,
          Math.max(2, 3.6 * bacteriaScale),
          0,
          TAU
        );
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(
        effect.x,
        effect.y,
        (game.reducedMotion ? 34 : 15 + progress * 25) * bacteriaScale,
        0,
        TAU
      );
      ctx.stroke();
    } else if (effect.type === 'rally-link') {
      const x = effect.owner?.x ?? effect.x;
      const y = effect.owner?.y ?? effect.y;
      ctx.strokeStyle = effect.color;
      ctx.lineWidth = Math.max(2, 3.4 * cellScale * (1 - progress * 0.45));
      ctx.setLineDash([7, 5]);
      ctx.beginPath();
      ctx.moveTo(effect.fromX, effect.fromY);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.setLineDash([]);
      for (let index = 0; index < (game.reducedMotion ? 1 : 2); index += 1) {
        const travel = game.reducedMotion ? 1 : clamp(progress * 1.7 - index * 0.2, 0, 1);
        ctx.fillStyle = index === 0 ? '#f4fff1' : '#fff3a8';
        ctx.beginPath();
        ctx.arc(
          effect.fromX + (x - effect.fromX) * travel,
          effect.fromY + (y - effect.fromY) * travel,
          Math.max(2.5, 4 * cellScale),
          0,
          TAU
        );
        ctx.fill();
      }
      const lift = game.reducedMotion ? 0 : progress * 10 * cellScale;
      ctx.beginPath();
      ctx.moveTo(x - 8 * cellScale, y - 34 * cellScale - lift);
      ctx.lineTo(x, y - 42 * cellScale - lift);
      ctx.lineTo(x + 8 * cellScale, y - 34 * cellScale - lift);
      ctx.stroke();
    } else if (effect.type === 'rally') {
      ctx.strokeStyle = effect.color;
      ctx.lineWidth = 7 * (1 - progress) + 2;
      ctx.beginPath();
      ctx.arc(
        effect.x,
        effect.y,
        game.reducedMotion ? effect.radius : effect.radius * Math.min(1, progress * 1.7),
        0,
        TAU
      );
      ctx.stroke();
      ctx.globalAlpha *= 0.56;
      ctx.lineWidth = Math.max(2, 4 * (1 - progress));
      ctx.beginPath();
      ctx.arc(
        effect.x,
        effect.y,
        game.reducedMotion ? effect.radius * 0.72 : effect.radius * Math.min(0.78, progress * 1.35),
        0,
        TAU
      );
      ctx.stroke();
    } else if (effect.type === 'response-boost') {
      const targetX = clamp(game.width * 0.3, 116, Math.min(430, game.width - 70));
      const targetY = 91;
      const travel = game.reducedMotion ? 1 : 1 - (1 - clamp(progress * 1.55, 0, 1)) ** 3;
      const x = effect.x + (targetX - effect.x) * travel;
      const y = effect.y + (targetY - effect.y) * travel;
      ctx.strokeStyle = '#d9ffd8';
      ctx.lineWidth = Math.max(2, 3 * cellScale * (1 - progress * 0.4));
      if (!game.reducedMotion) {
        ctx.beginPath();
        ctx.moveTo(effect.x, effect.y);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
      ctx.fillStyle = effect.color;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(4, 6 * cellScale), 0, TAU);
      ctx.fill();
      if (travel > 0.72) {
        ctx.font = `900 ${Math.round(clamp(12, 15 * cellScale, 16))}px Inter, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#f4fff1';
        ctx.fillText('BOOST!', targetX, targetY - 15);
      }
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
    } else if (effect.type === 'complement-lysis') {
      const rupture = game.reducedMotion ? 0.65 : progress;
      ctx.translate(effect.x, effect.y);
      ctx.strokeStyle = '#bdf5ff';
      ctx.lineWidth = Math.max(2, 4 * bacteriaScale * (1 - rupture * 0.5));
      for (const radius of [12, 22]) {
        ctx.beginPath();
        ctx.arc(0, 0, (radius + rupture * 26) * bacteriaScale, 0, TAU);
        ctx.stroke();
      }
      ctx.strokeStyle = '#fff4b5';
      ctx.lineWidth = Math.max(1.5, 3 * bacteriaScale);
      for (let index = 0; index < 8; index += 1) {
        const angle = (index / 8) * TAU;
        const inner = (8 + rupture * 10) * bacteriaScale;
        const outer = (22 + rupture * 34) * bacteriaScale;
        ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
        ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
        ctx.stroke();
      }
    } else if (effect.type === 'antibody') {
      const targetX = effect.owner?.x ?? effect.x;
      const targetY = effect.owner?.y ?? effect.y;
      const travel = game.reducedMotion ? 1 : 1 - (1 - progress) ** 3;
      const x = effect.fromX + (targetX - effect.fromX) * travel;
      const y = effect.fromY + (targetY - effect.fromY) * travel;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.atan2(targetY - effect.fromY, targetX - effect.fromX) + Math.PI / 2);
      drawAntibody(ctx, 0, 0, 1.1 * bacteriaScale);
      ctx.restore();
    } else if (effect.type === 'complement') {
      const x = effect.fromX + (effect.x - effect.fromX) * progress;
      const y = effect.fromY + (effect.y - effect.fromY) * progress;
      ctx.fillStyle = effect.color;
      ctx.shadowColor = effect.color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(3, 6 * bacteriaScale), 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#eaffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, (8 + progress * 15) * bacteriaScale, 0, TAU);
      ctx.stroke();
    } else if (effect.type === 'flood' && !game.reducedMotion) {
      ctx.fillStyle = `rgba(255, 241, 168, ${0.24 * (1 - progress)})`;
      ctx.fillRect(0, 0, game.width, game.height);
    } else {
      ctx.strokeStyle = effect.color;
      ctx.lineWidth = Math.max(1, 4 * (1 - progress) * bacteriaScale);
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, (8 + progress * 32) * bacteriaScale, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  for (const particle of game.particles) {
    ctx.save();
    ctx.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, Math.max(1.5, particle.radius * bacteriaScale), 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

function drawEducationActors(ctx, game) {
  const education = game.education;
  if (!education || education.stage < 3) return;
  const nodeX = game.width - 104;
  const nodeY = 124;

  ctx.save();
  ctx.globalAlpha = education.stage === 3 ? 1 : 0.72;
  ctx.fillStyle = 'rgba(92, 63, 130, 0.72)';
  ctx.strokeStyle = '#e7c8ff';
  ctx.lineWidth = 2;
  for (const [offsetX, offsetY, radius] of [
    [-15, 5, 22],
    [12, -7, 24],
    [14, 18, 18],
  ]) {
    ctx.beginPath();
    ctx.arc(nodeX + offsetX, nodeY + offsetY, radius, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = '#fff4ff';
  ctx.font = '800 11px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('LYMPH NODE', nodeX, nodeY + 48);
  ctx.restore();

  for (const target of education.helperTargets) {
    ctx.save();
    ctx.translate(target.x, target.y);
    const highlighted = target.matches && !education.helperMatched;
    ctx.shadowColor = highlighted ? '#fff1a8' : 'transparent';
    ctx.shadowBlur = highlighted ? 18 + target.pulse * 12 : 0;
    ctx.fillStyle = target.matches && education.helperMatched ? '#8df29a' : '#6c75b8';
    ctx.strokeStyle = highlighted ? '#fff1a8' : 'rgba(239, 226, 255, 0.72)';
    ctx.lineWidth = highlighted ? 4 : 2;
    ctx.beginPath();
    ctx.arc(0, 0, 22 * game.cellScale, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#f4e9ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (target.shape === 0) {
      ctx.arc(0, 0, 7, 0, Math.PI);
    } else if (target.shape === 1) {
      ctx.moveTo(-8, 6);
      ctx.lineTo(0, -7);
      ctx.lineTo(8, 6);
    } else {
      ctx.moveTo(-8, -5);
      ctx.quadraticCurveTo(0, 10, 8, -5);
    }
    ctx.stroke();
    ctx.restore();
  }

  const courier = education.courier;
  if (courier) {
    ctx.save();
    ctx.strokeStyle = 'rgba(231, 200, 255, 0.48)';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(courier.startX, courier.startY);
    ctx.quadraticCurveTo(courier.controlX, courier.controlY, courier.targetX, courier.targetY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.translate(courier.x, courier.y);
    const pulse = game.reducedMotion ? 1 : 1 + Math.sin(courier.phase) * 0.05;
    ctx.scale(game.cellScale * pulse, game.cellScale * pulse);
    ctx.strokeStyle = '#d9fff7';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    for (let index = 0; index < 8; index += 1) {
      const angle = (index / 8) * TAU;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * 13, Math.sin(angle) * 13);
      ctx.lineTo(Math.cos(angle) * 34, Math.sin(angle) * 34);
      ctx.stroke();
    }
    ctx.fillStyle = '#62e2c7';
    ctx.strokeStyle = '#176d78';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ef507d';
    for (let index = 0; index < 4; index += 1) {
      const angle = (index / 4) * TAU + 0.4;
      ctx.beginPath();
      ctx.arc(Math.cos(angle) * 17, Math.sin(angle) * 17, 4, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  const plasmaCell = education.plasmaCell;
  if (plasmaCell) {
    ctx.save();
    ctx.translate(plasmaCell.x, plasmaCell.y);
    const pulse = game.reducedMotion ? 1 : 1 + Math.sin(plasmaCell.phase) * 0.045;
    ctx.scale(game.cellScale * pulse, game.cellScale * pulse);
    ctx.fillStyle = '#c58cff';
    ctx.strokeStyle = '#fff1a8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 27, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#5b397d';
    ctx.beginPath();
    ctx.ellipse(-4, 2, 13, 10, -0.4, 0, TAU);
    ctx.fill();
    for (let index = 0; index < 3; index += 1) {
      const angle = (index / 3) * TAU + plasmaCell.phase * 0.2;
      drawAntibody(ctx, Math.cos(angle) * 42, Math.sin(angle) * 42, 0.55);
    }
    ctx.restore();
    ctx.save();
    ctx.fillStyle = '#fff4ff';
    ctx.font = '800 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PLASMA CELL', plasmaCell.x, plasmaCell.y + 52);
    ctx.restore();
  }

  for (const memoryCell of education.memoryCells) {
    ctx.save();
    ctx.translate(memoryCell.x, memoryCell.y);
    const pulse = game.reducedMotion ? 1 : 1 + Math.sin(memoryCell.phase) * 0.06;
    ctx.scale(game.cellScale * pulse, game.cellScale * pulse);
    ctx.fillStyle = memoryCell.color;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#3d416d';
    ctx.beginPath();
    ctx.arc(-3, 1, 8, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#fff1a8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 27, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
}

function drawLymphNode(ctx, x, y, active = false) {
  ctx.save();
  ctx.globalAlpha = active ? 1 : 0.58;
  ctx.fillStyle = 'rgba(92, 63, 130, 0.78)';
  ctx.strokeStyle = active ? '#fff1a8' : '#d6b7ef';
  ctx.lineWidth = active ? 3 : 2;
  for (const [offsetX, offsetY, radius] of [
    [-15, 5, 22],
    [12, -7, 24],
    [14, 18, 18],
  ]) {
    ctx.beginPath();
    ctx.arc(x + offsetX, y + offsetY, radius, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = '#fff4ff';
  ctx.font = '800 10px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('LYMPH NODE', x, y + 48);
  ctx.restore();
}

function drawAntigenFragments(ctx, game) {
  for (const fragment of game.antigenFragments) {
    const expiryAlpha = clamp(fragment.life / 1.5, 0, 1);
    ctx.save();
    ctx.translate(fragment.x, fragment.y);
    if (!game.reducedMotion) ctx.rotate(fragment.phase * 0.14);
    ctx.globalAlpha = expiryAlpha;
    ctx.fillStyle = fragment.color;
    ctx.strokeStyle = '#fff3d6';
    ctx.lineWidth = Math.max(1.2, 1.8 * game.bacteriaScale);
    for (let index = 0; index < 3; index += 1) {
      const angle = (index / 3) * TAU + 0.3;
      const radius = (5 + index * 3) * game.bacteriaScale;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      ctx.beginPath();
      ctx.moveTo(x, y - 4 * game.bacteriaScale);
      ctx.lineTo(x + 4 * game.bacteriaScale, y + 3 * game.bacteriaScale);
      ctx.lineTo(x - 4 * game.bacteriaScale, y + 3 * game.bacteriaScale);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawDendriticCell(ctx, response, game) {
  const courier = response.courier;
  ctx.save();
  ctx.translate(courier.x, courier.y);
  if (!game.reducedMotion) ctx.rotate(courier.facing * 0.08);
  const pulse = game.reducedMotion ? 1 : 1 + Math.sin(response.phase * 1.6) * 0.05;
  ctx.scale(game.cellScale * pulse, game.cellScale * pulse);
  ctx.strokeStyle = '#d9fff7';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  for (let index = 0; index < 8; index += 1) {
    const angle = (index / 8) * TAU + (game.reducedMotion ? 0 : response.phase * 0.08);
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * 13, Math.sin(angle) * 13);
    ctx.lineTo(Math.cos(angle) * 34, Math.sin(angle) * 34);
    ctx.stroke();
  }
  ctx.fillStyle = '#62e2c7';
  ctx.strokeStyle = '#176d78';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 22, 0, TAU);
  ctx.fill();
  ctx.stroke();
  const clueCount = Math.min(5, response.samples);
  ctx.fillStyle = '#ff9bb6';
  ctx.strokeStyle = '#fff3d6';
  ctx.lineWidth = 1.5;
  for (let index = 0; index < clueCount; index += 1) {
    const angle = (index / Math.max(1, clueCount)) * TAU + 0.4;
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * 18, Math.sin(angle) * 18, 4, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
  const mergingIntoNode =
    response.stage === 'delivery' &&
    Math.hypot(courier.x - response.node.x, courier.y - response.node.y) < 88;
  if (!mergingIntoNode) {
    ctx.save();
    ctx.fillStyle = '#eafff8';
    ctx.font = '800 10px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DENDRITIC CELL', courier.x, courier.y + 42 * game.cellScale + 12);
    ctx.restore();
  }
}

function drawAdaptiveActors(ctx, game) {
  const response = game.adaptive;
  if (!response || game.experience !== 'defense') return;
  const playableCourier = playerDendritic(game);
  const nodeActive = ['matching', 'cloning', 'antibodies'].includes(response.stage);
  drawLymphNode(ctx, response.node.x, response.node.y, nodeActive);

  if (!playableCourier && ['sampling', 'delivery'].includes(response.stage)) {
    if (response.stage === 'delivery') {
      ctx.save();
      ctx.strokeStyle = 'rgba(217, 255, 247, 0.46)';
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(response.courier.startX, response.courier.startY);
      ctx.quadraticCurveTo(
        response.courier.controlX,
        response.courier.controlY,
        response.courier.targetX,
        response.courier.targetY
      );
      ctx.stroke();
      ctx.setLineDash([]);
      const danger = nearestBacterium(game, response.courier, 118);
      if (danger) {
        ctx.strokeStyle = '#ffb197';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.arc(response.courier.x, response.courier.y, 58 * game.cellScale, 0, TAU);
        ctx.stroke();
      }
      ctx.restore();
    }
    drawDendriticCell(ctx, response, game);
  }

  if (['matching', 'cloning'].includes(response.stage)) {
    const helperX = response.node.x - 52;
    const helperY = response.node.y + 66;
    const bCellX = response.node.x + 36;
    const bCellY = response.node.y + 68;
    ctx.save();
    ctx.strokeStyle = '#fff3a8';
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(helperX + 18, helperY);
    ctx.lineTo(bCellX - 18, bCellY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.translate(helperX, helperY);
    ctx.scale(game.cellScale, game.cellScale);
    drawHelper(ctx, ROLES.helper.color);
    ctx.restore();

    const copies = response.stage === 'cloning' ? response.bCellCopies : 1;
    for (let index = 0; index < copies; index += 1) {
      const spread = copies === 1 ? 0 : 18 + Math.ceil(copies / 3) * 4;
      const angle = (index / copies) * TAU + (game.reducedMotion ? 0 : response.phase * 0.08);
      const x = bCellX + Math.cos(angle) * spread;
      const y = bCellY + Math.sin(angle) * spread;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(game.cellScale * 0.78, game.cellScale * 0.78);
      ctx.fillStyle = '#c58cff';
      ctx.strokeStyle = '#fff1df';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 21, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#5b397d';
      ctx.beginPath();
      ctx.arc(-3, 1, 9, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.save();
    ctx.fillStyle = '#f4fff1';
    ctx.font = '800 10px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('HELPER T', helperX, helperY + 42);
    ctx.fillText(
      response.stage === 'matching' ? 'MATCHING B CELL' : 'B CELLS CLONING',
      bCellX,
      bCellY + 48
    );
    ctx.restore();
  }

  for (const [plasmaIndex, plasmaCell] of response.plasmaCells.entries()) {
    const distanceFromNode = Math.hypot(
      plasmaCell.x - response.node.x,
      plasmaCell.y - response.node.y
    );
    if (distanceFromNode < 260) {
      ctx.save();
      ctx.globalAlpha = clamp(1 - distanceFromNode / 260, 0.12, 0.5);
      ctx.strokeStyle = '#e7c8ff';
      ctx.lineWidth = Math.max(1.5, 2.5 * game.cellScale);
      ctx.setLineDash([6, 7]);
      ctx.beginPath();
      ctx.moveTo(response.node.x, response.node.y + 24);
      ctx.quadraticCurveTo(
        response.node.x - 24,
        (response.node.y + plasmaCell.y) / 2,
        plasmaCell.x,
        plasmaCell.y
      );
      ctx.stroke();
      ctx.restore();
    }
    ctx.save();
    ctx.translate(plasmaCell.x, plasmaCell.y);
    const pulse = game.reducedMotion ? 1 : 1 + Math.sin(plasmaCell.phase) * 0.045;
    ctx.scale(game.cellScale * pulse, game.cellScale * pulse);
    ctx.fillStyle = '#c58cff';
    ctx.strokeStyle = '#fff1a8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 27, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#5b397d';
    ctx.beginPath();
    ctx.ellipse(-4, 2, 13, 10, -0.4, 0, TAU);
    ctx.fill();
    for (let index = 0; index < 3; index += 1) {
      const angle = (index / 3) * TAU + plasmaCell.phase * 0.2;
      drawAntibody(ctx, Math.cos(angle) * 42, Math.sin(angle) * 42, 0.55);
    }
    ctx.restore();
    if (plasmaIndex === 0) {
      ctx.save();
      ctx.fillStyle = '#fff4ff';
      ctx.font = '800 10px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PLASMA FACTORY', plasmaCell.x, plasmaCell.y + 48 * game.cellScale);
      ctx.restore();
    }
  }
}

function drawGame(ctx, game) {
  drawBackground(ctx, game);
  drawAntigenFragments(ctx, game);
  drawHelperTargeting(ctx, game);
  drawDendriticTargeting(ctx, game);
  for (const hostCell of game.hostCells) drawHostCell(ctx, hostCell, game);
  drawAntibodyClusters(ctx, game);
  for (const bacterium of game.bacteria) drawBacterium(ctx, bacterium, game);
  drawAdaptiveActors(ctx, game);
  drawEducationActors(ctx, game);
  for (const cell of game.defenders) drawDefender(ctx, cell, game);
  drawEffects(ctx, game);
}

function educationProgressLabel(game) {
  const education = game.education;
  if (!education) return '';
  const player = game.defenders.find((cell) => cell.isPlayer);
  if (education.stage === 0) return `${Math.round(education.progress * 100)}% to the alarm`;
  if (education.stage === 1) {
    return `${Math.min(4, Math.max(0, (player?.kills ?? 0) - education.stageStartKills))}/4 engulfed`;
  }
  if (education.stage === 2) {
    return `${Math.min(3, education.primaryActions)}/3 toxin · ${Math.min(1, education.specialActions)}/1 net`;
  }
  if (education.stage === 3) return `${Math.round(education.progress * 100)}% to the lymph node`;
  if (education.stage === 4) {
    return `${education.helperMatched ? 'Antigen matched' : 'Find the glowing match'} · ${Math.min(1, education.specialActions)}/1 rally`;
  }
  if (education.stage === 5) return `${game.bacteria.length} bacteria remain`;
  return `${Math.round(education.progress * 100)}% faster response`;
}

function snapshotFromGame(game) {
  const players = game.defenders
    .filter((cell) => cell.isPlayer)
    .map((cell) => ({
      role: cell.role,
      playerIndex: cell.playerIndex,
      specialCd: Math.ceil(cell.specialCd),
      specialProgress: 1 - clamp(cell.specialCd / ROLES[cell.role].specialCooldown, 0, 1),
      fatigued: cell.fatigued > 0,
      exhausted: Math.ceil(cell.exhausted),
      energy:
        cell.role === 'macrophage'
          ? cell.exhausted > 0
            ? 0
            : clamp(1 - cell.exhaustion / 5, 0, 1)
          : 1,
      kills: cell.kills,
    }));
  const responseStatus = adaptiveStatus(game);
  return {
    mode: game.mode,
    experience: game.experience,
    phase: game.phase,
    timeLeft: Math.ceil(game.timeLeft),
    nextDivision: Math.max(0, Math.ceil(game.nextDivision)),
    integrity: Math.ceil(game.integrity),
    bacteria: game.bacteria.length,
    destroyed: game.totalDestroyed,
    players,
    earlyClear: game.earlyClear,
    antibodyHits: game.antibodyHits,
    germsCoated: game.germsCoated,
    hostCellsSaved: game.hostCellsSaved,
    hostCellsLost: game.hostCellsLost,
    criticalTissue: game.criticalTissue,
    responsePulse: game.responsePulse > 0,
    responseTitle: responseStatus.title,
    responseDetail: responseStatus.detail,
    responseProgress: adaptiveOverallProgress(game),
    responseStageIndex:
      game.phase === 'adaptive'
        ? ADAPTIVE_RESPONSE_STAGES.length
        : (game.adaptive?.stageIndex ?? 0),
    responseStageProgress: game.phase === 'adaptive' ? 1 : (game.adaptive?.progress ?? 0),
    lessonStage: game.education?.stage ?? 0,
    lessonBeat: game.education?.beat ?? 0,
    lessonProgress: game.education?.progress ?? 0,
    lessonPrimaryActions: game.education?.primaryActions ?? 0,
    lessonSpecialActions: game.education?.specialActions ?? 0,
    lessonProgressLabel: educationProgressLabel(game),
  };
}

const INITIAL_SNAPSHOT = {
  mode: 'setup',
  experience: 'defense',
  phase: 'innate',
  timeLeft: ROUND_TIME,
  nextDivision: 0,
  integrity: 100,
  bacteria: 0,
  destroyed: 0,
  players: [],
  earlyClear: false,
  antibodyHits: 0,
  germsCoated: 0,
  hostCellsSaved: 0,
  hostCellsLost: 0,
  criticalTissue: 0,
  responsePulse: false,
  responseTitle: 'Dendritic scout is sampling',
  responseDetail: '0/0 clues collected',
  responseProgress: 0,
  responseStageIndex: 0,
  responseStageProgress: 0,
  lessonStage: 0,
  lessonBeat: 0,
  lessonProgress: 0,
  lessonPrimaryActions: 0,
  lessonSpecialActions: 0,
  lessonProgressLabel: '',
};

export function ImmunePage() {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const soundRef = useRef(null);
  const previewRef = useRef(null);
  const snapshotModeRef = useRef('setup');
  const frameRef = useRef(0);
  const keysRef = useRef(new Set());
  const pressedRef = useRef([new Set(), new Set()]);
  const keyboardEdgesRef = useRef([{}, {}]);
  const touchInputRef = useRef({ x: 0, y: 0 });
  const touchPointerRef = useRef(null);
  const touchStickRef = useRef(null);
  const guideButtonRef = useRef(null);
  const configRef = useRef({
    experience: 'defense',
    playerCount: 1,
    roles: ['macrophage', 'neutrophil'],
  });
  const [config, setConfig] = useState(configRef.current);
  const [snapshot, setSnapshot] = useState(INITIAL_SNAPSHOT);
  const [soundMuted, setSoundMuted] = useState(readSoundPreference);
  const soundMutedRef = useRef(soundMuted);
  const stageLesson = LEARNING_STAGES[snapshot.lessonStage] ?? LEARNING_STAGES[0];
  const currentLesson =
    snapshot.lessonBeat === 1 && stageLesson.next
      ? { ...stageLesson, ...stageLesson.next }
      : stageLesson;

  const ensureSound = useCallback(() => {
    if (!soundRef.current) soundRef.current = createImmuneSoundEngine();
    soundRef.current.setMuted(soundMutedRef.current);
    return soundRef.current;
  }, []);

  const continueTour = useCallback(() => {
    const game = gameRef.current;
    if (!game || !continueEducationTour(game)) return;
    soundRef.current?.stopNarration();
    snapshotModeRef.current = game.mode;
    setSnapshot(snapshotFromGame(game));
  }, []);

  const replayNarration = useCallback(() => {
    const game = gameRef.current;
    const stage = LEARNING_STAGES[game?.education?.stage ?? 0];
    const lesson = game?.education?.beat === 1 && stage.next ? { ...stage, ...stage.next } : stage;
    const sound = ensureSound();
    sound.unlock();
    sound.speak(lesson.narration);
  }, [ensureSound]);

  useEffect(() => {
    if (snapshot.mode !== 'tour') return undefined;
    guideButtonRef.current?.focus();
    const sound = ensureSound();
    sound.speak(currentLesson.narration);
    return () => sound.stopNarration();
  }, [currentLesson.narration, ensureSound, snapshot.mode]);

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
    const sound = ensureSound();
    sound.unlock();
    gameRef.current = makeGame(width, height, {
      ...configRef.current,
      reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
      sound,
    });
    if (gameRef.current.mode === 'tour') {
      sound.speak(LEARNING_STAGES[0].narration);
    }
    snapshotModeRef.current = gameRef.current.mode;
    setSnapshot(snapshotFromGame(gameRef.current));
  }, [ensureSound]);

  const toggleSound = useCallback(() => {
    const nextMuted = !soundMutedRef.current;
    soundMutedRef.current = nextMuted;
    setSoundMuted(nextMuted);
    try {
      window.localStorage.setItem(SOUND_PREFERENCE_KEY, String(nextMuted));
    } catch {
      // Sound still works when storage is unavailable.
    }
    const sound = ensureSound();
    sound.setMuted(nextMuted);
    if (!nextMuted) {
      sound.unlock();
      sound.play('toggle');
      if (gameRef.current?.mode === 'tour') {
        const game = gameRef.current;
        const stage = LEARNING_STAGES[game.education?.stage ?? 0];
        const lesson =
          game.education?.beat === 1 && stage.next ? { ...stage, ...stage.next } : stage;
        sound.speak(lesson.narration);
      }
    }
  }, [ensureSound]);

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
        const previousTissue = game.tissue;
        const scaleX = width / previousWidth;
        const scaleY = height / previousHeight;
        const arenaScale = getArenaScale(width, height);
        game.width = width;
        game.height = height;
        game.bacteriaScale = arenaScale.bacteriaScale;
        game.cellScale = arenaScale.cellScale;
        game.population = getArenaPopulationProfile(width, height);
        game.breach.x = width * 0.5;
        game.breach.y = height * 0.47;
        game.tissue = makeTissue(width, height, previousTissue);
        for (const entity of [...game.bacteria, ...game.defenders]) {
          entity.x = clamp(entity.x * scaleX, 24, width - 24);
          entity.y = clamp(entity.y * scaleY, 78, height - 24);
        }
        for (const hostCell of game.hostCells) {
          hostCell.x *= scaleX;
          hostCell.baseY = clamp(hostCell.baseY * scaleY, 100, height - 44);
          hostCell.y = clamp(hostCell.y * scaleY, 78, height - 24);
        }
        for (const fragment of game.antigenFragments) {
          fragment.x = clamp(fragment.x * scaleX, 28, width - 28);
          fragment.y = clamp(fragment.y * scaleY, 86, height - 28);
        }
        if (game.adaptive) {
          const response = game.adaptive;
          response.node.x = width - 104;
          response.node.y = 124;
          response.courier.startX = game.breach.x + 72;
          response.courier.startY = game.breach.y - 44;
          response.courier.targetX = response.node.x;
          response.courier.targetY = response.node.y;
          response.courier.controlX = width * 0.72;
          response.courier.controlY = height * 0.25;
          if (response.stage === 'sampling') {
            response.courier.x = clamp(response.courier.x * scaleX, 40, width - 40);
            response.courier.y = clamp(response.courier.y * scaleY, 96, height - 40);
            response.courier.wanderX = clamp(response.courier.wanderX * scaleX, 40, width - 40);
            response.courier.wanderY = clamp(response.courier.wanderY * scaleY, 96, height - 40);
          } else if (response.stage === 'delivery') {
            const pathPoint = lymphaticPathPoint(response.courier, response.progress);
            response.courier.x = pathPoint.x;
            response.courier.y = pathPoint.y;
          } else {
            response.courier.x = response.node.x;
            response.courier.y = response.node.y;
          }
          response.plasmaCells.forEach((plasmaCell) => {
            plasmaCell.x = clamp(plasmaCell.x * scaleX, 56, width - 56);
            plasmaCell.y = clamp(plasmaCell.y * scaleY, 108, height - 56);
            plasmaCell.targetX = clamp(plasmaCell.targetX * scaleX, 56, width - 56);
            plasmaCell.targetY = clamp(plasmaCell.targetY * scaleY, 108, height - 56);
          });
        }
        if (game.education?.courier) {
          const courier = game.education.courier;
          courier.startX = game.breach.x;
          courier.startY = game.breach.y;
          courier.targetX = width - 104;
          courier.targetY = 124;
          courier.controlX = width * 0.7;
          courier.controlY = Math.max(96, game.breach.y - height * 0.18);
          const pathPoint = lymphaticPathPoint(courier, courier.progress);
          courier.x = pathPoint.x;
          courier.y = pathPoint.y;
        }
        if (game.education?.plasmaCell) {
          const plasmaCell = game.education.plasmaCell;
          plasmaCell.x = clamp(plasmaCell.x * scaleX, 56, width - 56);
          plasmaCell.y = clamp(plasmaCell.y * scaleY, 108, height - 56);
          plasmaCell.targetX = clamp(plasmaCell.targetX * scaleX, 56, width - 56);
          plasmaCell.targetY = clamp(plasmaCell.targetY * scaleY, 108, height - 56);
        }
        for (const target of game.education?.helperTargets ?? []) {
          target.x = clamp(target.x * scaleX, 30, width - 30);
          target.y = clamp(target.y * scaleY, 90, height - 30);
        }
        for (const memoryCell of game.education?.memoryCells ?? []) {
          memoryCell.x = clamp(memoryCell.x * scaleX, 30, width - 30);
          memoryCell.y = clamp(memoryCell.y * scaleY, 90, height - 30);
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

        if (
          game.mode === 'tour' &&
          edges.some((edge) => edge.primary || edge.special || edge.pause)
        ) {
          continueEducationTour(game);
        } else if (edges.some((edge) => edge.pause) && ['playing', 'paused'].includes(game.mode)) {
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
          const up = fresh(12);
          const down = fresh(13);
          const left = fresh(14) || fresh(4);
          const right = fresh(15) || fresh(5);
          if (index === 0 && (up || down)) {
            updateConfig((current) => ({
              ...current,
              experience: current.experience === 'education' ? 'defense' : 'education',
              playerCount: current.experience === 'defense' ? 1 : current.playerCount,
            }));
          } else if ((left || right) && configRef.current.experience === 'defense') {
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
            if (
              configRef.current.experience === 'defense' &&
              index === 1 &&
              configRef.current.playerCount === 1
            ) {
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
        if (event.code === 'KeyM') {
          updateConfig((current) => ({
            ...current,
            experience: current.experience === 'education' ? 'defense' : 'education',
            playerCount: current.experience === 'defense' ? 1 : current.playerCount,
          }));
        } else if (
          configRef.current.experience === 'defense' &&
          (event.code === 'Digit1' || event.code === 'Digit2')
        ) {
          updateConfig((current) => ({
            ...current,
            playerCount: Number(event.code.slice(-1)),
          }));
        } else if (
          configRef.current.experience === 'defense' &&
          (event.code === 'KeyQ' || event.code === 'KeyE')
        ) {
          updateConfig((current) => ({
            ...current,
            roles: [cycleRole(current.roles[0], event.code === 'KeyQ' ? -1 : 1), current.roles[1]],
          }));
        } else if (
          configRef.current.experience === 'defense' &&
          (event.code === 'BracketLeft' || event.code === 'BracketRight')
        ) {
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
      if (gameRef.current.mode === 'tour') {
        if (['Enter', 'Space', 'KeyF', 'KeyG'].includes(event.code)) continueTour();
        if (event.code === 'Escape') returnToSetup();
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
  }, [continueTour, returnToSetup, startGame, updateConfig]);

  useEffect(
    () => () => {
      soundRef.current?.destroy();
    },
    []
  );

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
        <button
          aria-label={soundMuted ? 'Turn sound effects on' : 'Mute sound effects'}
          aria-pressed={!soundMuted}
          className={`immune-sound-toggle${soundMuted ? ' is-muted' : ''}`}
          onClick={toggleSound}
          title={soundMuted ? 'Turn sound effects on' : 'Mute sound effects'}
          type="button"
        >
          {soundMuted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
        </button>
      </nav>

      {snapshot.mode === 'tour' && (
        <section
          aria-describedby="immune-guide-line"
          aria-labelledby="immune-guide-title"
          aria-modal="true"
          className="immune-guide"
          role="dialog"
        >
          <div className="immune-guide__character" aria-hidden="true">
            <div className="immune-guide__cell">
              <span className="immune-guide__eye immune-guide__eye--left" />
              <span className="immune-guide__eye immune-guide__eye--right" />
              <span className="immune-guide__smile" />
              <span className="immune-guide__arm immune-guide__arm--left" />
              <span className="immune-guide__arm immune-guide__arm--right" />
            </div>
            <strong>Mo</strong>
            <small>your cell guide</small>
          </div>

          <div className="immune-guide__bubble">
            <div className="immune-guide__step">
              <span aria-hidden="true">{currentLesson.icon}</span>
              Immune Journey
            </div>
            <h1 id="immune-guide-title">{currentLesson.title}</h1>
            <p id="immune-guide-line">{currentLesson.narration}</p>
            <div className="immune-guide__mission">
              <span aria-hidden="true">★</span>
              <strong>{currentLesson.objective}</strong>
            </div>
            <div className="immune-guide__actions">
              <button
                className="immune-guide__go"
                onClick={continueTour}
                ref={guideButtonRef}
                type="button"
              >
                <span aria-hidden="true">{currentLesson.ctaIcon}</span>
                <small>{currentLesson.cta}</small>
              </button>
              <button
                className="immune-guide__listen"
                onClick={soundMuted ? toggleSound : replayNarration}
                type="button"
              >
                {soundMuted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
                {soundMuted ? 'Turn sound on' : 'Hear Mo again'}
              </button>
            </div>
            <small className="immune-guide__controls">A button or Enter</small>
            <ol className="immune-guide__dots" aria-label="Journey progress">
              {LEARNING_STAGES.map((stage, index) => (
                <li
                  aria-label={
                    index < snapshot.lessonStage
                      ? `${stage.title}, complete`
                      : index === snapshot.lessonStage
                        ? `${stage.title}, current`
                        : stage.title
                  }
                  className={
                    index < snapshot.lessonStage
                      ? 'is-complete'
                      : index === snapshot.lessonStage
                        ? 'is-current'
                        : ''
                  }
                  key={stage.id}
                />
              ))}
            </ol>
          </div>
        </section>
      )}

      {snapshot.mode !== 'setup' && (
        <section
          className={`immune-hud${snapshot.experience === 'education' ? ' immune-hud--learning' : ''}`}
        >
          <div className="immune-hud__mission">
            <strong>
              {snapshot.experience === 'education' ? currentLesson.title : snapshot.responseTitle}
            </strong>
            <span>
              {snapshot.experience === 'education'
                ? currentLesson.objective
                : snapshot.responseDetail}
            </span>
          </div>
          {snapshot.experience === 'education' ? (
            <div className="immune-hud__picture-progress" aria-hidden="true">
              {stageLesson.progressIcons.map((icon, index) => (
                <span
                  className={
                    index < Math.round(snapshot.lessonProgress * stageLesson.progressIcons.length)
                      ? 'is-complete'
                      : ''
                  }
                  // biome-ignore lint/suspicious/noArrayIndexKey: Fixed visual milestones intentionally repeat icons.
                  key={`${stageLesson.id}-${index}`}
                >
                  {icon}
                </span>
              ))}
            </div>
          ) : (
            <div className="immune-hud__stats">
              <span>
                <b>{snapshot.bacteria}</b> bacteria
              </span>
              <span
                className="immune-hud__tissue"
                style={{ '--tissue-health-color': tissueHealthColor(snapshot.integrity / 100) }}
              >
                <b>{snapshot.integrity}%</b> tissue
              </span>
              {snapshot.criticalTissue > 0 && (
                <span className="immune-hud__critical">
                  {snapshot.criticalTissue}% critical tissue
                </span>
              )}
              {snapshot.phase === 'innate' && (
                <span className="immune-hud__division">Division in {snapshot.nextDivision}s</span>
              )}
            </div>
          )}
          <div
            className={`immune-response-track${snapshot.responsePulse ? ' is-boosted' : ''}`}
            aria-label={
              snapshot.experience === 'education'
                ? 'Immune Journey progress'
                : 'Adaptive response progress'
            }
            aria-valuemax={snapshot.experience === 'education' ? LEARNING_STAGES.length : 1}
            aria-valuemin={0}
            aria-valuenow={
              snapshot.experience === 'education'
                ? snapshot.lessonStage + snapshot.lessonProgress
                : snapshot.responseProgress
            }
            aria-valuetext={
              snapshot.experience === 'education'
                ? `${currentLesson.title}: ${snapshot.lessonProgressLabel}`
                : `${snapshot.responseTitle}: ${snapshot.responseDetail}`
            }
            role="progressbar"
          >
            <span
              style={{
                transform: `scaleX(${
                  snapshot.experience === 'education'
                    ? (snapshot.lessonStage + snapshot.lessonProgress) / LEARNING_STAGES.length
                    : snapshot.responseProgress
                })`,
              }}
            />
          </div>
          {snapshot.experience === 'defense' && (
            <ol className="immune-response-steps" aria-label="Steps to make antibodies">
              {ADAPTIVE_RESPONSE_STAGES.map((stage, index) => (
                <li
                  className={
                    index < snapshot.responseStageIndex
                      ? 'is-complete'
                      : index === snapshot.responseStageIndex
                        ? 'is-current'
                        : ''
                  }
                  key={stage.id}
                  style={{
                    '--response-stage-fill': `${
                      index < snapshot.responseStageIndex
                        ? 360
                        : index === snapshot.responseStageIndex
                          ? snapshot.responseStageProgress * 360
                          : 0
                    }deg`,
                  }}
                >
                  <span aria-hidden="true">{stage.icon}</span>
                  <small>{stage.label}</small>
                </li>
              ))}
            </ol>
          )}
          {snapshot.experience === 'education' && (
            <div className="immune-learning-guide">
              <ol aria-label="Immune response stages">
                {LEARNING_STAGES.map((stage, index) => (
                  <li
                    className={
                      index < snapshot.lessonStage
                        ? 'is-complete'
                        : index === snapshot.lessonStage
                          ? 'is-current'
                          : ''
                    }
                    key={stage.id}
                  >
                    <span aria-hidden="true">{stage.icon}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>
      )}

      {snapshot.mode === 'playing' && snapshot.players.length > 0 && (
        <aside className="sr-only" aria-label="Player cell status">
          {snapshot.players.map((player, index) => (
            <span key={`player-${player.playerIndex + 1}`}>
              Player {index + 1}, {ROLES[player.role].name}.{' '}
              {player.role === 'macrophage' ? `Energy ${Math.round(player.energy * 100)}%. ` : ''}
              {player.fatigued
                ? 'Cell reforming.'
                : player.exhausted > 0
                  ? 'Low energy, unable to engulf.'
                  : player.specialCd > 0
                    ? `${ROLES[player.role].special} recharging.`
                    : `${ROLES[player.role].special} ready.`}
            </span>
          ))}
        </aside>
      )}

      {snapshot.mode === 'playing' &&
        snapshot.experience === 'defense' &&
        snapshot.players.some((player) => ['helper', 'dendritic'].includes(player.role)) && (
          <aside className="immune-helper-coach" aria-label="Support cell controls">
            {snapshot.players
              .filter((player) => ['helper', 'dendritic'].includes(player.role))
              .map((player) => (
                <div key={`helper-coach-${player.playerIndex}`}>
                  <strong>
                    P{player.playerIndex + 1}{' '}
                    {player.role === 'helper' ? 'Helper' : 'Dendritic scout'}
                  </strong>
                  <span>
                    <b>{player.playerIndex === 0 ? 'F / A' : 'Enter / A'}</b>{' '}
                    {player.role === 'helper' ? 'Mark + boost' : 'Sample germ bits'}
                  </span>
                  <span>
                    <b>{player.playerIndex === 0 ? 'G / X' : '/ / X'}</b>{' '}
                    {player.role === 'helper' ? 'Team boost' : 'Antigen call'}
                  </span>
                </div>
              ))}
          </aside>
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
              aria-label={`${ROLES[snapshot.players[0].role].short} action${snapshot.players[0].exhausted > 0 ? ', unavailable while cell energy recovers' : ''}`}
              className={`immune-touch-action immune-touch-action--primary${
                snapshot.players[0].fatigued || snapshot.players[0].exhausted > 0
                  ? ' is-unavailable'
                  : ''
              }`}
              data-pressed="false"
              onContextMenu={(event) => event.preventDefault()}
              onPointerCancel={releaseTouchAction}
              onPointerDown={(event) => pressTouchAction('primary', event)}
              onPointerUp={releaseTouchAction}
              type="button"
            >
              <strong>{ROLES[snapshot.players[0].role].short}</strong>
              <small>
                {snapshot.players[0].role === 'helper'
                  ? 'Team +35%'
                  : snapshot.players[0].role === 'dendritic'
                    ? 'Collect clue'
                    : 'Action'}
              </small>
            </button>
            <button
              aria-label={`${ROLES[snapshot.players[0].role].special} special`}
              className="immune-touch-action immune-touch-action--special"
              data-pressed="false"
              onContextMenu={(event) => event.preventDefault()}
              onPointerCancel={releaseTouchAction}
              onPointerDown={(event) => pressTouchAction('special', event)}
              onPointerUp={releaseTouchAction}
              style={{ '--special-charge': `${snapshot.players[0].specialProgress * 360}deg` }}
              type="button"
            >
              <strong>{ROLES[snapshot.players[0].role].special}</strong>
              <small>
                {snapshot.players[0].role === 'helper'
                  ? 'Build plasma cells'
                  : snapshot.players[0].role === 'dendritic'
                    ? 'Find + present'
                    : 'Special'}
              </small>
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
            {config.experience === 'education'
              ? 'Guide each part of the response and learn how your body turns a local alarm into lasting immune memory.'
              : 'Damaged cells are crying for help. Leave germ bits for the dendritic scout, follow its lymph path, and watch B cells become roaming plasma-cell factories.'}
          </p>

          <fieldset className="immune-mode-select">
            <legend>Choose a mode</legend>
            <button
              aria-pressed={config.experience === 'education'}
              className={config.experience === 'education' ? 'is-selected' : ''}
              onClick={() =>
                updateConfig((current) => ({
                  ...current,
                  experience: 'education',
                  playerCount: 1,
                }))
              }
              type="button"
            >
              <strong>Immune Journey</strong>
              <small>Solo · Learn how your immune system fights an infection</small>
            </button>
            <button
              aria-pressed={config.experience === 'defense'}
              className={config.experience === 'defense' ? 'is-selected' : ''}
              onClick={() => updateConfig((current) => ({ ...current, experience: 'defense' }))}
              type="button"
            >
              <strong>Defense round</strong>
              <small>1–2 players · Choose a cell and survive the breach</small>
            </button>
          </fieldset>

          {config.experience === 'defense' ? (
            <>
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
                {['player-1', 'player-2']
                  .slice(0, config.playerCount)
                  .map((playerKey, playerIndex) => (
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
            </>
          ) : (
            <ol className="immune-journey-preview" aria-label="Immune Journey chapters">
              {LEARNING_STAGES.map((stage, index) => (
                <li key={stage.id}>
                  <span>{index + 1}</span>
                  <div>
                    <strong>{stage.cell}</strong>
                    <small>{stage.title}</small>
                  </div>
                </li>
              ))}
            </ol>
          )}

          <button className="immune-start" onClick={startGame} type="button">
            {config.experience === 'education' ? 'Begin Immune Journey' : 'Defend the tissue'}
          </button>
          <div className="immune-controls">
            <span>P1: WASD, F action, G special</span>
            {config.experience === 'defense' && config.playerCount === 2 && (
              <span>P2: Arrows, Enter action, / special</span>
            )}
            <span>Gamepad: Stick, A action, X or B special</span>
            <span>Setup: M or D-pad up/down changes mode</span>
            <span>Touch: joystick and action buttons control P1</span>
          </div>
        </section>
      )}

      {(snapshot.mode === 'won' || snapshot.mode === 'lost') && (
        <section className="immune-result" aria-labelledby="immune-result-title">
          <p className="immune-result__status">
            {snapshot.experience === 'education' && snapshot.mode === 'won'
              ? 'Response complete'
              : snapshot.mode === 'won'
                ? 'Breach contained'
                : 'Tissue overwhelmed'}
          </p>
          <h1 id="immune-result-title">
            {snapshot.experience === 'education' && snapshot.mode === 'won'
              ? 'Your immune system remembers.'
              : snapshot.mode === 'won'
                ? snapshot.earlyClear
                  ? 'Innate victory!'
                  : 'The cell squad finished the cleanup.'
                : 'The bacteria broke through.'}
          </h1>
          <p>
            {snapshot.experience === 'education' && snapshot.mode === 'won'
              ? 'Most activated cells shut down after the threat is gone. A few memory B and T cells remain, ready to recognize this bacterium much faster next time.'
              : snapshot.mode === 'won'
                ? snapshot.earlyClear
                  ? 'Your squad eliminated every bacterium before the adaptive response was needed.'
                  : 'Antibodies pinned the survivors. Macrophages and neutrophils cleared them.'
                : 'Try mixing cell roles and use special actions when bacteria divide.'}
          </p>
          {snapshot.experience === 'education' && snapshot.mode === 'won' && (
            <ol className="immune-response-recap" aria-label="Immune response recap">
              {LEARNING_STAGES.map((stage, index) => (
                <li key={stage.id}>
                  <span>{index + 1}</span>
                  <div>
                    <strong>{stage.cell}</strong>
                    <small>{stage.title}</small>
                  </div>
                </li>
              ))}
            </ol>
          )}
          <div className="immune-result__stats">
            {snapshot.experience === 'education' && snapshot.mode === 'won' ? (
              <>
                <span>
                  <strong>{LEARNING_STAGES.length}</strong> response stages
                </span>
                <span>
                  <strong>{snapshot.destroyed}</strong> bacteria cleared
                </span>
                <span>
                  <strong>{snapshot.germsCoated}</strong> germs coated
                </span>
                <span>
                  <strong>Formed</strong> immune memory
                </span>
              </>
            ) : (
              <>
                <span>
                  <strong>{snapshot.destroyed}</strong> germs cleared
                </span>
                <span>
                  <strong>{snapshot.integrity}%</strong> tissue left
                </span>
                <span>
                  <strong>{snapshot.germsCoated}</strong> germs coated
                </span>
                <span>
                  <strong>{snapshot.hostCellsSaved}</strong> cells saved
                </span>
                <span>
                  <strong>{snapshot.hostCellsLost}</strong> cells lost
                </span>
              </>
            )}
          </div>
          <div className="immune-result__actions">
            <button className="immune-start" onClick={startGame} type="button">
              {snapshot.experience === 'education' ? 'Replay the response' : 'Defend again'}
            </button>
            <button className="immune-secondary" onClick={returnToSetup} type="button">
              {snapshot.experience === 'education' ? 'Choose another mode' : 'Change cells'}
            </button>
          </div>
          <small>Press R or Enter to play again</small>
        </section>
      )}
    </main>
  );
}
