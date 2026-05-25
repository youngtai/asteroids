/* ============================================================
   COLLISIONS
   ============================================================ */
function checkCollisions() {
  function destroyAsteroid(a, ai, owner) {
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

  // Bullet vs asteroid - credit score to bullet owner
  for (let bi = G.bullets.length - 1; bi >= 0; bi--) {
    for (let ai = G.asteroids.length - 1; ai >= 0; ai--) {
      const b = G.bullets[bi];
      const a = G.asteroids[ai];
      if (!b || !a) continue;
      if (dist(b.x, b.y, a.x, a.y) < a.r + (b.laser ? 5 : 3)) {
        const owner = G.players.find(p => p.id === (b.owner || 1));
        destroyAsteroid(a, ai, owner);
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
      if (dist(b.x, b.y, uf.x, uf.y) < uf.r + (b.laser ? 5 : 3)) {
        const owner = G.players.find(p => p.id === (b.owner || 1));
        uf.hp--;
        spawnParticles(b.x, b.y, 8, owner ? owner.color : '#fff', 160, 0.35);
        G.shakeMag = Math.min(G.shakeMag + 8, 12);
        playSound(uf.hp <= 0 ? 'explode' : 'hit');
        if (uf.hp <= 0) {
          if (owner) owner.score += uf.points;
          spawnUfoExplosion(uf.x, uf.y);
          G.ufos.splice(ui, 1);
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
      if (dist(b.x, b.y, m.x, m.y) < m.r + (b.laser ? 5 : 3)) {
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

  // UFO missile vs asteroid - missiles persist after the impact
  for (let mi = G.missiles.length - 1; mi >= 0; mi--) {
    for (let ai = G.asteroids.length - 1; ai >= 0; ai--) {
      const m = G.missiles[mi];
      const a = G.asteroids[ai];
      if (!m || !a) continue;
      if (wrapDist(m.x, m.y, a.x, a.y) < a.r + m.r) {
        destroyAsteroid(a, ai, null);
        spawnExplosion(m.x, m.y, '#f84', false);
        playSound('hit');
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
        if (player.lives > 0) player.lives--;
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
        if (player.lives > 0) player.lives--;
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
        if (player.lives > 0) player.lives--;
        spawnExplosion(s.x, s.y, '#f44', true);
        G.shakeMag = 15;
        rumble(player, 0.5, 0.8, 100);
        player.ship = null;
        player.alive = false;
        break;
      }
    }
  }

  // Respawn players who still have lives
  for (const player of G.players) {
    if (!player.alive && player.lives > 0) {
      respawnShip(player);
    }
  }

  // Check game over: both players dead
  const allOut = G.players.every(p => !p.alive && p.lives <= 0);
  if (allOut && G.state === 'playing') {
    G.state = 'gameover';
    const totalScore = G.players.reduce((sum, p) => sum + p.score, 0);
    document.getElementById('final-player-scores').textContent =
      G.players.map(p => `P${p.id}: ${p.score}`).join('  |  ');
    document.getElementById('final-score').textContent = totalScore;
    document.getElementById('gameover-overlay').classList.remove('hidden');
    updateHUD();
    return;
  }

  // Check wave clear
  if (G.asteroids.length === 0 && G.ufos.length === 0 && G.state === 'playing') {
    G.wave++;
    spawnWave();
  }
}
