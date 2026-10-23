// Motion core — platform-independent simulation + pseudo-3D projection.
// Every function is a Reanimated worklet ('worklet' is a harmless no-op string on the web),
// so React Native runs this exact file on the UI thread. Kotlin mirrors it 1:1 (MotionCore.kt).

export type Dir = 'center' | 'up' | 'down' | 'left' | 'right' | 'upLeft' | 'upRight' | 'downLeft' | 'downRight';
export const DIRECTIONS: Record<Dir, [number, number]> = {
  center: [0, 0], up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0],
  upLeft: [-0.75, -0.75], upRight: [0.75, -0.75], downLeft: [-0.75, 0.75], downRight: [0.75, 0.75],
};
export interface ExprData { id: string; label: string; eyes: number[][][] }
export interface Sp { x: number; v: number }
export interface MotionCoreState {
  ids: string[]; shapes: number[][]; // shapes[k] = flat [eye0 xy..., eye1 xy...]
  n: number; expr: number; pending: number; pendingAt: number;
  P: number[]; V: number[];
  yaw: Sp; pitch: Sp; roll: Sp; ex: Sp; ey: Sp; lid: Sp; squash: Sp; squeeze: Sp;
  tYaw: number; tPitch: number; tRoll: number; tEx: number; tEy: number;
  look: number[]; manual: boolean; drag: boolean; dragYaw: number; dragPitch: number;
  time: number; idle: boolean; reduced: boolean; stiffness: number; damping: number;
  blinks: number[]; lidHold: number; lidHoldUntil: number;
  nextBlink: number; nextBehavior: number; behaviorUntil: number; behavior: number;
  glance: number[]; tilt: number; stretch: number; sacc: number[]; nextSacc: number;
  changed: number; // incremented on expression change (for listeners)
}
export const DEG = Math.PI / 180;
export const MAX_YAW = 40 * DEG, MAX_PITCH = 28 * DEG;

export function sp(x = 0): Sp { 'worklet'; return { x, v: 0 }; }
export function spStep(s: Sp, t: number, k: number, c: number, h: number) { 'worklet'; s.v += (-k * (s.x - t) - c * s.v) * h; s.x += s.v * h; }

export function createCore(exprs: ExprData[], initial: string, opts: { idle?: boolean; reduced?: boolean; stiffness?: number; damping?: number } = {}): MotionCoreState {
  'worklet';
  const ids: string[] = [], shapes: number[][] = [];
  for (let k = 0; k < exprs.length; k++) {
    ids.push(exprs[k].id); const f: number[] = [];
    for (let e = 0; e < 2; e++) for (let i = 0; i < exprs[k].eyes[e].length; i++) f.push(exprs[k].eyes[e][i][0], exprs[k].eyes[e][i][1]);
    shapes.push(f);
  }
  let k0 = ids.indexOf(initial); if (k0 < 0) k0 = 0;
  return {
    ids, shapes, n: exprs[0].eyes[0].length, expr: k0, pending: -1, pendingAt: 0,
    P: shapes[k0].slice(), V: shapes[k0].map(() => 0),
    yaw: sp(), pitch: sp(), roll: sp(), ex: sp(), ey: sp(), lid: sp(), squash: sp(), squeeze: sp(),
    tYaw: 0, tPitch: 0, tRoll: 0, tEx: 0, tEy: 0, look: [0, 0], manual: false, drag: false, dragYaw: 0, dragPitch: 0,
    time: 0, idle: opts.idle !== false, reduced: !!opts.reduced, stiffness: opts.stiffness ?? 240, damping: opts.damping ?? 17,
    blinks: [], lidHold: 0, lidHoldUntil: 0, nextBlink: 1.2 + Math.random() * 2, nextBehavior: 2.5, behaviorUntil: 0, behavior: -1,
    glance: [0, 0], tilt: 0, stretch: 0, sacc: [0, 0], nextSacc: 1, changed: 0,
  };
}

