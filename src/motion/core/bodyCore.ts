// Animated, interruptible silhouette morph. Shared by Web and React Native (UI worklets).
// Android implements the same shape model in MotionBody.kt.
import type { BodyData } from './bodies';

export interface BodyState {
  ids: string[];
  points: number[][];
  faces: number[][];
  index: number;
  outline: number[];
  from: number[];
  target: number[];
  face: number[];
  faceFrom: number[];
  faceTarget: number[];
  phase: number;
  duration: number;
}
export function createBodyState(defs: BodyData[], initial = 'circle'): BodyState {
  'worklet';
  const ids: string[] = [], points: number[][] = [], faces: number[][] = [];
  for (let k = 0; k < defs.length; k++) {
    ids.push(defs[k].id);
    const flat: number[] = [];
    for (let i = 0; i < defs[k].points.length; i++) flat.push(defs[k].points[i][0], defs[k].points[i][1]);
    points.push(flat); faces.push(defs[k].face.slice());
  }
  const idx = Math.max(0, ids.indexOf(initial));
  const shape = points[idx].slice(), face = faces[idx].slice();
  return { ids, points, faces, index: idx, outline: shape, from: shape.slice(), target: shape.slice(), face,
    faceFrom: face.slice(), faceTarget: face.slice(), phase: 1, duration: .42 };
}
export function setBodyShape(s: BodyState, id: string, reduced = false): boolean {
  'worklet';
  const i = s.ids.indexOf(id);
  if (i < 0 || i === s.index) return false;
  s.index = i;
  if (reduced) {
    s.outline = s.points[i].slice(); s.face = s.faces[i].slice();
    s.from = s.outline.slice(); s.target = s.outline.slice();
    s.faceFrom = s.face.slice(); s.faceTarget = s.face.slice(); s.phase = 1;
  } else {
    s.from = s.outline.slice(); s.target = s.points[i];
    s.faceFrom = s.face.slice(); s.faceTarget = s.faces[i]; s.phase = 0;
  }
  return true;
}
/** Eased cubic interpolation: no artificial spring wobble at sharp silhouette tips. */
export function stepBody(s: BodyState, dt: number) {
  'worklet';
  if (s.phase >= 1) return;
  s.phase = Math.min(1, s.phase + Math.max(0, Math.min(dt, .05)) / s.duration);
  const p = s.phase;
  const eased = p * p * (3 - 2 * p);
  if (p === 1) {
    for (let i = 0; i < s.outline.length; i++) s.outline[i] = s.target[i];
    for (let i = 0; i < 4; i++) s.face[i] = s.faceTarget[i];
  } else {
    for (let i = 0; i < s.outline.length; i++) s.outline[i] = s.from[i] + (s.target[i] - s.from[i]) * eased;
    for (let i = 0; i < 4; i++) s.face[i] = s.faceFrom[i] + (s.faceTarget[i] - s.faceFrom[i]) * eased;
  }
}
/** Closed high-resolution outline; preserve the sharp points of diamonds and spades. */
export function outlinePath(a: number[]): string {
  'worklet';
  let p = 'M' + a[0].toFixed(2) + ' ' + a[1].toFixed(2);
  for (let i = 2; i < a.length; i += 2) p += 'L' + a[i].toFixed(2) + ' ' + a[i + 1].toFixed(2);
  return p + 'Z';
}
