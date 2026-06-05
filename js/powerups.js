/* ============================================================
   POWER-UPS
   ============================================================ */
function spawnPowerup(x, y, type) {
  if (G.powerups.length >= MAX_VISIBLE_POWERUPS) return false;

  G.powerups.push({
    x, y, type, vx: 0, vy: -30, life: POWERUP_LIFETIME, pulse: 0, r: POWERUP_RADIUS
  });
  return true;
}

function applyPowerup(type, player) {
  const s = player.ship;
  if (!s) return;
  const has = (arr, v) => arr.indexOf(v) !== -1;
  playSound('pickup');

  switch (type) {
    case 'RAPID':
      player.hasRapid = true;
      player.rapidLevel = Math.min(RAPID_MAX_LEVEL, (player.rapidLevel || 0) + 1);
      break;
    case 'DUAL':
      if (!has(player.weaponModes, 'dual')) player.weaponModes.push('dual');
      break;
    case 'SPREAD':
      if (!has(player.weaponModes, 'spread')) player.weaponModes.push('spread');
      break;
    case 'LASER':
      if (player.hasLaser) {
        const activeStacks = G.now < player.laserBoostEnd ? player.laserBoostStacks : 0;
        player.laserBoostStacks = Math.min(LASER_MAX_LEVEL - 1, activeStacks + 1);
        player.laserBoostEnd = G.now + LASER_STACK_DURATION;
      }
      player.hasLaser = true;
      break;
    case 'MISSILE':
      player.specialMissiles++;
      break;
    case 'SHIELD':
      player.hasShield = true;
      player.shieldHits++;
      const skinKeys = Object.keys(SHIP_SKINS).filter(k => k !== 'default');
      player.shipSkin = skinKeys[randInt(0, skinKeys.length - 1)];
      break;
    case 'BIGGER':
      player.hasBigger = true;
      break;
    case 'SLOW':
      player.hasSlow = true;
      player.slowEnd = G.now + SLOW_TIME_DURATION;
      break;
  }
  player.score += 25;
}