export function coreSetExpression(s: MotionCoreState, id: string): boolean {
  'worklet';
  const k = s.ids.indexOf(id); if (k < 0 || k === s.expr || k === s.pending) return false;
  if (s.reduced) { s.expr = k; s.pending = -1; s.changed++; return true; }
  // anticipation: brief squash + eye squeeze, then switch (overshooting springs do the follow-through)
  s.pending = k; s.pendingAt = s.time + 0.085; s.squash.v -= 2.2; s.squeeze.v += 9;
  return true;
}
export function coreBlink(s: MotionCoreState, times = 1) {
  'worklet';
  for (let i = 0; i < times; i++) s.blinks.push(s.time + i * 0.22, s.time + i * 0.22 + 0.1);
}
/** x,y in [-1,1]. Drives head yaw/pitch + eye offset. manual=true overrides idle glances. */
export function coreLookAt(s: MotionCoreState, x: number, y: number, manual = true) {
  'worklet';
  const nx = Math.max(-1, Math.min(1, x)), ny = Math.max(-1, Math.min(1, y));
  const jump = Math.hypot(nx - s.look[0], ny - s.look[1]);
  if (jump > 0.7 && !s.reduced && Math.random() < 0.65) coreBlink(s, 1); // blink synced with big head turns
  s.look[0] = nx; s.look[1] = ny; s.manual = manual;
}
export function coreRelease(s: MotionCoreState) { 'worklet'; s.manual = false; s.look[0] = 0; s.look[1] = 0; }
export function coreDrag(s: MotionCoreState, active: boolean, dx = 0, dy = 0) {
  'worklet'; // dx,dy normalized drag in [-1,1] → direct rotation
  s.drag = active; s.dragYaw = Math.max(-1, Math.min(1, dx)) * MAX_YAW * 1.25; s.dragPitch = -Math.max(-1, Math.min(1, dy)) * MAX_PITCH * 1.25;
}

function idleBehaviors(s: MotionCoreState) {
  'worklet';
  const t = s.time, id = s.ids[s.expr];
  if (t > s.nextBlink) { coreBlink(s, Math.random() < 0.18 ? 2 : 1); s.nextBlink = t + 2 + Math.random() * 4.5; }
  if (t > s.nextSacc) { const a = Math.random() * 6.283, m = 0.05 + Math.random() * 0.07; s.sacc[0] = Math.cos(a) * m; s.sacc[1] = Math.sin(a) * m * 0.6; s.nextSacc = t + 0.6 + Math.random() * 2; }
  if (s.behavior >= 0 && t > s.behaviorUntil) { s.behavior = -1; s.glance[0] = 0; s.glance[1] = 0; s.tilt = 0; s.stretch = 0; s.lidHold = 0; s.nextBehavior = t + 1.5 + Math.random() * 3.5; }
  if (s.behavior < 0 && t > s.nextBehavior && !s.manual && id !== 'ko' && id !== 'dizzy') {
    const r = Math.random();
    if (r < 0.5) { // glance to a random direction/corner
      const a = Math.floor(Math.random() * 8) * Math.PI / 4, m = 0.45 + Math.random() * 0.45;
      s.glance[0] = Math.cos(a) * m; s.glance[1] = Math.sin(a) * m * 0.8; s.behavior = 0; s.behaviorUntil = t + 0.7 + Math.random() * 1.3;
      if (Math.random() < 0.6) coreBlink(s, 1);
    } else if (r < 0.78) { // curious head tilt
      s.tilt = (Math.random() < 0.5 ? -1 : 1) * (6 + Math.random() * 6) * DEG; s.glance[1] = -0.15; s.behavior = 1; s.behaviorUntil = t + 1.2 + Math.random() * 1.2;
    } else if (r < 0.9 && (id === 'normal' || id === 'flat' || id === 'serene' || id === 'shy')) { // yawn / sleepy
      s.lidHold = 0.75; s.lidHoldUntil = t + 1.4; s.stretch = 1; s.glance[1] = -0.35; s.behavior = 2; s.behaviorUntil = t + 1.6;
    } else { s.behavior = 3; s.behaviorUntil = t + 0.4; } // pause
  }
}

