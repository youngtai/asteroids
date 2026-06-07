/* ============================================================
   COLLISIONS
   ============================================================ */
function missileShotRadius(m) {
  return m.hitR || m.r || MISSILE_RADIUS;
}

function destroyAsteroid(a, owner) {
  const ai = G.asteroids.indexOf(a);
  if (ai === -1) return;

  if (owner) owner.score += a.points;
  const hitColor = a.isPowerup ? POWERUPS[a.puType].color : '#aaa';
  spawnExplosion(a.x, a.y, hitColor, a.sizeKey === 'LARGE');
  G.shakeMag = Math.min(G.shakeMag + a.r * 0.15, 12);
  if (a.isPowerup && a.puType) spawnPowerup(a.x, a.y, a.puType);
  if (a.hasUfo) spawnUfo(a.x, a.y);
  const nextSize = a.sizeKey === 'LARGE' ? 'MEDIUM' : a.sizeKey === 'MEDIUM' ? 'SMALL' : null;
  if (nextSize) {
    for (let k = 0; k < ASTEROID_SPLIT; k++) {
      const child = spawnAsteroid(a.x, a.y, nextSize);
      child.vx += a.vx * 0.3;
      child.vy += a.vy * 0.3;
      G.asteroids.push(child);
    }
  }
  G.asteroids.splice(ai, 1);
}

function explodePlayerMissile(m) {
  const mi = G.playerMissiles.indexOf(m);
  if (mi !== -1) G.playerMissiles.splice(mi, 1);

  const owner = G.players.find(p => p.id === (m.owner || 1));
  spawnExplosion(m.x, m.y, m.color || '#f44', true);
  G.particles.push({ x: m.x, y: m.y, vx: 0, vy: 0, life: 0.45, maxLife: 0.45, color: '#f44', size: SPECIAL_MISSILE_AOE_RADIUS, type: PT.RING });
  G.shakeMag = Math.min(G.shakeMag + 18, 22);
  playSound('explode');

  for (let ai = G.asteroids.length - 1; ai >= 0; ai--) {
    const a = G.asteroids[ai];
    if (dist(m.x, m.y, a.x, a.y) <= SPECIAL_MISSILE_AOE_RADIUS + a.r) {
      destroyAsteroid(a, owner);
    }
  }

  for (let ui = G.ufos.length - 1; ui >= 0; ui--) {
    const uf = G.ufos[ui];
    if (dist(m.x, m.y, uf.x, uf.y) <= SPECIAL_MISSILE_AOE_RADIUS + uf.r) {
      uf.hp -= SPECIAL_MISSILE_DAMAGE;
      if (uf.hp <= 0) {
        destroyUfo(uf, owner, ui);
      }
    }
  }

  for (let emi = G.missiles.length - 1; emi >= 0; emi--) {
    const enemy = G.missiles[emi];
    if (dist(m.x, m.y, enemy.x, enemy.y) <= SPECIAL_MISSILE_AOE_RADIUS + missileShotRadius(enemy)) {
      spawnExplosion(enemy.x, enemy.y, '#f84', false);
      G.missiles.splice(emi, 1);
    }
  }

  for (const player of G.players) {
    if (!player.alive || !player.ship || player.id === (m.owner || 1)) continue;
    damagePlayerWithRocket(player, m, SPECIAL_MISSILE_AOE_RADIUS);
  }
}

function damagePlayerWithRocket(player, m, blastRadius) {
  const s = player.ship;
  if (!s || G.now < s.invulnEnd) return false;
  if (dist(m.x, m.y, s.x, s.y) > blastRadius + SHIP_SIZE * 0.65) return false;

  if (player.hasShield && player.shieldHits > 0) {
    player.shieldHits--;
    spawnShieldHit(s.x, s.y);
    spawnExplosion(m.x, m.y, m.color || '#f44', false);
    G.shakeMag = Math.min(G.shakeMag + 8, 14);
    if (player.shieldHits <= 0) {
      player.hasShield = false;
      player.shipSkin = 'default';
    }
    return true;
  }

  playSound('shipHit');
  player.deaths++;
  spawnExplosion(s.x, s.y, m.color || '#f44', true);
  G.shakeMag = Math.min(G.shakeMag + 16, 24);
  rumble(player, 0.5, 0.8, 100);
  player.ship = null;
  player.alive = false;
  return true;
}

