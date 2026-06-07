/* ============================================================
   HELPERS
   ============================================================ */
function rand(a, b) { return a + Math.random() * (b - a); }
function randInt(a, b) { return Math.floor(rand(a, b + 1)); }
function dist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); }

function wrapDist(x1, y1, x2, y2) {
  let dx = Math.abs(x2 - x1);
  let dy = Math.abs(y2 - y1);
  if (dx > G.W / 2) dx = G.W - dx;
  if (dy > G.H / 2) dy = G.H - dy;
  return Math.hypot(dx, dy);
}

function wrap(obj) {
  if (obj.x < -obj.r) obj.x += G.W + obj.r * 2;
  if (obj.x > G.W + obj.r) obj.x -= G.W + obj.r * 2;
  if (obj.y < -obj.r) obj.y += G.H + obj.r * 2;
  if (obj.y > G.H + obj.r) obj.y -= G.H + obj.r * 2;
}

function hasActiveSlow(player) {
  return player.hasSlow && G.now < player.slowEnd;
}

function anyPlayerHasSlow() {
  return G.players.some(p => p.alive && hasActiveSlow(p));
}

function activeLaserLevel(player) {
  if (!player.hasLaser) return 0;
  const boostStacks = G.now < player.laserBoostEnd ? player.laserBoostStacks : 0;
  return Math.min(LASER_MAX_LEVEL, 1 + boostStacks);
}

function totalPlayerScore() {
  return G.players.reduce((sum, p) => sum + p.score, 0);
}

function roundDifficultyTier() {
  return Math.max(0, (G.round || 1) - 1);
}

function scoreDifficultyTier() {
  return Math.floor(totalPlayerScore() / UFO_SCORE_STEP);
}

function currentUfoChance() {
  return Math.min(UFO_MAX_CHANCE, UFO_CHANCE + scoreDifficultyTier() * UFO_CHANCE_INCREMENT);
}

function maxActiveUfos() {
  return Math.min(UFO_MAX_ACTIVE_LIMIT, UFO_BASE_ACTIVE_LIMIT + scoreDifficultyTier());
}

function currentUfoHits() {
  return Math.min(UFO_MAX_HITS, UFO_HITS + scoreDifficultyTier() * UFO_HITS_INCREMENT);
}

function visiblePowerupCount() {
  const carried = G.asteroids.filter(a => a.isPowerup && a.puType).length;
  return G.powerups.length + carried;
}

function closestAliveShip(x, y) {
  const p = closestAlivePlayer(x, y);
  return p ? p.ship : null;
}

function closestAlivePlayer(x, y) {
  let best = null, bestD = Infinity;
  for (const p of G.players) {
    if (p.alive && p.ship) {
      const d = wrapDist(x, y, p.ship.x, p.ship.y);
      if (d < bestD) { bestD = d; best = p; }
    }
  }
  return best;
}

/* ============================================================
   STAR BACKGROUND (pre-rendered to offscreen canvas)
   ============================================================ */
let starCanvas = null;

function initStars() {
  G.stars = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    G.stars.push({
      x: rand(0, G.W), y: rand(0, G.H),
      brightness: rand(0.2, 0.7)
    });
  }
  renderStarField();
}

function renderStarField() {
  starCanvas = document.createElement('canvas');
  starCanvas.width = G.W;
  starCanvas.height = G.H;
  const ctx = starCanvas.getContext('2d');
  ctx.clearRect(0, 0, G.W, G.H);
  for (const s of G.stars) {
    ctx.fillStyle = `rgba(255,255,255,${s.brightness})`;
    ctx.fillRect(s.x, s.y, 1.5, 1.5);
  }
}