export function coreStep(s: MotionCoreState, dtIn: number) {
  'worklet';
  const dt = Math.max(0, Math.min(0.05, dtIn)); s.time += dt; const t = s.time;
  if (s.pending >= 0 && t >= s.pendingAt) { s.expr = s.pending; s.pending = -1; s.changed++; s.squash.v += 3.2; }
  if (s.idle && !s.reduced) idleBehaviors(s);
  else if (s.idle && t > s.nextBlink) { coreBlink(s, 1); s.nextBlink = t + 3 + Math.random() * 4; }
  const id = s.ids[s.expr];
  // look target: manual > idle glance; plus micro drift
  const lx = s.manual ? s.look[0] : s.glance[0] + s.sacc[0], ly = s.manual ? s.look[1] : s.glance[1] + s.sacc[1];
  const drift = s.reduced || !s.idle ? 0 : 1;
  s.tYaw = lx * MAX_YAW + drift * Math.sin(t * 0.7) * 1.2 * DEG;
  s.tPitch = -ly * MAX_PITCH + drift * Math.sin(t * 0.53 + 1) * 1.0 * DEG;
  s.tRoll = s.tilt + drift * Math.sin(t * 0.41) * 0.8 * DEG;
  s.tEx = lx * 7; s.tEy = ly * 5;
  if (!s.reduced && s.idle) {
    if (id === 'dizzy') { s.tYaw += Math.cos(t * 3.1) * 12 * DEG; s.tPitch += Math.sin(t * 3.1) * 9 * DEG; s.tRoll += Math.sin(t * 2.2) * 9 * DEG; }
    if (id === 'ko') { s.tRoll += Math.sin(t * 1.3) * 6 * DEG; s.tPitch += (Math.sin(t * 0.9) * 2 - 6) * DEG; }
  }
  if (s.drag) { s.tYaw = s.dragYaw; s.tPitch = s.dragPitch; }
  let lidT = s.lidHold > 0 && t < s.lidHoldUntil ? s.lidHold : 0;
  for (let i = 0; i < s.blinks.length; i += 2) if (t >= s.blinks[i] && t < s.blinks[i + 1]) lidT = 1;
  while (s.blinks.length && t > s.blinks[1] + 0.3) s.blinks.splice(0, 2);
  const breath = s.idle && !s.reduced ? Math.sin(t * 2 * Math.PI / 4.2) : 0;
  const tgt = s.shapes[s.expr];
  const K = s.reduced ? s.stiffness * 3 : s.stiffness, C = s.reduced ? 2 * Math.sqrt(K) : s.damping;
  const steps = Math.max(1, Math.ceil(dt / 0.004)), h = dt / steps, len = s.P.length;
  for (let k = 0; k < steps; k++) {
    if (lidT >= 1) spStep(s.lid, 1, 2400, 85, h); else spStep(s.lid, lidT, lidT > 0 ? 60 : 900, lidT > 0 ? 14 : 50, h);
    const hk = s.drag ? 400 : 120, hc = s.drag ? 34 : 17; // head: soft, slight overshoot
    spStep(s.yaw, s.tYaw, hk, hc, h); spStep(s.pitch, s.tPitch, hk, hc, h); spStep(s.roll, s.tRoll, 90, 13, h);
    spStep(s.ex, s.tEx, 260, 20, h); spStep(s.ey, s.tEy, 260, 20, h); // eyes lead the head (secondary motion)
    spStep(s.squash, s.stretch * 0.6 + breath * 0.35, 320, 13, h); spStep(s.squeeze, 0, 420, 22, h);
    for (let i = 0; i < len; i++) { s.V[i] += (-K * (s.P[i] - tgt[i]) - C * s.V[i]) * h; s.P[i] += s.V[i] * h; }
  }
}

/** Closed-eye capsule matching the outline's point order (leftmost start, clockwise in screen coords). */
export function closedInto(src: number[], off: number, n: number, out: number[]) {
  'worklet';
  let x0 = 1e9, x1 = -1e9, cy = 0;
  for (let i = 0; i < n; i++) { const x = src[off + i * 2]; if (x < x0) x0 = x; if (x > x1) x1 = x; cy += src[off + i * 2 + 1]; }
  cy /= n; const cx = (x0 + x1) / 2, w = Math.max(x1 - x0, 16) * 1.02, hh = 5.5, r = hh / 2, a = w - hh, L = 2 * a + Math.PI * hh, PI = Math.PI;
  for (let i = 0; i < n; i++) {
    let q = (i / n) * L, x = 0, y = 0;
    if (q < PI * r / 2) { const u = PI + q / r; x = cx - a / 2 + r * Math.cos(u); y = cy + r * Math.sin(u); }
    else if ((q -= PI * r / 2) < a) { x = cx - a / 2 + q; y = cy - r; }
    else if ((q -= a) < PI * r) { const u = -PI / 2 + q / r; x = cx + a / 2 + r * Math.cos(u); y = cy + r * Math.sin(u); }
    else if ((q -= PI * r) < a) { x = cx + a / 2 - q; y = cy + r; }
    else { q -= a; const u = PI / 2 + q / r; x = cx - a / 2 + r * Math.cos(u); y = cy + r * Math.sin(u); }
    out[i * 2] = x; out[i * 2 + 1] = y;
  }
}

