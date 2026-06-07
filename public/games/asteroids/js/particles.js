/* ============================================================
   PARTICLES
   ============================================================ */
const spriteCache = {};

function getSprite(color, size) {
  const key = color + ':' + size;
  if (spriteCache[key]) return spriteCache[key];
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const half = size / 2;
  const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.15, color);
  const rgb = hexToRgb(color);
  grad.addColorStop(0.5, `rgba(${rgb},0.5)`);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  spriteCache[key] = c;
  return c;
}

function hexToRgb(hex) {
  if (!hex || hex.length < 7) return '255,255,255';
  return (parseInt(hex.slice(1,3),16) || 255) + ',' +
         (parseInt(hex.slice(3,5),16) || 255) + ',' +
         (parseInt(hex.slice(5,7),16) || 255);
}

// Pre-warm sprite cache with common colors and sizes on init
function prewarmSprites() {
  const colors = ['#ff0', '#f84', '#4ff', '#f44', '#4f4', '#f4f', '#fff', '#48f', '#8cf', '#0ff'];
  const sizes = [8, 16, 24, 32, 48, 64];
  for (const c of colors) {
    for (const s of sizes) {
      getSprite(c, s);
    }
  }
}

const PT = { GLOW: 0, SPARK: 1, RING: 2, DEBRIS: 3, SMOKE: 4, THRUST: 5 };

function spawnParticles(x, y, count, color, speed, life) {
  for (let i = 0; i < count; i++) {
    const angle = rand(0, Math.PI * 2);
    const spd = rand(speed * 0.3, speed);
    G.particles.push({
      x, y, vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd,
      life: life || PARTICLE_LIFE, maxLife: life || PARTICLE_LIFE,
      color: color || '#fff', size: rand(1, 3), type: PT.GLOW
    });
  }
}

function spawnExplosion(x, y, color, big) {
  const s = big ? 1.5 : 1;
  spawnParticles(x, y, 12 * s | 0, color, 180 * s, 0.6);
  for (let i = 0; i < 8 * s | 0; i++) {
    const angle = rand(0, Math.PI * 2);
    const spd = rand(100, 300) * s;
    G.particles.push({
      x, y, vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd,
      life: 0.3, maxLife: 0.3, color: '#fff', size: rand(6, 12),
      type: PT.SPARK, rot: rand(0, 6.28), rotSpeed: rand(-10, 10)
    });
  }
  G.particles.push({ x, y, vx: 0, vy: 0, life: 0.5, maxLife: 0.5, color, size: big ? 80 : 50, type: PT.RING });
  for (let i = 0; i < 5; i++) {
    const angle = rand(0, Math.PI * 2);
    const spd = rand(40, 150) * s;
    G.particles.push({
      x, y, vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd,
      life: 1.0, maxLife: 1.0, color, size: rand(16, 32),
      type: PT.DEBRIS, rot: rand(0, 6.28), rotSpeed: rand(-8, 8), gravity: 60 * s
    });
  }
}

function spawnUfoExplosion(x, y) {
  spawnExplosion(x, y, '#8cf', true);
  for (let i = 0; i < 6; i++) {
    const angle = rand(0, Math.PI * 2);
    G.particles.push({
      x, y, vx: Math.cos(angle) * 250, vy: Math.sin(angle) * 250,
      life: 0.4, maxLife: 0.4, color: '#0ff', size: rand(24, 40),
      type: PT.SPARK, rot: 0, rotSpeed: rand(-15, 15)
    });
  }
  for (let i = 0; i < 2; i++) {
    G.particles.push({
      x, y, vx: 0, vy: 0,
      life: 0.7 + i * 0.15, maxLife: 0.7 + i * 0.15,
      color: '#0ff', size: 40 + i * 30, type: PT.RING
    });
  }
}

function spawnShieldHit(x, y) {
  for (let i = 0; i < 16; i++) {
    const angle = (i / 16) * Math.PI * 2;
    const spd = rand(150, 350);
    G.particles.push({
      x, y, vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd,
      life: 0.5, maxLife: 0.5, color: '#48f', size: rand(8, 16), type: PT.SPARK
    });
  }
  G.particles.push({ x, y, vx: 0, vy: 0, life: 0.6, maxLife: 0.6, color: '#48f', size: 70, type: PT.RING });
}

function spawnPickupEffect(x, y, color) {
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const spd = 80 + i * 10;
    G.particles.push({
      x, y, vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd,
      life: 0.6, maxLife: 0.6, color, size: rand(12, 24), type: PT.GLOW
    });
  }
  G.particles.push({ x, y, vx: 0, vy: 0, life: 0.4, maxLife: 0.4, color, size: 50, type: PT.RING });
}

function spawnThrustTrail(x, y, angle) {
  const spd = rand(70, 135);
  const side = rand(-2.2, 2.2);
  const back = rand(3, 12);
  const px = x - Math.cos(angle) * back - Math.sin(angle) * side;
  const py = y - Math.sin(angle) * back + Math.cos(angle) * side;
  G.particles.push({
    x: px, y: py,
    vx: -Math.cos(angle) * spd + rand(-8, 8),
    vy: -Math.sin(angle) * spd + rand(-8, 8),
    life: 0.16, maxLife: 0.16,
    color: rand() > 0.5 ? '#f84' : '#ff0',
    size: rand(7, 12),
    type: PT.THRUST,
    rot: angle + rand(-0.08, 0.08)
  });
}
