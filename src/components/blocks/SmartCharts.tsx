import React, { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, G, Line, Path, Polyline, Rect } from 'react-native-svg';
import { Txt } from '../UI';
import { C } from '../../theme';
import type { UiBlock } from '../../types';

type ChartBlock = Extract<UiBlock, { type: 'chart' }>;

// Monochrome palette consistent with the app (ink -> greys)
const PALETTE = [C.ink, '#5C5C5C', C.faint, C.borderDark, '#3A3A3A', '#8C8C8C'];
const H = 140;
const PAD = { l: 26, r: 6, t: 8, b: 18 };

const val = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const fmt = (n: number) => (Math.abs(n) >= 1000 ? `${Math.round(n / 100) / 10}k` : String(Math.round(n * 10) / 10));

function Legend({ items }: { items: { label: string; color: string }[] }) {
  if (items.length < 2) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 6 }}>
      {items.map((it, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: it.color }} />
          <Txt size={10} color={C.muted}>{it.label}</Txt>
        </View>
      ))}
    </View>
  );
}

function Pie({ b }: { b: ChartBlock }) {
  const key = b.series[0].key;
  const items = b.data.map((d, i) => ({ label: String(d[b.xKey]), value: Math.max(0, val(d[key])), color: PALETTE[i % PALETTE.length] }));
  const total = items.reduce((s, x) => s + x.value, 0) || 1;
  const R = 52;
  const cx = 60;
  let angle = -Math.PI / 2;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Svg width={120} height={120}>
        {items.length === 1 ? (
          <Circle cx={cx} cy={cx} r={R} fill={items[0].color} />
        ) : (
          items.map((it, i) => {
            const a = (it.value / total) * Math.PI * 2;
            const x1 = cx + R * Math.cos(angle);
            const y1 = cx + R * Math.sin(angle);
            angle += a;
            const x2 = cx + R * Math.cos(angle);
            const y2 = cx + R * Math.sin(angle);
            const large = a > Math.PI ? 1 : 0;
            return <Path key={i} d={`M${cx},${cx} L${x1},${y1} A${R},${R} 0 ${large} 1 ${x2},${y2} Z`} fill={it.color} stroke={C.white} strokeWidth={1.5} />;
          })
        )}
        <Circle cx={cx} cy={cx} r={24} fill={C.white} />
      </Svg>
      <View style={{ flex: 1, gap: 4 }}>
        {items.map((it, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: it.color }} />
            <Txt size={11} style={{ flex: 1 }} numberOfLines={1}>{it.label}</Txt>
            <Txt size={11} weight="600">{`${Math.round((it.value / total) * 100)}%`}</Txt>
          </View>
        ))}
      </View>
    </View>
  );
}

function Cartesian({ b, width }: { b: ChartBlock; width: number }) {
  const all = b.data.flatMap((d) => b.series.map((s) => val(d[s.key])));
  const max = Math.max(...all, 0);
  const min = Math.min(...all, 0);
  const span = max - min || 1;
  const w = width - PAD.l - PAD.r;
  const h = H - PAD.t - PAD.b;
  const n = b.data.length;
  const y = (v: number) => PAD.t + h - ((v - min) / span) * h;
  const xc = (i: number) => PAD.l + (n <= 1 ? w / 2 : (i * w) / (n - 1));
  const labelEvery = Math.max(1, Math.ceil(n / 6));
  const group = w / n;
  const barW = Math.max(2, Math.min(18, (group * 0.7) / b.series.length));

  return (
    <View>
      <Svg width={width} height={H}>
        {[0, 0.5, 1].map((t, i) => (
          <Line key={i} x1={PAD.l} x2={width - PAD.r} y1={PAD.t + h * t} y2={PAD.t + h * t} stroke={C.surface2} strokeWidth={1} />
        ))}
        <Line x1={PAD.l} x2={width - PAD.r} y1={y(0)} y2={y(0)} stroke={C.border} strokeWidth={1} />
        {b.kind === 'bar'
          ? b.data.map((d, i) => (
              <G key={i}>
                {b.series.map((s, si) => {
                  const v = val(d[s.key]);
                  const x = PAD.l + group * i + (group - barW * b.series.length) / 2 + si * barW;
                  return <Rect key={si} x={x} y={Math.min(y(v), y(0))} width={barW - 1} height={Math.abs(y(v) - y(0))} rx={2} fill={PALETTE[si]} />;
                })}
              </G>
            ))
          : b.series.map((s, si) => {
              const pts = b.data.map((d, i) => `${xc(i)},${y(val(d[s.key]))}`).join(' ');
              return (
                <G key={si}>
                  {b.kind === 'area' && (
                    <Path d={`M${xc(0)},${y(0)} L${pts.replace(/ /g, ' L')} L${xc(n - 1)},${y(0)} Z`} fill={PALETTE[si]} opacity={0.12} />
                  )}
                  <Polyline points={pts} fill="none" stroke={PALETTE[si]} strokeWidth={2} strokeLinejoin="round" />
                </G>
              );
            })}
      </Svg>
      <View style={{ position: 'absolute', left: 0, top: PAD.t - 6 }}>
        <Txt size={9} color={C.faint}>{fmt(max)}</Txt>
      </View>
      <View style={{ position: 'absolute', left: 0, top: PAD.t + h - 6 }}>
        <Txt size={9} color={C.faint}>{fmt(min)}</Txt>
      </View>
      <View style={{ flexDirection: 'row', marginLeft: PAD.l, marginRight: PAD.r, marginTop: -PAD.b + 4 }}>
        {b.data.map((d, i) => (
          <Txt key={i} size={9} color={C.muted} numberOfLines={1} style={{ flex: 1, textAlign: 'center' }}>
            {i % labelEvery === 0 ? String(d[b.xKey]) : ''}
          </Txt>
        ))}
      </View>
    </View>
  );
}

export function ChartView({ b }: { b: ChartBlock }) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));
  return (
    <View style={{ backgroundColor: C.white, borderColor: C.border, borderWidth: 1, borderRadius: 16, padding: 11 }}>
      {!!b.title && <Txt size={12} weight="700" style={{ marginBottom: 7 }}>{b.title}</Txt>}
      <View onLayout={onLayout}>
        {b.kind === 'pie' ? <Pie b={b} /> : width > 0 ? <Cartesian b={b} width={width} /> : <View style={{ height: H }} />}
      </View>
      {b.kind !== 'pie' && <Legend items={b.series.map((s, i) => ({ label: s.label, color: PALETTE[i] }))} />}
    </View>
  );
}
