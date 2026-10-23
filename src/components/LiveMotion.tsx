import React, { useEffect, useRef, useState } from 'react';
import type { ViewStyle } from 'react-native';
import Motion, {
  EXPRESSIONS,
  LOOK_DIRECTIONS,
  type Direction,
  type ExpressionId,
  type MotionHandle,
  type ShapeId,
} from '../motion/Motion';
import type { ColorId } from '../motion/core/palette';

/**
 * Motion "vivo": usa o motor Motion Pro (molas, cabeça 3D, pestanejar e olhares idle)
 * e acrescenta um agendador aleatório de expressões para que o personagem nunca fique parado.
 */

// Peso de cada expressão no sorteio (as mais "neutras" aparecem mais vezes).
const WEIGHTS: Partial<Record<ExpressionId, number>> = {
  normal: 4,
  happy: 3,
  serene: 2,
  curious: 3,
  surprised: 2,
  shy: 2,
  flat: 1.5,
  worried: 1.2,
  angry: 0.8,
  dizzy: 0.6,
  ko: 0.4,
};

const REACTIONS: ExpressionId[] = ['happy', 'surprised', 'curious', 'happy'];

const rand = (min: number, max: number) => min + Math.random() * (max - min);

function pickExpression(current: ExpressionId): ExpressionId {
  const pool = EXPRESSIONS.map((e) => e.id).filter((id) => id !== current);
  const total = pool.reduce((acc, id) => acc + (WEIGHTS[id] ?? 1), 0);
  let r = Math.random() * total;
  for (const id of pool) {
    r -= WEIGHTS[id] ?? 1;
    if (r <= 0) return id;
  }
  return pool[0] ?? 'normal';
}

export function LiveMotion({
  size = 86,
  shape = 'circle',
  colorId = 'black',
  style,
}: {
  size?: number;
  shape?: ShapeId;
  colorId?: ColorId;
  style?: ViewStyle;
}) {
  const ref = useRef<MotionHandle>(null);
  const [expression, setExpression] = useState<ExpressionId>('normal');
  const exprRef = useRef<ExpressionId>('normal');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstChange = useRef(true);

  const apply = (id: ExpressionId) => {
    exprRef.current = id;
    setExpression(id);
  };

  // Agendador aleatório: troca de expressão, volta ao normal, olha em volta e pestaneja.
  const schedule = (delay: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const current = exprRef.current;
      // Depois de uma expressão "forte", regressa muitas vezes ao normal.
      const next =
        current !== 'normal' && Math.random() < 0.45 ? 'normal' : pickExpression(current);
      apply(next);

      if (Math.random() < 0.35) {
        const dirs = LOOK_DIRECTIONS.filter((d) => d !== 'center') as Direction[];
        ref.current?.lookTo(dirs[Math.floor(Math.random() * dirs.length)]);
        setTimeout(() => ref.current?.resetLook(), rand(700, 1600));
      } else if (Math.random() < 0.3) {
        ref.current?.blink(Math.random() < 0.3 ? 2 : 1);
      }

      const hold = next === 'ko' || next === 'dizzy' ? rand(2200, 3200) : rand(2000, 4800);
      schedule(hold);
    }, delay);
  };

  useEffect(() => {
    schedule(rand(1400, 2600));
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reage quando a forma ou a cor mudam (ex.: na escolha do avatar).
  useEffect(() => {
    if (firstChange.current) {
      firstChange.current = false;
      return;
    }
    apply(REACTIONS[Math.floor(Math.random() * REACTIONS.length)]);
    ref.current?.blink(1);
    schedule(rand(1800, 3000));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shape, colorId]);

  return (
    <Motion
      ref={ref}
      size={size}
      shape={shape}
      colorId={colorId}
      expression={expression}
      idle
      touchMode="look"
      style={style}
    />
  );
}
