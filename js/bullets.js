function updateBullets(dt) {
  for (let i = G.bullets.length - 1; i >= 0; i--) {
    const b = G.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    wrap(b);
    if (b.life <= 0) G.bullets.splice(i, 1);
  }
}

function spawnPlayerMissile(player) {
  const s = player.ship;
  if (!s) return false;

  const x = s.x + Math.cos(s.angle) * SHIP_SIZE;
  const y = s.y + Math.sin(s.angle) * SHIP_SIZE;
  G.playerMissiles.push({
    x, y,
    vx: Math.cos(s.angle) * SPECIAL_MISSILE_SPEED + s.vx * 0.25,
    vy: Math.sin(s.angle) * SPECIAL_MISSILE_SPEED + s.vy * 0.25,
    angle: s.angle,
    r: SPECIAL_MISSILE_RADIUS,
    life: SPECIAL_MISSILE_LIFE,
    owner: player.id,
    color: player.color,
    trail: []
  });
  playSound('missile');
  return true;
}

function updatePlayerMissiles(dt) {
  for (let i = G.playerMissiles.length - 1; i >= 0; i--) {
    const m = G.playerMissiles[i];
    m.x += m.vx * dt;
    m.y += m.vy * dt;
    m.angle = Math.atan2(m.vy, m.vx);
    m.life -= dt;

    if (Math.random() < 0.9) {
      m.trail.push({ x: m.x, y: m.y, life: 0.45 });
    }
    for (let j = m.trail.length - 1; j >= 0; j--) {
      m.trail[j].life -= dt;
      if (m.trail[j].life <= 0) m.trail.splice(j, 1);
    }

    const offscreen = m.x < -m.r || m.x > G.W + m.r || m.y < -m.r || m.y > G.H + m.r;
    if (m.life <= 0 || offscreen) {
      explodePlayerMissile(m);
    }
  }
}
