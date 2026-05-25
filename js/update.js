function updateParticles(dt) {
  for (let i = G.particles.length - 1; i >= 0; i--) {
    const p = G.particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.gravity) p.vy += p.gravity * dt;
    if (p.rot !== undefined) p.rot += (p.rotSpeed || 0) * dt;
    p.life -= dt;
    if (p.life <= 0) G.particles.splice(i, 1);
  }
}

function updateAsteroids(dt) {
  const slowMult = anyPlayerHasSlow() ? 0.4 : 1;
  for (const a of G.asteroids) {
    a.x += a.vx * dt * slowMult;
    a.y += a.vy * dt * slowMult;
    a.rot += a.rotSpeed * dt * slowMult;
    wrap(a);
  }
}

function updatePowerups(dt) {
  for (let i = G.powerups.length - 1; i >= 0; i--) {
    const pu = G.powerups[i];
    pu.y += pu.vy * dt;
    pu.life -= dt;
    pu.pulse += dt * 4;
    wrap(pu);

    // Check pickup against all alive player ships
    let picked = false;
    for (const player of G.players) {
      if (player.alive && player.ship) {
        if (dist(player.ship.x, player.ship.y, pu.x, pu.y) < SHIP_SIZE + POWERUP_RADIUS) {
          applyPowerup(pu.type, player);
          spawnPickupEffect(pu.x, pu.y, POWERUPS[pu.type].color);
          G.powerups.splice(i, 1);
          picked = true;
          break;
        }
      }
    }
    if (picked) continue;
    if (pu.life <= 0) G.powerups.splice(i, 1);
  }
}
