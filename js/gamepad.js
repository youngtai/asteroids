/* ============================================================
   GAMEPAD — Bluetooth controller support
   ============================================================

   Standard Xbox mapping:
     0=A, 1=B, 2=X, 3=Y, 4=LB, 5=RB, 6=LT, 7=RT
     9=Start, 10=Back

   Moga controllers remap to:
     0=A, 1=B, 3=X, 4=Y, 7=LT, 9=RT, 11=Start

   PlayStation mapping:
     0=Cross, 1=Circle, 2=Square, 3=Triangle, 4=L1, 5=R1
     6=L2, 7=R2, 9=Options, 10=Share

   ============================================================ */
const GP_DEADZONE = 0.2;

function pollGamepads() {
  const list = navigator.getGamepads ? navigator.getGamepads() : [];
  G._gamepads = [];
  G._gp1 = null; G._gp2 = null;
  for (let i = 0; i < list.length; i++) {
    const gp = list[i];
    if (!gp || !gp.connected) continue;
    G._gamepads.push(gp);
    if (!G._gp1) G._gp1 = gp;
    else if (!G._gp2) G._gp2 = gp;
  }
}

// Detect controller type from id string
function gpType(gp) {
  const id = gp.id.toLowerCase();
  if (id.includes('moga')) return 'moga';
  if (id.includes('ps4') || id.includes('ps5')) return 'ps';
  return 'xbox'; // default: Xbox/standard
}

// Apply gamepad input to a player's keys + target angle.
// Returns true if Start button pressed (for menu actions).
function applyGamepadToPlayer(player) {
  const gp = G._gamepads ? G._gamepads[player.id - 1] : null;
  if (!gp) return false;

  const axes = gp.axes;
  const btns = gp.buttons;
  const type = gpType(gp);

  // --- Steering: left stick angle → target ship rotation ---
  const lx = axes[0], ly = axes[1];
  const stickMag = Math.hypot(lx, ly);
  if (stickMag > GP_DEADZONE) {
    player.targetAngle = Math.atan2(ly, lx);
    player.targetAngleSet = true;
  } else {
    player.targetAngleSet = false;
  }

  // --- Thrust: B / Circle (1) ---
  player.gpThrust = !!btns[1]?.pressed;

  // --- Fire: A/Cross (0) OR right trigger OR shoulder buttons ---
  // On Moga: RT is button 9 (not 7), LT is button 7
  // On Xbox: LT is button 6, RT is button 7
  // On PS: L2 is button 6, R2 is button 7
  const fireTriggerBtns = type === 'moga' ? [9] : [7];
  const specialTriggerBtn = type === 'moga' ? 7 : 6;
  const shoulderBtns = type === 'moga' ? [5] : [4, 5];
  player.gpFire = !!(btns[0]?.pressed ||
    shoulderBtns.some(b => btns[b]?.pressed) ||
    fireTriggerBtns.some(b => btns[b]?.value > 0.1 || btns[b]?.pressed));

  const specialDown = !!(btns[specialTriggerBtn]?.value > 0.35 || btns[specialTriggerBtn]?.pressed);
  player.gpSpecial = specialDown && !player._gpSpecialDown;
  player._gpSpecialDown = specialDown;

  // --- D-pad → keyboard fallback ---
  player.gpUp = !!btns[12]?.pressed;
  player.gpLeft = !!btns[14]?.pressed;
  player.gpRight = !!btns[15]?.pressed;

  // --- Start → menu action ---
  // Standard Xbox: button 9
  // PS4/PS5: button 11
  // Moga: button 11
  const startBtns = type === 'moga' || type === 'ps' ? [11] : [9, 11];
  return startBtns.some(b => btns[b]?.pressed);
}

// Check Start button on a gamepad object (for game loop menu handling)
function applyGamepadToPlayerStartOnly(gp) {
  const type = gpType(gp);
  const btns = gp.buttons;
  const startBtns = type === 'moga' || type === 'ps' ? [11] : [9, 11];
  return startBtns.some(b => btns[b]?.pressed);
}

// Rumble feedback
function rumble(player, strong, weak, durationMs) {
  const gp = G._gamepads ? G._gamepads[player.id - 1] : null;
  if (gp?.hapticActuators?.[0]) {
    try { gp.hapticActuators[0].pulse(Math.max(strong, weak), durationMs / 1000); } catch(e) {}
  }
}

// Short controller name for display
function gpDisplayName(gp) {
  if (!gp) return '';
  const id = gp.id || 'Controller';
  if (id.includes('XInput')) return 'Xbox';
  if (id.includes('PS4') || id.includes('PS5')) return 'PlayStation';
  if (id.includes('moga') || id.includes('Moga')) return 'Moga';
  return id.length > 24 ? id.slice(0, 22) + '...' : id;
}