function checkCollisions() {

  // Bullet vs asteroid - credit score to bullet owner
  for (let bi = G.bullets.length - 1; bi >= 0; bi--) {
    for (let ai = G.asteroids.length - 1; ai >= 0; ai--) {
      const b = G.bullets[bi];
      const a = G.asteroids[ai];
      if (!b || !a) continue;
      if (wrapDist(b.x, b.y, a.x, a.y) < a.r + b.r) {
        const owner = G.players.find(p => p.id === (b.owner || 1));
        destroyAsteroid(a, owner);
        if (!b.laser) G.bullets.splice(bi, 1);
        playSound('hit');
        break;
      }
    }
  }

  // Bullet vs UFO
  for (let bi = G.bullets.length - 1; bi >= 0; bi--) {
    for (let ui = G.ufos.length - 1; ui >= 0; ui--) {
      const b = G.bullets[bi];
      const uf = G.ufos[ui];
      if (!b || !uf) continue;
      if (wrapDist(b.x, b.y, uf.x, uf.y) < uf.r + b.r) {
        const owner = G.players.find(p => p.id === (b.owner || 1));
        uf.hp -= b.damage || 1;
        spawnParticles(b.x, b.y, 8, owner ? owner.color : '#fff', 160, 0.35);
        G.shakeMag = Math.min(G.shakeMag + 8, 12);
        playSound(uf.hp <= 0 ? 'explode' : 'hit');
        if (uf.hp <= 0) {
          destroyUfo(uf, owner, ui);
        }
        if (!b.laser) G.bullets.splice(bi, 1);
        break;
      }
    }
  }

  // Player bullet vs UFO missile
  for (let bi = G.bullets.length - 1; bi >= 0; bi--) {
    for (let mi = G.missiles.length - 1; mi >= 0; mi--) {
      const b = G.bullets[bi];
      const m = G.missiles[mi];
      if (!b || !m) continue;
      if (wrapDist(b.x, b.y, m.x, m.y) < missileShotRadius(m) + b.r) {
        const owner = G.players.find(p => p.id === (b.owner || 1));
        if (owner) owner.score += 25;
        spawnExplosion(m.x, m.y, '#f84', false);
        G.shakeMag = Math.min(G.shakeMag + 4, 10);
        playSound('hit');
        G.missiles.splice(mi, 1);
        if (!b.laser) G.bullets.splice(bi, 1);
        break;
      }
    }
  }

  // UFO missile vs asteroid - both are destroyed on impact
  for (let mi = G.missiles.length - 1; mi >= 0; mi--) {
    for (let ai = G.asteroids.length - 1; ai >= 0; ai--) {
      const m = G.missiles[mi];
      const a = G.asteroids[ai];
      if (!m || !a) continue;
      if (dist(m.x, m.y, a.x, a.y) < a.r + m.r) {
        destroyAsteroid(a, null);
        spawnExplosion(m.x, m.y, '#f84', false);
        G.shakeMag = Math.min(G.shakeMag + 4, 10);
        playSound('hit');
        G.missiles.splice(mi, 1);
        break;
      }
    }
  }

  // Player special missile direct impacts
  for (let pi = G.playerMissiles.length - 1; pi >= 0; pi--) {
    const pm = G.playerMissiles[pi];
    if (!pm) continue;

    let exploded = false;
    for (const a of G.asteroids) {
      if (dist(pm.x, pm.y, a.x, a.y) < a.r + pm.r) {
        explodePlayerMissile(pm);
        exploded = true;
        break;
      }
    }
    if (exploded) continue;

    for (const uf of G.ufos) {
      if (dist(pm.x, pm.y, uf.x, uf.y) < uf.r + pm.r) {
        explodePlayerMissile(pm);
        exploded = true;
        break;
      }
    }
    if (exploded) continue;

    for (const player of G.players) {
      if (!player.alive || !player.ship || player.id === (pm.owner || 1)) continue;
      if (dist(pm.x, pm.y, player.ship.x, player.ship.y) < SHIP_SIZE * 0.65 + pm.r) {
        explodePlayerMissile(pm);
        exploded = true;
        break;
      }
    }
    if (exploded) continue;

    for (const enemy of G.missiles) {
      if (dist(pm.x, pm.y, enemy.x, enemy.y) < missileShotRadius(enemy) + pm.r) {
        explodePlayerMissile(pm);
        break;
      }
    }
  }

  // Ship vs asteroid - per player
  for (const player of G.players) {
    if (!player.alive || !player.ship) continue;
    const s = player.ship;
    // Check invulnerability
    if (G.now < s.invulnEnd) continue;

    for (const a of G.asteroids) {
      if (wrapDist(s.x, s.y, a.x, a.y) < a.r + SHIP_SIZE * 0.7) {
        if (player.hasShield && player.shieldHits > 0) {
          player.shieldHits--;
          spawnShieldHit(s.x, s.y);
          G.shakeMag = 8;
          const dx = a.x - s.x;
          const dy = a.y - s.y;
          const d = Math.hypot(dx, dy) || 1;
          a.vx += (dx / d) * 300;
          a.vy += (dy / d) * 300;
          if (player.shieldHits <= 0) {
            player.hasShield = false;
            player.shipSkin = 'default';
          }
          break;
        }
        playSound('shipHit');
        player.deaths++;
        spawnExplosion(s.x, s.y, '#f44', true);
        G.shakeMag = 15;
        rumble(player, 0.5, 0.8, 100); // rumble on ship death
        player.ship = null;
        player.alive = false; // respawn logic below will handle it
        break;
      }
    }
  }

  // Ship vs UFO - per player
  for (const player of G.players) {
    if (!player.alive || !player.ship) continue;
    const s = player.ship;
    if (G.now < s.invulnEnd) continue;

    for (const uf of G.ufos) {
      if (wrapDist(s.x, s.y, uf.x, uf.y) < uf.r + SHIP_SIZE * 0.7) {
        if (player.hasShield && player.shieldHits > 0) {
          player.shieldHits--;
          spawnShieldHit(s.x, s.y);
          G.shakeMag = 8;
          if (player.shieldHits <= 0) {
            player.hasShield = false;
            player.shipSkin = 'default';
          }
          break;
        }
        playSound('shipHit');
        player.deaths++;
        spawnExplosion(s.x, s.y, '#f44', true);
        G.shakeMag = 15;
        rumble(player, 0.5, 0.8, 100); // rumble on ship death
        player.ship = null;
        player.alive = false; // respawn logic below will handle it
        break;
      }
    }
  }

  // Ship vs UFO missile - per player
  for (const player of G.players) {
    if (!player.alive || !player.ship) continue;
    const s = player.ship;
    if (G.now < s.invulnEnd) continue;

    for (let mi = G.missiles.length - 1; mi >= 0; mi--) {
      const m = G.missiles[mi];
      if (wrapDist(s.x, s.y, m.x, m.y) < m.r + SHIP_SIZE * 0.65) {
        G.missiles.splice(mi, 1);
        if (player.hasShield && player.shieldHits > 0) {
          player.shieldHits--;
          spawnShieldHit(s.x, s.y);
          spawnExplosion(m.x, m.y, '#f84', false);
          G.shakeMag = 8;
          if (player.shieldHits <= 0) {
            player.hasShield = false;
            player.shipSkin = 'default';
          }
          break;
        }
        playSound('shipHit');
        player.deaths++;
        spawnExplosion(s.x, s.y, '#f44', true);
        G.shakeMag = 15;
        rumble(player, 0.5, 0.8, 100);
        player.ship = null;
        player.alive = false;
        break;
      }
    }
  }

  // Respawn players indefinitely.
  for (const player of G.players) {
    if (!player.alive) {
      respawnShip(player);
    }
  }

}
