/* ============================================================
   CONSTANTS
   ============================================================ */
const SHIP_SIZE          = 20;
const SHIP_TURN_SPEED    = 360;
const SHIP_THRUST        = 380;
const SHIP_FRICTION      = 0.005;
const MAX_SPEED          = 420;
const FIRE_RATE          = 0.18;
const RAPID_MAX_LEVEL    = 3;
const BULLET_SPEED       = 550;
const BULLET_LIFE        = 1.8;
const MISSILE_SPEED      = 320;
const MISSILE_TURN_RATE  = 2.6;
const MISSILE_LIFE       = 10;
const MISSILE_RADIUS     = 7;
const MISSILE_HIT_RADIUS = 12;
const SPECIAL_MISSILE_SPEED = 430;
const SPECIAL_MISSILE_RADIUS = 10;
const SPECIAL_MISSILE_LIFE = 4.0;
const SPECIAL_MISSILE_DAMAGE = 250;
const SPECIAL_MISSILE_AOE_RADIUS = 115;
const SPECIAL_MISSILE_FIRE_RATE = 0.4;
const INVULNERABLE_TIME  = 3.0;
const ASTEROID_SPEED_LO  = 40;
const ASTEROID_SPEED_HI  = 120;
const ASTEROID_SPLIT     = 2;
const ASTEROID_AREA_PER_LARGE = 260000;
const ASTEROID_MIN_LARGE = 3;
const ASTEROID_MAX_LARGE = 10;
const ASTEROID_SCORE_STEP = 5000;
const ASTEROID_RESPAWN_INTERVAL = 2.5;
const ASTEROID_SAFE_SPAWN_RADIUS = 220;
const PARTICLE_LIFE      = 0.8;
const SCREEN_SHAKE_DECAY = 6;
const STAR_COUNT         = 80;

const ASTEROID = {
  LARGE:  { radius: 50, points: 20,  speedMult: 1.0 },
  MEDIUM: { radius: 28, points: 50,  speedMult: 1.3 },
  SMALL:  { radius: 14, points: 100, speedMult: 1.6 }
};

const UFO_CHANCE     = 0.15;
const UFO_CHANCE_INCREMENT = 0.04;
const UFO_MAX_CHANCE = 0.70;
const UFO_SCORE_STEP = 2000;
const UFO_BASE_ACTIVE_LIMIT = 1;
const UFO_MAX_ACTIVE_LIMIT = 8;
const UFO_RADIUS     = 25;
const UFO_SPEED      = 80;
const UFO_POINTS     = 300;
const UFO_DODGE_TIME = 5;
const UFO_HITS       = 3;
const UFO_HITS_INCREMENT = 2;
const UFO_MAX_HITS   = 50;
const UFO_FIRE_RATE  = 2.2;
const UFO_FOLLOW_DISTANCE = 220;
const BOSS_UFO_RADIUS = 58;
const BOSS_UFO_SPEED = 70;
const BOSS_UFO_POINTS = 5000;
const BOSS_UFO_MISSILE_TOTAL_SPREAD = 0.68;
const BOSS_UFO_VOLLEY_DURATION = 10.0;
const BOSS_UFO_FIRST_SPAWN_DELAY = 2.0;
const BOSS_UFO_NEXT_SPAWN_DELAY = 6.0;
const BOSS_UFO_MULTI_SPAWN_INTERVAL = 8.0;
const BOSS_UFO_MAX_ACTIVE = 5;
const ROUND_INTERMISSION_TIME = 8.0;
const ROUND_BOSS_HP_SCALE = 0.35;
const ROUND_BOSS_MISSILE_BONUS_EVERY = 2;
const ROUND_BOSS_MAX_MISSILE_BONUS = 4;
const ROUND_BOSS_SPEED_SCALE = 0.10;
const ROUND_BOSS_MAX_SPEED_MULT = 2.0;
const ROUND_ASTEROID_BONUS_EVERY = 2;
const BOSS_UFO_STAGES = [
  { hp: 500, missileCount: 3, points: 5000 },
  { hp: 1000, missileCount: 5, points: 7500 },
  { hp: 2000, missileCount: 8, points: 10000 },
  { hp: 3000, missileCount: 10, points: 12500 },
  { hp: 4500, missileCount: 12, points: 15000 }
];

