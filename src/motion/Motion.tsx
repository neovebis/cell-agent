// Motion — React Native (react-native-svg + react-native-reanimated ≥3, tested types against v4).
// The whole simulation (springs, idle scheduler, pseudo-3D projection, path building) runs on the UI thread
// via the shared core (./core/motionCore.ts) — the same file the web build compiles.
import React, { forwardRef, useEffect, useImperativeHandle, useMemo } from 'react';
import { GestureResponderEvent, View, ViewStyle } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Path, RadialGradient, Stop } from 'react-native-svg';
import Animated, { runOnJS, runOnUI, useAnimatedProps, useFrameCallback, useSharedValue } from 'react-native-reanimated';
import shapes from './shapes/expressions.json';
import { PALETTE, ColorId } from './core/palette';
export { PALETTE };
import bodyDefs from './shapes/bodies.json'; // single source of truth (web + RN + Android)
import { createBodyState, setBodyShape, stepBody, outlinePath, BodyState } from './core/bodyCore';
import {
  DIRECTIONS, Dir, MotionCoreState, coreBlink, coreDrag, coreFrame, coreLookAt, coreRelease, coreSetExpression, coreStep, createCore, pathOf,
} from './core/motionCore';

export type ExpressionId = 'normal' | 'happy' | 'serene' | 'surprised' | 'curious' | 'angry' | 'worried' | 'flat' | 'shy' | 'ko' | 'dizzy';
export type Direction = Dir;
export type ShapeId = 'circle' | 'heart' | 'diamond' | 'spade' | 'club';
const BODIES = bodyDefs.bodies;
export const BODY_SHAPES: ReadonlyArray<{ id: ShapeId; label: string }> = BODIES.map(b => ({ id: b.id as ShapeId, label: b.label }));
type Expr = { id: ExpressionId; label: string; key: string; eyes: number[][][] };
const EXPRS = (shapes as unknown as { expressions: Expr[] }).expressions;
export const EXPRESSIONS: ReadonlyArray<{ id: ExpressionId; label: string }> = EXPRS.map(e => ({ id: e.id, label: e.label }));
export const LOOK_DIRECTIONS = Object.keys(DIRECTIONS) as Direction[];

export interface MotionHandle {
  setExpression(id: ExpressionId): void; setShape(id: ShapeId): void; blink(times?: number): void;
  /** x,y in [-1,1]: head yaw/pitch + eye offset */ lookAt(x: number, y: number): void; lookTo(dir: Direction): void; resetLook(): void;
  setIdle(on: boolean): void; setRotation(yawDeg: number, pitchDeg: number): void; clearRotation(): void;
}
export interface MotionProps {
  expression?: ExpressionId; shape?: ShapeId; look?: Direction; size?: number; colorId?: ColorId; bodyColor?: string; eyeColor?: string; style?: ViewStyle;
  idle?: boolean; /** 'look': eyes/head follow the finger · 'rotate': drag rotates the head · 'none' */ touchMode?: 'look' | 'rotate' | 'none';
  shading?: boolean; reduceMotion?: boolean; stiffness?: number; damping?: number; onExpressionChange?: (id: ExpressionId) => void;
}
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
let uid = 0;

