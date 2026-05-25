function updateBullets(dt) {
  for (let i = G.bullets.length - 1; i >= 0; i--) {
    const b = G.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    const offscreen = b.x < -b.r || b.x > G.W + b.r || b.y < -b.r || b.y > G.H + b.r;
    if (b.life <= 0 || offscreen) G.bullets.splice(i, 1);
  }
}