const BLACK_HOLE_BASE_COUNT = 1;
const BLACK_HOLE_ROUND_STEP = 2;
const BLACK_HOLE_MAX_COUNT = 4;
const BLACK_HOLE_RADIUS = 16;
const BLACK_HOLE_EVENT_RADIUS = 52;
const BLACK_HOLE_GRAVITY_RADIUS = 190;
const BLACK_HOLE_MAX_EVENT_RADIUS = 320;
const BLACK_HOLE_MAX_GRAVITY_RADIUS = 820;
const BLACK_HOLE_SPEED = 24;
const BLACK_HOLE_PULL = 620;
const BLACK_HOLE_BEND = 300;
const BLACK_HOLE_MUTUAL_PULL = 34;
const BLACK_HOLE_MERGE_DISTANCE_MULT = 0.72;
const BLACK_HOLE_MERGE_STRENGTH_GAIN = 0.22;
const BLACK_HOLE_CONSUME_STRENGTH_GAIN = 0.018;
const BLACK_HOLE_PULL_CURVE = 2.4;
const BLACK_HOLE_INNER_PULL_BOOST = 3.4;
const BLACK_HOLE_INNER_PULL_RADIUS_MULT = 2.2;
const BLACK_HOLE_ROUND_STRENGTH = 0.12;

const POWERUP_CHANCE   = 0.30;
const POWERUP_RADIUS   = 12;
const POWERUP_PICKUP_RADIUS_MULT = 5;
const POWERUP_LIFETIME = 30;
const SLOW_TIME_DURATION = 20;
const LASER_MAX_LEVEL = 3;
const LASER_STACK_DURATION = 20;
const MAX_VISIBLE_POWERUPS = 8;

const POWERUPS = {
  RAPID:  { color: '#ff0', label: 'R', desc: 'Rapid Fire' },
  DUAL:   { color: '#4ff', label: 'D', desc: 'Dual Shot' },
  SPREAD: { color: '#f4f', label: 'S', desc: 'Triple Spread' },
  LASER:  { color: '#4f4', label: 'L', desc: 'Laser' },
  MISSILE:{ color: '#f44', label: 'M', desc: 'AOE Missile' },
  SHIELD: { color: '#48f', label: 'O', desc: 'Shield' },
  BIGGER: { color: '#fa0', label: 'X', desc: 'Bigger Bullets' },
  SLOW:   { color: '#8f8', label: 'T', desc: 'Slow Time' },
};
const POWERUP_KEYS = Object.keys(POWERUPS);

const PLAYER_CONFIGS = [
  { id: 1, color: '#4ff', accentColor: '#8ff', label: 'P1', keys: { left: 'KeyA', right: 'KeyD', thrust: 'KeyW', back: 'KeyS', fire: ['Space'] } },
  { id: 2, color: '#f84', accentColor: '#fa8', label: 'P2', keys: { left: 'ArrowLeft', right: 'ArrowRight', thrust: 'ArrowUp', back: 'ArrowDown', fire: ['Enter', 'NumpadEnter', 'Numpad0'] } },
  { id: 3, color: '#9f6', accentColor: '#cf9', label: 'P3', keys: { left: 'KeyJ', right: 'KeyL', thrust: 'KeyI', back: 'KeyK', fire: ['KeyU'] } },
  { id: 4, color: '#c8f', accentColor: '#e8f', label: 'P4', keys: { left: 'KeyF', right: 'KeyH', thrust: 'KeyT', back: 'KeyG', fire: ['KeyY'] } },
];

const SHIP_SKINS = {
  default: { color: null, accent: null },
  red:     { color: '#f44', accent: '#f88' },
  cyan:    { color: '#4ff', accent: '#8ff' },
  gold:    { color: '#fa0', accent: '#fc4' },
  green:   { color: '#4f4', accent: '#8f8' },
  purple:  { color: '#c4f', accent: '#d8f' },
};
