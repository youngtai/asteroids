/* ============================================================
   ASTEROID FACTORY
   ============================================================ */
function spawnAsteroid(x, y, sizeKey) {
  const cfg = ASTEROID[sizeKey];
  const angle = rand(0, Math.PI * 2);
  const speed = rand(ASTEROID_SPEED_LO, ASTEROID_SPEED_HI) * cfg.speedMult;
  const verts = [];
  const numVerts = randInt(7, 12);
  for (let i = 0; i < numVerts; i++) verts.push(rand(0.6, 1.3));
  const canCarryPowerup = sizeKey !== 'SMALL' && visiblePowerupCount() < MAX_VISIBLE_POWERUPS;
  const isPowerup = canCarryPowerup && Math.random() < POWERUP_CHANCE;
  const puType = isPowerup ? POWERUP_KEYS[randInt(0, POWERUP_KEYS.length - 1)] : null;
  const hasUfo = sizeKey === 'LARGE' && Math.random() < currentUfoChance();
  return {
    x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
    r: cfg.radius, points: cfg.points, sizeKey,
    rot: 0, rotSpeed: rand(-120, 120) / 180 * Math.PI,
    verts, isPowerup, puType, hasUfo
  };
}

function spawnWave() {
  const count = WAVE_BASE + (G.wave - 1) * WAVE_INCREMENT;
  for (let i = 0; i < count; i++) {
    let x, y;
    const ships = G.players.filter(p => p.ship).map(p => p.ship);
    if (ships.length > 0) {
      let attempts = 0;
      do {
        x = rand(0, G.W); y = rand(0, G.H);
        attempts++;
      } while (ships.some(s => dist(x, y, s.x, s.y) < 200) && attempts < 20);
    } else {
      x = rand(0, G.W); y = rand(0, G.H);
    }
    G.asteroids.push(spawnAsteroid(x, y, 'LARGE'));
  }
}
