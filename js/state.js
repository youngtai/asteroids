/* ============================================================
   GAME STATE
   ============================================================ */
const G = {
  canvas: null, ctx: null, W: 0, H: 0,
  state: 'start',
  wave: 1,
  selectedPlayers: 2,
  bullets: [], missiles: [], asteroids: [], particles: [], powerups: [], ufos: [],
  stars: [],
  dt: 0, now: 0,
  shakeX: 0, shakeY: 0, shakeMag: 0,
  players: [],
};

function createPlayer(id, color, accentColor) {
  return {
    id, color, accentColor,
    ship: null,
    lives: 5,
    score: 0,
    keys: {},
    lastFire: 0,
    weaponModes: [],
    hasRapid: false,
    hasLaser: false,
    hasShield: false,
    shieldHits: 0,
    shipSkin: 'default',
    hasBigger: false,
    hasSlow: false,
    alive: true,
  };
}
