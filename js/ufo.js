/* ============================================================
   UFO FACTORY
   ============================================================ */
function spawnUfo(x, y) {
  if (G.ufos.length >= maxActiveUfos()) return false;

  const angle = rand(0, Math.PI * 2);
  G.ufos.push({
    x, y,
    vx: Math.cos(angle) * UFO_SPEED,
    vy: Math.sin(angle) * UFO_SPEED,
    r: UFO_RADIUS, points: UFO_POINTS,
    hp: currentUfoHits(),
    rot: 0, rotSpeed: rand(-2, 2),
    dodgeEnd: G.now + UFO_DODGE_TIME,
    nextFire: G.now + rand(0.8, UFO_FIRE_RATE),
    targetId: null,
    lightPhase: rand(0, Math.PI * 2),
    trail: []
  });
  playSound('ufoReveal');
  return true;
}

function scheduleNextBossUfo() {
  G.nextBossSpawn = G.now + rand(BOSS_UFO_SPAWN_MIN, BOSS_UFO_SPAWN_MAX);
}

function spawnBossUfo() {
  if (G.ufos.some(u => u.isBoss)) return false;

  const side = randInt(0, 3);
  let x, y;
  if (side === 0) {
    x = rand(0, G.W); y = -BOSS_UFO_RADIUS;
  } else if (side === 1) {
    x = G.W + BOSS_UFO_RADIUS; y = rand(0, G.H);
  } else if (side === 2) {
    x = rand(0, G.W); y = G.H + BOSS_UFO_RADIUS;
  } else {
    x = -BOSS_UFO_RADIUS; y = rand(0, G.H);
  }

  const target = closestAlivePlayer(x, y);
  const angle = target && target.ship
    ? Math.atan2(target.ship.y - y, target.ship.x - x)
    : rand(0, Math.PI * 2);

  G.ufos.push({
    x, y,
    vx: Math.cos(angle) * BOSS_UFO_SPEED,
    vy: Math.sin(angle) * BOSS_UFO_SPEED,
    r: BOSS_UFO_RADIUS, points: BOSS_UFO_POINTS,
    hp: BOSS_UFO_HITS,
    isBoss: true,
    rot: 0, rotSpeed: rand(-0.8, 0.8),
    dodgeEnd: G.now + UFO_DODGE_TIME,
    nextFire: G.now + rand(1.0, BOSS_UFO_FIRE_RATE),
    targetId: null,
    lightPhase: rand(0, Math.PI * 2),
    trail: []
  });
  playSound('ufoReveal');
  return true;
}

function maybeSpawnBossUfo() {
  if (!G.players.some(p => p.alive && p.ship)) return;
  if (!G.nextBossSpawn) scheduleNextBossUfo();
  if (G.now >= G.nextBossSpawn) {
    spawnBossUfo();
    scheduleNextBossUfo();
  }
}

function spawnMissile(u, target) {
  if (!target || !target.ship) return;
  const s = target.ship;
  const angle = Math.atan2(s.y - u.y, s.x - u.x);
  const count = u.missileCount || (u.isBoss ? BOSS_UFO_MISSILE_COUNT : 1);
  const spread = u.missileSpread || (u.isBoss ? BOSS_UFO_MISSILE_SPREAD : 0);
  const start = -spread * (count - 1) / 2;
  for (let i = 0; i < count; i++) {
    const a = angle + start + spread * i;
    G.missiles.push({
      x: u.x, y: u.y,
      vx: Math.cos(a) * MISSILE_SPEED,
      vy: Math.sin(a) * MISSILE_SPEED,
      angle: a,
      r: MISSILE_RADIUS,
      targetId: target.id,
      trail: []
    });
  }
  playSound('missile');
}

function updateUfos(dt) {
  const slowMult = anyPlayerHasSlow() ? 0.4 : 1;
  maybeSpawnBossUfo();

  for (let i = G.ufos.length - 1; i >= 0; i--) {
    const u = G.ufos[i];
    u.rot += u.rotSpeed * dt * slowMult;
    u.lightPhase += dt * 4;

    const target = closestAlivePlayer(u.x, u.y);
    u.targetId = target ? target.id : null;

    if (target && target.ship) {
      const s = target.ship;
      let dx = s.x - u.x;
      let dy = s.y - u.y;
      if (Math.abs(dx) > G.W / 2) dx -= Math.sign(dx) * G.W;
      if (Math.abs(dy) > G.H / 2) dy -= Math.sign(dy) * G.H;
      const d = Math.hypot(dx, dy) || 1;
      const baseSpeed = u.isBoss ? BOSS_UFO_SPEED : UFO_SPEED;
      const desiredSpeed = d > UFO_FOLLOW_DISTANCE ? baseSpeed : baseSpeed * 0.35;
      const desiredVx = (dx / d) * desiredSpeed;
      const desiredVy = (dy / d) * desiredSpeed;
      const steer = u.isBoss ? 0.75 : (G.now < u.dodgeEnd ? 0.9 : 1.8);
      u.vx += (desiredVx - u.vx) * steer * dt;
      u.vy += (desiredVy - u.vy) * steer * dt;
      const spd = Math.hypot(u.vx, u.vy);
      if (spd > baseSpeed * 1.6) {
        u.vx = (u.vx / spd) * baseSpeed * 1.6;
        u.vy = (u.vy / spd) * baseSpeed * 1.6;
      }

      if (G.now >= u.nextFire) {
        spawnMissile(u, target);
        const fireRate = u.isBoss ? BOSS_UFO_FIRE_RATE : UFO_FIRE_RATE;
        u.nextFire = G.now + fireRate + rand(-0.25, 0.35);
      }
    }

    u.x += u.vx * dt * slowMult;
    u.y += u.vy * dt * slowMult;
    wrap(u);

    if (Math.random() < 0.3)
      u.trail.push({ x: u.x, y: u.y, life: 0.5 });
    for (let j = u.trail.length - 1; j >= 0; j--) {
      u.trail[j].life -= dt;
      if (u.trail[j].life <= 0) u.trail.splice(j, 1);
    }
  }
}