export const Motion = forwardRef<MotionHandle, MotionProps>(function Motion({
  expression = 'normal', shape = 'circle', look, size = 200, colorId, bodyColor = '#000', eyeColor = '#fff', style, idle = true, touchMode = 'look', shading = false,
  reduceMotion = false, stiffness = 240, damping = 17, onExpressionChange }, ref) {
  const finalBodyColor = colorId ? PALETTE.find(c => c.id === colorId)!.hex : bodyColor;
  const ids = useMemo(() => { const n = ++uid; return { grad: `mg${n}`, clip: `mc${n}` }; }, []);
  const st = useSharedValue<MotionCoreState>(createCore(EXPRS, expression, { idle, reduced: reduceMotion, stiffness, damping }));
  const bs = useSharedValue<BodyState>(createBodyState(BODIES, shape));
  const initBody = createBodyState(BODIES, shape);
  const outline = useSharedValue(outlinePath(initBody.outline));
  const faceT = useSharedValue<number[]>(initBody.face);
  const init = coreFrame(st.value);
  const d0 = useSharedValue(pathOf(init.eyes[0], st.value.n)), d1 = useSharedValue(pathOf(init.eyes[1], st.value.n));
  const body = useSharedValue<number[]>(init.body), hl = useSharedValue<number[]>(init.highlight);
  const changed = useSharedValue(0);
  const emit = (id: string) => onExpressionChange?.(id as ExpressionId);

  useFrameCallback(fi => {
    'worklet';
    const dt = (fi.timeSincePreviousFrame ?? 16) / 1000;
    st.modify(s => {
      'worklet';
      coreStep(s, dt); const f = coreFrame(s);
      d0.value = pathOf(f.eyes[0], s.n); d1.value = pathOf(f.eyes[1], s.n); body.value = f.body; hl.value = f.highlight;
      if (s.changed !== changed.value) { changed.value = s.changed; runOnJS(emit)(s.ids[s.expr]); }
      return s;
    }, false);
    bs.modify(b => {
      'worklet'; stepBody(b, dt); outline.value = outlinePath(b.outline); faceT.value = b.face.slice(); return b;
    }, false);
  });

  const run = (fn: (s: MotionCoreState) => void) => runOnUI(() => { 'worklet'; st.modify(s => { 'worklet'; fn(s); return s; }, false); })();
  const api: MotionHandle = useMemo(() => ({
    setShape: id => runOnUI(() => { 'worklet'; bs.modify(b => { 'worklet'; setBodyShape(b, id, reduceMotion); return b; }, false); })(),
    setExpression: id => run(s => { 'worklet'; coreSetExpression(s, id); }),
    blink: (n = 1) => run(s => { 'worklet'; coreBlink(s, n); }),
    lookAt: (x, y) => run(s => { 'worklet'; coreLookAt(s, x, y, true); }),
    lookTo: dir => { const d = DIRECTIONS[dir]; if (d) run(s => { 'worklet'; coreLookAt(s, d[0], d[1], true); }); },
    resetLook: () => run(s => { 'worklet'; coreRelease(s); }),
    setIdle: on => run(s => { 'worklet'; s.idle = on; if (!on) { s.glance[0] = 0; s.glance[1] = 0; s.tilt = 0; s.stretch = 0; s.lidHold = 0; s.behavior = -1; } }),
    setRotation: (yaw, pitch) => run(s => { 'worklet'; coreDrag(s, true, yaw / 50, -pitch / 35); }),
    clearRotation: () => run(s => { 'worklet'; coreDrag(s, false); }),
  }), []);
  useImperativeHandle(ref, () => api, [api]);
  useEffect(() => { api.setExpression(expression); }, [expression]);
  useEffect(() => { api.setShape(shape); }, [shape]);
  useEffect(() => { api.setIdle(idle); }, [idle]);
  useEffect(() => { run(s => { 'worklet'; s.reduced = reduceMotion; s.stiffness = stiffness; s.damping = damping; }); }, [reduceMotion, stiffness, damping]);
  useEffect(() => { look ? api.lookTo(look) : api.resetLook(); }, [look]);

  const outlineProps = useAnimatedProps(() => ({ d: outline.value }));
  const faceProps = useAnimatedProps(() => { const f = faceT.value; return { transform: [{ translateX: f[2] }, { translateY: f[3] }, { scaleX: f[0] }, { scaleY: f[1] }] }; });
  const eye0 = useAnimatedProps(() => ({ d: d0.value }));
  const eye1 = useAnimatedProps(() => ({ d: d1.value }));
  const bodyG = useAnimatedProps(() => { const b = body.value; return { transform: [{ translateX: b[0] }, { translateY: b[1] }, { scaleX: b[2] }, { scaleY: b[3] }] }; });
  const hlProps = useAnimatedProps(() => ({ cx: hl.value[0], cy: hl.value[1] }));

  const rel = (e: GestureResponderEvent) => [(e.nativeEvent.locationX - size / 2) / (size / 2), (e.nativeEvent.locationY - size / 2) / (size / 2)];
  let start: number[] | null = null;
  const onGrant = (e: GestureResponderEvent) => { start = rel(e); onMove(e); };
  const onMove = (e: GestureResponderEvent) => {
    const [x, y] = rel(e);
    if (touchMode === 'rotate' && start) { const sx = start[0], sy = start[1]; run(s => { 'worklet'; coreDrag(s, true, (x - sx) * 0.9, (y - sy) * 0.9); }); }
    else if (touchMode === 'look') { const d = Math.hypot(x, y) || 1, f = Math.min(1, d / 1.6); run(s => { 'worklet'; coreLookAt(s, x / d * f, y / d * f, true); }); }
  };
  const onRelease = () => { start = null; run(s => { 'worklet'; coreDrag(s, false); coreRelease(s); }); };
  const touch = touchMode !== 'none';

  return (
    <View style={[{ width: size, height: size }, style]} onStartShouldSetResponder={() => touch} onMoveShouldSetResponder={() => touch}
      onResponderGrant={onGrant} onResponderMove={onMove} onResponderRelease={onRelease} onResponderTerminate={onRelease}
      accessible accessibilityRole="image" accessibilityLabel={`Motion: ${EXPRS.find(x => x.id === expression)?.label ?? ''}`}>
      <Svg width={size} height={size} viewBox="-110 -110 220 220">
        <Defs>
          <ClipPath id={ids.clip}><AnimatedPath animatedProps={outlineProps} /></ClipPath>
          <RadialGradient id={ids.grad}><Stop offset="0" stopColor="#fff" stopOpacity={0.16} /><Stop offset="1" stopColor="#fff" stopOpacity={0} /></RadialGradient>
        </Defs>
        <AnimatedG animatedProps={bodyG}>
          <AnimatedPath animatedProps={outlineProps} fill={finalBodyColor} />
          <G clipPath={`url(#${ids.clip})`}>
            {shading && <AnimatedCircle animatedProps={hlProps} r={70} fill={`url(#${ids.grad})`} />}
            <AnimatedG animatedProps={faceProps}>
              <AnimatedPath animatedProps={eye0} fill={eyeColor} />
              <AnimatedPath animatedProps={eye1} fill={eyeColor} />
            </AnimatedG>
          </G>
        </AnimatedG>
      </Svg>
    </View>
  );
});
export default Motion;
