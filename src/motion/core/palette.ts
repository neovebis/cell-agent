// Motion color palette. Color selection never changes shapes, eyes, expressions or animation.
// Black is retained for backwards compatibility. The five additional colors are exact.
export const PALETTE = [
  { id: 'black', label: 'Preto', hex: '#000000' },
  { id: 'turquoise', label: 'Turquesa', hex: '#35F2E3' },
  { id: 'cyan', label: 'Ciano', hex: '#66E6FF' },
  { id: 'neonBlue', label: 'Azul neon', hex: '#5B8CFF' },
  { id: 'lilac', label: 'Lilás', hex: '#C59BFF' },
  { id: 'lightPurple', label: 'Roxo claro', hex: '#A97CFF' },
] as const;
export type ColorId = (typeof PALETTE)[number]['id'];

/** Accepts an id from PALETTE or a 3/6/8-digit CSS hex color. */
export function resolveBodyColor(value: string): string {
  const found = PALETTE.find(p => p.id === value);
  if (found) return found.hex;
  if (/^#(?:[a-f\d]{3}|[a-f\d]{6}|[a-f\d]{8})$/i.test(value)) return value;
  throw new RangeError(`Cor desconhecida: ${value}`);
}
