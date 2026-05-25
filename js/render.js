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
    G.ctx.strokeStyle = accentColor || '#f84';
    G.ctx.lineWidth = 2;
    const flicker = rand(0.4, 1.2) * SHIP_SIZE * 0.8;
    G.ctx.beginPath();
    G.ctx.moveTo(-SHIP_SIZE * 0.5, -SHIP_SIZE * 0.25);
    G.ctx.lineTo(-SHIP_SIZE * 0.5 - flicker, 0);
    G.ctx.lineTo(-SHIP_SIZE * 0.5, SHIP_SIZE * 0.25);
    G.ctx.stroke();
    G.ctx.strokeStyle = '#ff0';
    const flicker2 = rand(0.2, 0.6) * SHIP_SIZE * 0.6;
    G.ctx.beginPath();
    G.ctx.moveTo(-SHIP_SIZE * 0.5, -SHIP_SIZE * 0.12);
    G.ctx.lineTo(-SHIP_SIZE * 0.5 - flicker2, 0);
    G.ctx.lineTo(-SHIP_SIZE * 0.5, SHIP_SIZE * 0.12);
    G.ctx.stroke();
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

function getBulletSprite(color, laser) {
  const key = color + ':' + (laser ? 'L' : 'S');
  if (bulletSprites[key]) return bulletSprites[key];
  const c = document.createElement('canvas');
  const size = laser ? 24 : 16;
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const half = size / 2;
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0, '#fff');
  grad.addColorStop(0.2, color);
  const rgb = hexToRgb(color);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = grad;
  if (laser) {
    // Horizontal beam pointing right (will be rotated when drawn)
    ctx.save();
    // Glow halo (using the gradient)
    ctx.fillRect(0, 0, size, size);
    // White core
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, half - 2, size, 4);
    // Colored beam
    ctx.fillStyle = color;
    ctx.fillRect(0, half - 4, size, 8);
    ctx.restore();
  } else {
    ctx.beginPath();
    ctx.arc(half, half, half, 0, Math.PI * 2);
    ctx.fill();
  }
  bulletSprites[key] = c;
  return c;
}

function drawBullets() {
  const ctx = G.ctx;
  for (const b of G.bullets) {
    const col = b.color || '#ff4';
    const sprite = getBulletSprite(col, b.laser);
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
  document.getElementById('hud-wave').textContent = G.wave;

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
          <div class="lives">LIVES <span id="hud-p${pid}-lives"></span></div>
          <div class="powerups" id="hud-p${pid}-powerups"></div>
          <div class="out-label" id="hud-p${pid}-out" style="display:none">OUT</div>
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

    let livesHTML = '';
    for (let i = 0; i < player.lives; i++) livesHTML += '\u25B2 ';
    document.getElementById(`hud-p${pid}-lives`).textContent = livesHTML || '0';

    // Player out indicator
    const outEl = document.getElementById(`hud-p${pid}-out`);
    if (outEl) {
      outEl.style.display = (!player.alive && player.lives <= 0 && G.state === 'playing') ? 'block' : 'none';
    }

    // Power-ups display
    const puContainer = document.getElementById(`hud-p${pid}-powerups`);
    let puHTML = '';
    const addPill = (type) => {
      const cfg = POWERUPS[type];
      puHTML += `<span style="color:${cfg.color};border:1px solid ${cfg.color};padding:1px 5px;border-radius:3px;font-size:10px;line-height:1.4">${cfg.label} ${cfg.desc}`;
      if (type === 'SHIELD') puHTML += ` x${player.shieldHits}`;
      puHTML += `</span> `;
    };
    if (player.hasRapid) addPill('RAPID');
    if (player.hasLaser) addPill('LASER');
    if (player.hasBigger) addPill('BIGGER');
    if (player.hasSlow) addPill('SLOW');
    if (player.hasShield && player.shieldHits > 0) addPill('SHIELD');
    for (const m of player.weaponModes) {
      const key = m.toUpperCase();
      if (POWERUPS[key]) addPill(key);
    }
    puContainer.innerHTML = puHTML;
  }
}
