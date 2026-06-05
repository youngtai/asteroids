/* ============================================================
   SCREEN SHAKE
   ============================================================ */
function updateShake(dt) {
  if (G.shakeMag > 0.1) {
    G.shakeX = (Math.random() - 0.5) * G.shakeMag * 2;
    G.shakeY = (Math.random() - 0.5) * G.shakeMag * 2;
    G.shakeMag *= Math.exp(-SCREEN_SHAKE_DECAY * dt);
    if (G.shakeMag < 0.3) { G.shakeMag = 0; G.shakeX = 0; G.shakeY = 0; }
  } else {
    G.shakeX = 0; G.shakeY = 0;
  }
}

/* ============================================================
   RENDER
   ============================================================ */
function drawStars(t) {
  if (!starCanvas) return;
  G.ctx.globalAlpha = 0.9 + 0.1 * Math.sin(t * 0.5); // subtle twinkle via alpha
  G.ctx.drawImage(starCanvas, 0, 0);
  G.ctx.globalAlpha = 1;
}

function drawShip(player, t) {
  const s = player.ship;
  if (!s) return;
  if (G.now < s.invulnEnd && Math.sin(t * 20) > 0) return;

  G.ctx.save();
  G.ctx.translate(s.x, s.y);
  G.ctx.rotate(s.angle);

  // Ship color: player base color or skin color
  const skin = SHIP_SKINS[player.shipSkin] || SHIP_SKINS.default;
  const shipColor = skin.color || player.color;
  const accentColor = skin.accent || player.accentColor;

  G.ctx.strokeStyle = shipColor;
  G.ctx.lineWidth = 2;
  G.ctx.lineJoin = 'round';
  G.ctx.beginPath();
  G.ctx.moveTo(SHIP_SIZE, 0);
  G.ctx.lineTo(-SHIP_SIZE * 0.8, -SHIP_SIZE * 0.65);
  G.ctx.lineTo(-SHIP_SIZE * 0.5, 0);
  G.ctx.lineTo(-SHIP_SIZE * 0.8, SHIP_SIZE * 0.65);
  G.ctx.closePath();
  G.ctx.stroke();

  // Shield visual
  if (player.hasShield && player.shieldHits > 0) {
    G.ctx.strokeStyle = POWERUPS.SHIELD.color;
    G.ctx.lineWidth = 1.5;
    G.ctx.globalAlpha = 0.3 + 0.15 * Math.sin(t * 5);
    G.ctx.beginPath();
    G.ctx.arc(0, 0, SHIP_SIZE * 1.3, 0, Math.PI * 2);
    G.ctx.stroke();
    G.ctx.globalAlpha = 1;
    G.ctx.fillStyle = POWERUPS.SHIELD.color;
    G.ctx.font = 'bold 10px Courier New';
    G.ctx.textAlign = 'center';
    G.ctx.textBaseline = 'middle';
    G.ctx.fillText(player.shieldHits, 0, 0);
  }

  // Thrust flame - use player color accent
  if (s.thrusting) {
    const flicker = rand(0.5, 1.0) * SHIP_SIZE * 0.55;
    G.ctx.fillStyle = accentColor || '#f84';
    G.ctx.globalAlpha = 0.75;
    G.ctx.beginPath();
    G.ctx.moveTo(-SHIP_SIZE * 0.58, -SHIP_SIZE * 0.18);
    G.ctx.lineTo(-SHIP_SIZE * 0.58 - flicker, 0);
    G.ctx.lineTo(-SHIP_SIZE * 0.58, SHIP_SIZE * 0.18);
    G.ctx.closePath();
    G.ctx.fill();

    G.ctx.fillStyle = '#ffb347';
    G.ctx.globalAlpha = 0.9;
    const core = rand(0.35, 0.7) * SHIP_SIZE * 0.45;
    G.ctx.beginPath();
    G.ctx.moveTo(-SHIP_SIZE * 0.62, -SHIP_SIZE * 0.07);
    G.ctx.lineTo(-SHIP_SIZE * 0.62 - core, 0);
    G.ctx.lineTo(-SHIP_SIZE * 0.62, SHIP_SIZE * 0.07);
    G.ctx.closePath();
    G.ctx.fill();
    G.ctx.globalAlpha = 1;
  }

  G.ctx.restore();
}

