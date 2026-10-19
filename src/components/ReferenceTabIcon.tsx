/**
 * Bottom bar icon silhouettes carefully traced from the user's reference
 * screenshot (2026-10-19). Do not replace these with platform icon glyphs.
 *
 * UI/layout and official agent logo are intentionally unchanged.
 */
import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';
import type { Tab } from '../types';

const strokes = {
  // Balão redondo com pequena cauda inferior à esquerda.
  Chat: [
    'M12.3 3.1C7.2 3.1 3.1 7.1 3.1 12.1c0 1.35.28 2.57.82 3.77L3.1 21l5.07-1.16c1.18.56 2.62.85 4.13.85 5.17 0 9.35-3.92 9.35-8.76 0-4.89-4.18-8.83-9.35-8.83Z',
  ],
  // Câmara retangular e saliência superior exatamente ao estilo da barra.
  Capture: [
    'M3.25 8.2h3.32c.54 0 1.03-.27 1.3-.72L9.16 5.4h5.64l1.25 2.08c.27.45.76.72 1.3.72h3.4c.8 0 1.45.65 1.45 1.46V19a1.55 1.55 0 0 1-1.55 1.55H3.35A1.55 1.55 0 0 1 1.8 19V9.66c0-.81.64-1.46 1.45-1.46Z',
  ],
  // Ficha/plug minimalista para representar conectores/plugins/MCP/skills.
  Conectores: [
    'M9 3.3v4.1M15 3.3v4.1',
    'M7 7.55h10v3.1a5 5 0 0 1-5 5 5 5 0 0 1-5-5v-3.1Z',
    'M12 15.75v4.95',
  ],
  // Três linhas horizontais com controlos deslocados.
  Atividade: [
    'M2.8 5.1h7.05M14.1 5.1h7.1',
    'M12 2.9v4.4',
    'M2.8 12h4.5M11.5 12h9.7',
    'M9.4 9.8v4.4',
    'M2.8 18.9h11.1M18.1 18.9h3.1',
    'M16 16.7v4.4',
  ],
  // Utilizador/perfil, mantendo o mesmo estilo de traço fino da referência.
  Perfil: [
    'M12 11a3.6 3.6 0 1 0 0-7.2 3.6 3.6 0 0 0 0 7.2Z',
    'M4.55 19.6c1.55-2.95 4.28-4.4 7.45-4.4 3.17 0 5.9 1.45 7.45 4.4',
  ],
} satisfies Record<Tab, string[]>;

export function ReferenceTabIcon({ tab, active, size = 25 }: { tab: Tab; active: boolean; size?: number }) {
  const color = active ? '#090909' : '#858585';
  // Keep stable viewBox, 25pt icon and identical 2px line family on iOS/Android.
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    {strokes[tab].map((d, i) => <Path key={i} d={d} stroke={color} strokeWidth={active ? 2.15 : 1.85} strokeLinecap="round" strokeLinejoin="round" />)}
    {tab === 'Capture' && <Circle cx={12} cy={14.3} r={3.3} stroke={color} strokeWidth={active ? 2.15 : 1.85} />} 
  </Svg>;
}