/** Smooth closed path through midpoints (quadratic B-spline). */
export function pathOf(p: number[], n: number): string {
  'worklet';
  const mx = (i: number) => (p[(i % n) * 2] + p[((i + 1) % n) * 2]) / 2, my = (i: number) => (p[(i % n) * 2 + 1] + p[((i + 1) % n) * 2 + 1]) / 2;
  let d = 'M' + mx(0).toFixed(2) + ' ' + my(0).toFixed(2);
  for (let i = 1; i <= n; i++) d += 'Q' + p[(i % n) * 2].toFixed(2) + ' ' + p[(i % n) * 2 + 1].toFixed(2) + ' ' + mx(i).toFixed(2) + ' ' + my(i).toFixed(2);
  return d + 'Z';
}

export interface Frame { eyes: number[][]; body: number[] /* [tx, ty, sx, sy] */; highlight: number[] /* [x,y] */ }
const R = 100;
/** Calibrated against the sideways reference (01M5E6S3XT ≈ yaw 33°): eyes sit slightly inside the sphere, shapes curve gently. */
export const FACE_DEPTH = 0.8, FACE_CURVE = 0.35;
/** Soft radial limit: points beyond KNEE are squashed towards RIM (eyes wrap around the edge instead of leaving it). */
export const KNEE = 88, RIM = 97;
/** Project the current state: eye decals on a sphere, rotated by yaw/pitch/roll (orthographic). */
export function coreFrame(s: MotionCoreState): Frame {
  'worklet';
  const n = s.n, lid = Math.max(0, Math.min(1, s.lid.x)), tgt = s.shapes[s.expr];
  const cyw = Math.cos(s.yaw.x), syw = Math.sin(s.yaw.x), cp = Math.cos(s.pitch.x), spt = Math.sin(s.pitch.x), cr = Math.cos(s.roll.x), sr = Math.sin(s.roll.x);
  const sq = Math.max(-0.5, Math.min(0.5, s.squeeze.x * 0.02));
  const eyes: number[][] = [], cl: number[] = new Array(n * 2);
  // Rotation of a 3D vector (yaw about Y, pitch about X, then roll in screen plane) → 2D
  const rot = (x: number, y: number, z: number, o: number[]) => {
    const x1 = x * cyw + z * syw, z1 = -x * syw + z * cyw, y2 = y * cp - z1 * spt;
    o[0] = x1 * cr - y2 * sr; o[1] = x1 * sr + y2 * cr;
  };
  const C0 = [0, 0], TX = [0, 0], TY = [0, 0];
  for (let e = 0; e < 2; e++) {
    const off = e * n * 2; let cx = 0, cy = 0;
    for (let i = 0; i < n; i++) { cx += s.P[off + i * 2]; cy += s.P[off + i * 2 + 1]; }
    cx /= n; cy /= n;
    if (lid > 0.001) closedInto(tgt, off, n, cl);
    // Eye = flat decal tangent to the sphere at its centre: centre slides over the sphere,
    // the shape is mapped with the local tangent frame (Jacobian) → foreshortening, far eye narrower.
    const ux = cx + s.ex.x, uy = cy + s.ey.x, z = Math.max(30, Math.sqrt(Math.max(0, R * R - ux * ux - uy * uy)));
    rot(ux, uy, z * FACE_DEPTH, C0); rot(1, 0, -FACE_CURVE * ux / z, TX); rot(0, 1, -FACE_CURVE * uy / z, TY);
    const out: number[] = new Array(n * 2);
    for (let i = 0; i < n; i++) {
      let x = s.P[off + i * 2], y = s.P[off + i * 2 + 1];
      if (sq !== 0) { x = cx + (x - cx) * (1 + sq * 0.5); y = cy + (y - cy) * (1 - sq); } // anticipation squeeze
      if (lid > 0.001) { x += (cl[i * 2] - x) * lid; y += (cl[i * 2 + 1] - y) * lid; }
      const dx = x - cx, dy = y - cy;
      let px = C0[0] + dx * TX[0] + dy * TY[0], py = C0[1] + dx * TX[1] + dy * TY[1];
      const rr = Math.sqrt(px * px + py * py);
      if (rr > KNEE) { const f = (RIM - (RIM - KNEE) * Math.exp(-(rr - KNEE) / (RIM - KNEE))) / rr; px *= f; py *= f; } // wrap around the silhouette
      out[i * 2] = px; out[i * 2 + 1] = py;
    }
    eyes.push(out);
  }
  const k = s.squash.x * 0.035;
  // highlight position: where the sphere faces the key light (upper-left), shifted by rotation
  const hx = -38 + Math.sin(s.yaw.x) * 30, hy = -42 - Math.sin(s.pitch.x) * 30;
  return { eyes, body: [s.yaw.x * 2.5, -k * 100 + (1 - Math.cos(s.pitch.x)) * 4, 1 - k * 0.7, 1 + k], highlight: [hx, hy] };
}