function drawAsteroid(a) {
  G.ctx.save();
  G.ctx.translate(a.x, a.y);
  G.ctx.rotate(a.rot);

  if (a.isPowerup && a.puType) {
    const cfg = POWERUPS[a.puType];
    G.ctx.strokeStyle = cfg.color;
    G.ctx.lineWidth = 2.5; // thicker line replaces shadow effect
  } else {
    G.ctx.strokeStyle = '#fff';
    G.ctx.lineWidth = 1.5;
  }

  G.ctx.beginPath();
  for (let i = 0; i < a.verts.length; i++) {
    const angle = (i / a.verts.length) * Math.PI * 2;
    const r = a.r * a.verts[i];
    const px = Math.cos(angle) * r;
    const py = Math.sin(angle) * r;
    if (i === 0) G.ctx.moveTo(px, py);
    else G.ctx.lineTo(px, py);
  }
  G.ctx.closePath();
  G.ctx.stroke();
  G.ctx.restore();
}

// Pre-rendered bullet sprites (glow effect cached)
const bulletSprites = {};

function getBulletSprite(color, laser, laserLevel) {
  const level = laser ? Math.max(1, Math.min(LASER_MAX_LEVEL, laserLevel || 1)) : 0;
  const key = color + ':' + (laser ? 'L' + level : 'S');
  if (bulletSprites[key]) return bulletSprites[key];
  const c = document.createElement('canvas');
  const size = laser ? 24 + level * 10 : 16;
  c.width = size;
  c.height = laser ? 18 + level * 5 : size;
  const ctx = c.getContext('2d');
  const halfX = c.width / 2;
  const halfY = c.height / 2;
  const grad = ctx.createRadialGradient(halfX, halfY, 0, halfX, halfY, Math.max(c.width, c.height) / 2);
  grad.addColorStop(0, '#fff');
  grad.addColorStop(0.2, color);
  const rgb = hexToRgb(color);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = grad;
  if (laser) {
    // Horizontal beam pointing right (will be rotated when drawn)
    ctx.save();
    // Glow halo (using the gradient)
    ctx.fillRect(0, 0, c.width, c.height);
    // White core
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, halfY - (1 + level * 0.6), c.width, 2 + level * 1.2);
    // Colored beam
    ctx.fillStyle = color;
    ctx.fillRect(0, halfY - (3 + level), c.width, 6 + level * 2);
    ctx.restore();
  } else {
    ctx.beginPath();
    ctx.arc(halfX, halfY, halfX, 0, Math.PI * 2);
    ctx.fill();
  }
  bulletSprites[key] = c;
  return c;
}

function drawBullets() {
  const ctx = G.ctx;
  for (const b of G.bullets) {
    const col = b.color || '#ff4';
    const sprite = getBulletSprite(col, b.laser, b.laserLevel);
    if (b.laser) {
      // Rotate laser to match bullet direction
      const angle = Math.atan2(b.vy, b.vx);
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(angle);
      ctx.drawImage(sprite, -sprite.width / 2, -sprite.height / 2);
      ctx.restore();
    } else {
      ctx.drawImage(sprite, b.x - sprite.width / 2, b.y - sprite.height / 2);
    }
  }
}