function updateMissiles(dt) {
  const slowMult = anyPlayerHasSlow() ? 0.4 : 1;
  for (let i = G.missiles.length - 1; i >= 0; i--) {
    const m = G.missiles[i];
    const target = G.players.find(p => p.id === m.targetId && p.alive && p.ship) || closestAlivePlayer(m.x, m.y);
    if (target && target.ship) {
      const s = target.ship;
      let dx = s.x - m.x;
      let dy = s.y - m.y;
      if (Math.abs(dx) > G.W / 2) dx -= Math.sign(dx) * G.W;
      if (Math.abs(dy) > G.H / 2) dy -= Math.sign(dy) * G.H;
      const desired = Math.atan2(dy, dx);
      let delta = desired - m.angle;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      const maxTurn = MISSILE_TURN_RATE * dt * slowMult;
      m.angle += Math.max(-maxTurn, Math.min(maxTurn, delta));
      m.targetId = target.id;
    }

    const speed = MISSILE_SPEED;
    m.vx = Math.cos(m.angle) * speed;
    m.vy = Math.sin(m.angle) * speed;
    m.x += m.vx * dt * slowMult;
    m.y += m.vy * dt * slowMult;
    wrap(m);

    if (Math.random() < 0.7) m.trail.push({ x: m.x, y: m.y, life: 0.35 });
    for (let j = m.trail.length - 1; j >= 0; j--) {
      m.trail[j].life -= dt;
      if (m.trail[j].life <= 0) m.trail.splice(j, 1);
    }

  }
}

function drawUfo(u, t) {
  for (const tr of u.trail) {
    const alpha = tr.life / 0.5 * 0.3;
    G.ctx.fillStyle = `rgba(100,200,255,${alpha})`;
    G.ctx.beginPath();
    G.ctx.arc(tr.x, tr.y, 3, 0, Math.PI * 2);
    G.ctx.fill();
  }

  G.ctx.save();
  G.ctx.translate(u.x, u.y);
  G.ctx.rotate(u.rot);

  const radius = u.r || UFO_RADIUS;
  const glow = 0.6 + 0.4 * Math.sin(u.lightPhase);
  G.ctx.strokeStyle = u.isBoss ? `rgba(255,90,90,${glow})` : `rgba(150,220,255,${glow})`;
  G.ctx.lineWidth = u.isBoss ? 3.5 : 2;

  G.ctx.beginPath();
  G.ctx.ellipse(0, 0, radius, radius * 0.4, 0, 0, Math.PI);
  G.ctx.stroke();

  G.ctx.beginPath();
  G.ctx.ellipse(0, 0, radius * 0.6, radius * 0.6, 0, Math.PI, 0);
  G.ctx.stroke();

  if (u.isBoss) {
    G.ctx.strokeStyle = `rgba(255,180,80,${glow})`;
    G.ctx.beginPath();
    G.ctx.moveTo(-radius * 0.65, -radius * 0.08);
    G.ctx.lineTo(radius * 0.65, -radius * 0.08);
    G.ctx.stroke();
  }

  const numLights = u.isBoss ? 9 : 5;
  for (let i = 0; i < numLights; i++) {
    const a = (i / numLights) * Math.PI * 2 + t * 2;
    const lx = Math.cos(a) * radius * 0.9;
    const ly = Math.sin(a) * radius * 0.35;
    const lc = u.isBoss ? ((Math.sin(a * 3 + t * 5) > 0) ? '#f44' : '#fc0') : ((Math.sin(a * 3 + t * 5) > 0) ? '#ff0' : '#f80');
    G.ctx.fillStyle = lc;
    // Use larger filled circle instead of shadowBlur for glow effect
    G.ctx.beginPath();
    G.ctx.arc(lx, ly, u.isBoss ? 4.5 : 3, 0, Math.PI * 2);
    G.ctx.fill();
  }
  G.ctx.restore();
}

function drawMissile(m) {
  for (const tr of m.trail) {
    const alpha = tr.life / 0.35 * 0.45;
    G.ctx.fillStyle = `rgba(255,120,60,${alpha})`;
    G.ctx.beginPath();
    G.ctx.arc(tr.x, tr.y, 3, 0, Math.PI * 2);
    G.ctx.fill();
  }

  G.ctx.save();
  G.ctx.translate(m.x, m.y);
  G.ctx.rotate(m.angle);
  G.ctx.strokeStyle = '#f84';
  G.ctx.fillStyle = '#fff';
  G.ctx.lineWidth = 2;
  G.ctx.beginPath();
  G.ctx.moveTo(9, 0);
  G.ctx.lineTo(-6, -5);
  G.ctx.lineTo(-3, 0);
  G.ctx.lineTo(-6, 5);
  G.ctx.closePath();
  G.ctx.stroke();
  G.ctx.beginPath();
  G.ctx.arc(2, 0, 2, 0, Math.PI * 2);
  G.ctx.fill();
  G.ctx.restore();
}
