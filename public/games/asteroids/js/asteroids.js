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

function targetLargeAsteroids() {
  const areaTarget = Math.floor((G.W * G.H) / ASTEROID_AREA_PER_LARGE);
  const scoreBonus = Math.floor(totalPlayerScore() / ASTEROID_SCORE_STEP);
  const roundBonus = Math.floor(roundDifficultyTier() / ROUND_ASTEROID_BONUS_EVERY);
  return Math.max(
    ASTEROID_MIN_LARGE,
    Math.min(ASTEROID_MAX_LARGE, areaTarget + scoreBonus + roundBonus)
  );
}

function currentLargeAsteroids() {
  return G.asteroids.filter(a => a.sizeKey === 'LARGE').length;
}

function randomAsteroidSpawnPoint() {
  let x = 0, y = 0;
  const ships = G.players.filter(p => p.ship).map(p => p.ship);
  let attempts = 0;
  do {
    const side = randInt(0, 3);
    const margin = ASTEROID.LARGE.radius + 12;
    if (side === 0) {
      x = rand(0, G.W);
      y = -margin;
    } else if (side === 1) {
      x = G.W + margin;
      y = rand(0, G.H);
    } else if (side === 2) {
      x = rand(0, G.W);
      y = G.H + margin;
    } else {
      x = -margin;
      y = rand(0, G.H);
    }
    attempts++;
  } while (ships.some(s => dist(x, y, s.x, s.y) < ASTEROID_SAFE_SPAWN_RADIUS) && attempts < 30);
  return { x, y };
}

function aimAsteroidInward(a) {
  const targetX = G.W / 2 + rand(-G.W * 0.25, G.W * 0.25);
  const targetY = G.H / 2 + rand(-G.H * 0.25, G.H * 0.25);
  const angle = Math.atan2(targetY - a.y, targetX - a.x) + rand(-0.35, 0.35);
  const speed = Math.hypot(a.vx, a.vy) || rand(ASTEROID_SPEED_LO, ASTEROID_SPEED_HI);
  a.vx = Math.cos(angle) * speed;
  a.vy = Math.sin(angle) * speed;
}

function spawnLargeAsteroid() {
  const p = randomAsteroidSpawnPoint();
  const a = spawnAsteroid(p.x, p.y, 'LARGE');
  aimAsteroidInward(a);
  G.asteroids.push(a);
}

function fillInitialAsteroidField() {
  const count = targetLargeAsteroids();
  for (let i = 0; i < count; i++) spawnLargeAsteroid();
  G.nextAsteroidSpawn = G.now + ASTEROID_RESPAWN_INTERVAL;
}

function maybeSpawnAsteroids() {
  const target = targetLargeAsteroids();
  G.level = Math.max(1, 1 + Math.floor(totalPlayerScore() / ASTEROID_SCORE_STEP));
  if (!G.nextAsteroidSpawn) G.nextAsteroidSpawn = G.now + ASTEROID_RESPAWN_INTERVAL;
  if (currentLargeAsteroids() >= target || G.now < G.nextAsteroidSpawn) return;

  spawnLargeAsteroid();
  G.nextAsteroidSpawn = G.now + ASTEROID_RESPAWN_INTERVAL;
}