function drawPlayerMissiles() {
  const ctx = G.ctx;
  for (const m of G.playerMissiles) {
    for (const tr of m.trail) {
      const alpha = tr.life / 0.45 * 0.45;
      ctx.fillStyle = `rgba(255,80,60,${alpha})`;
      ctx.beginPath();
      ctx.arc(tr.x, tr.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(m.angle);
    ctx.strokeStyle = m.color || '#f44';
    ctx.fillStyle = '#fff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-10, -7);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-10, 7);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(4, 0, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawParticles() {
  if (G.particles.length === 0) return;

  G.ctx.save();
  G.ctx.globalCompositeOperation = 'lighter';

  // Single pass: batch by type for fewer context switches
  // 1. Rings first (no transform needed)
  for (let i = 0; i < G.particles.length; i++) {
    const p = G.particles[i];
    if (p.type !== PT.RING) continue;
    const t = 1 - p.life / p.maxLife;
    const r = p.size * (0.2 + t * 0.8);
    const alpha = (1 - t * t) * 0.8;
    const lw = 2 * (1 - t);
    G.ctx.lineWidth = lw;
    G.ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
    G.ctx.beginPath();
    G.ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    G.ctx.stroke();
    const rgb = hexToRgb(p.color);
    G.ctx.lineWidth = lw * 2;
    G.ctx.strokeStyle = `rgba(${rgb},${alpha * 0.6})`;
    G.ctx.beginPath();
    G.ctx.arc(p.x, p.y, r * 0.9, 0, Math.PI * 2);
    G.ctx.stroke();
  }

  // 2. Glow/Debris sprites (batch drawImage calls)
  G.ctx.globalAlpha = 1;
  for (let i = 0; i < G.particles.length; i++) {
    const p = G.particles[i];
    if (p.type !== PT.GLOW && p.type !== PT.DEBRIS) continue;
    const alpha = p.life / p.maxLife;
    if (alpha <= 0) continue;
    let sz = p.size;
    if (p.type === PT.GLOW) sz = sz * (2 + alpha * 4);
    if (sz < 8) sz = 8;
    const sprite = getSprite(p.color, sz | 0);
    if (!sprite) continue;
    G.ctx.globalAlpha = alpha;
    G.ctx.drawImage(sprite, p.x - sprite.width / 2, p.y - sprite.height / 2);
  }
  G.ctx.globalAlpha = 1;

  // 3. Sparks (minimal transforms)
  for (let i = 0; i < G.particles.length; i++) {
    const p = G.particles[i];
    if (p.type !== PT.SPARK) continue;
    const alpha = p.life / p.maxLife;
    if (alpha <= 0) continue;
    G.ctx.globalAlpha = alpha;
    const half = p.size / 4;
    const cos = Math.cos(p.rot || 0);
    const sin = Math.sin(p.rot || 0);
    // Draw cross without transform - faster for small counts
    const cx = p.x, cy = p.y;
    // White core line
    G.ctx.fillStyle = '#fff';
    G.ctx.fillRect(cx - half * cos + sin - 1, cy - half * sin - cos - 1, half * 2 + 2, 2);
    // Colored halo
    const rgb = hexToRgb(p.color);
    G.ctx.fillStyle = `rgba(${rgb},${alpha * 0.7})`;
    G.ctx.fillRect(cx - half * 2 * cos + sin - 2, cy - half * 2 * sin - cos - 2, half * 4 + 4, 4);
  }

  // 4. Thruster streaks: narrow exhaust lines only, no radial glow.
  G.ctx.lineCap = 'round';
  for (let i = 0; i < G.particles.length; i++) {
    const p = G.particles[i];
    if (p.type !== PT.THRUST) continue;
    const alpha = p.life / p.maxLife;
    if (alpha <= 0) continue;
    const len = p.size * (1.1 + alpha);
    const width = Math.max(1, p.size * 0.18);
    const angle = p.rot || 0;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const rgb = hexToRgb(p.color);
    G.ctx.globalAlpha = alpha * 0.8;
    G.ctx.strokeStyle = `rgba(${rgb},${alpha})`;
    G.ctx.lineWidth = width;
    G.ctx.beginPath();
    G.ctx.moveTo(p.x - cos * len * 0.35, p.y - sin * len * 0.35);
    G.ctx.lineTo(p.x - cos * len, p.y - sin * len);
    G.ctx.stroke();
  }
  G.ctx.lineCap = 'butt';
  G.ctx.globalAlpha = 1;

  G.ctx.restore();
}

// Pre-rendered powerup sprites (one per type)
const powerupSprites = {};

function getPowerupSprite(type, pulse) {
  const cfg = POWERUPS[type];
  const key = type + ':' + pulse.toFixed(1);
  if (powerupSprites[key]) return powerupSprites[key];

  const r = POWERUP_RADIUS * (1 + 0.15 * pulse);
  const c = document.createElement('canvas');
  const size = r * 2 + 4;
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const half = size / 2;

  // Glow halo
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  const rgb = hexToRgb(cfg.color);
  grad.addColorStop(0, `rgba(${rgb},0.4)`);
  grad.addColorStop(0.5, `rgba(${rgb},0.1)`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Circle outline
  ctx.strokeStyle = cfg.color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(half, half, r, 0, Math.PI * 2);
  ctx.stroke();

  // Inner fill
  ctx.fillStyle = cfg.color;
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.arc(half, half, r * 0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Label
  ctx.fillStyle = '#000';
  ctx.font = 'bold 12px Courier New';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(cfg.label, half, half + 1);

  powerupSprites[key] = c;
  return c;
}

function drawPowerups(t) {
  const ctx = G.ctx;
  for (const pu of G.powerups) {
    const cfg = POWERUPS[pu.type];
    const pulse = Math.sin(pu.pulse);
    const fade = Math.min(1, pu.life / 2);

    ctx.globalAlpha = fade;
    // Use cached sprite - pulse varies smoothly so cache stays fresh
    const sprite = getPowerupSprite(pu.type, pulse);
    ctx.drawImage(sprite, pu.x - sprite.width / 2, pu.y - sprite.height / 2);
  }
  ctx.globalAlpha = 1;
}

function updateHUD() {
  const roundEl = document.getElementById('hud-round');
  if (roundEl) roundEl.textContent = G.round || 1;

  const statusEl = document.getElementById('hud-boss-status');
  if (statusEl) {
    const bosses = G.ufos.filter(u => u.isBoss);
    const boss = bosses.reduce((lowest, u) => !lowest || u.hp < lowest.hp ? u : lowest, null);
    if (G.state === 'start') {
      statusEl.textContent = 'READY';
    } else if (G.state === 'roundComplete') {
      const remaining = Math.max(0, Math.ceil((G.nextRoundAt || G.now) - G.now));
      statusEl.textContent = `ROUND CLEAR  NEXT ${remaining}`;
    } else if (boss) {
      statusEl.textContent = `BOSSES ${G.bossesDefeated}/${bossStageCount()}  ACTIVE ${bosses.length}/${BOSS_UFO_MAX_ACTIVE}  LOW HP ${Math.max(0, Math.ceil(boss.hp))}`;
    } else if ((G.bossStage || 0) < bossStageCount()) {
      const remaining = Math.max(0, Math.ceil((G.nextBossSpawn || G.now) - G.now));
      statusEl.textContent = `BOSSES ${G.bossesDefeated}/${bossStageCount()}  NEXT ${remaining}`;
    } else {
      statusEl.textContent = `BOSSES ${G.bossesDefeated}/${bossStageCount()}`;
    }
  }

  const pauseEl = document.getElementById('hud-pause');
  pauseEl.style.opacity = G.state === 'paused' ? 1 : 0;
  const hudPlayers = document.getElementById('hud-players');
  if (hudPlayers) {
    const activeIds = new Set(G.players.map(p => p.id));
    for (const player of G.players) {
      const pid = player.id;
      if (!document.getElementById(`hud-p${pid}`)) {
        const el = document.createElement('div');
        el.className = 'player-hud';
        el.id = `hud-p${pid}`;
        el.style.color = player.color;
        el.innerHTML = `
          <div class="score">P${pid} <span id="hud-p${pid}-score">0</span></div>
          <div class="respawns">RESPAWNS &infin; <span id="hud-p${pid}-deaths"></span></div>
          <div class="powerups" id="hud-p${pid}-powerups"></div>
        `;
        hudPlayers.appendChild(el);
      }
    }
    for (const el of [...hudPlayers.querySelectorAll('.player-hud')]) {
      const id = Number(el.id.replace('hud-p', ''));
      if (!activeIds.has(id)) el.remove();
    }
  }

  // Update each player's HUD
  for (const player of G.players) {
    const pid = player.id;
    const scoreEl = document.getElementById(`hud-p${pid}-score`);
    if (!scoreEl) continue;
    scoreEl.textContent = player.score;

    const deathsEl = document.getElementById(`hud-p${pid}-deaths`);
    if (deathsEl) deathsEl.textContent = player.deaths ? `D${player.deaths}` : '';

    // Power-ups display
    const puContainer = document.getElementById(`hud-p${pid}-powerups`);
    let puHTML = '';
    const addPill = (type, suffix) => {
      const cfg = POWERUPS[type];
      puHTML += `<span style="color:${cfg.color};border:1px solid ${cfg.color};padding:1px 5px;border-radius:3px;font-size:10px;line-height:1.4">${cfg.label} ${cfg.desc}`;
      if (type === 'SHIELD') puHTML += ` x${player.shieldHits}`;
      if (suffix) puHTML += suffix;
      puHTML += `</span> `;
    };
    if (player.hasRapid) addPill('RAPID', ` x${Math.max(1, player.rapidLevel || 1)}`);
    if (player.hasLaser) {
      const laserLevel = activeLaserLevel(player);
      addPill('LASER', laserLevel > 1 ? ` x${laserLevel}` : '');
    }
    if (player.hasBigger) addPill('BIGGER');
    if (player.specialMissiles > 0) addPill('MISSILE', ` x${player.specialMissiles}`);
    if (hasActiveSlow(player)) addPill('SLOW');
    if (player.hasShield && player.shieldHits > 0) addPill('SHIELD');
    for (const m of player.weaponModes) {
      const key = m.toUpperCase();
      if (POWERUPS[key]) addPill(key);
    }
    puContainer.innerHTML = puHTML;
  }
}
