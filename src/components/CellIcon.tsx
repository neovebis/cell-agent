import React, { memo } from 'react';
import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import images from '../catalog/icons.json';
import { cellDefinition } from '../services/cellCatalog';
import { C } from '../theme';
const assets: Record<string, string> = images;
function modelIcon(provider?: string) {
  const name = (provider || 'openai').toLowerCase();
  if (name === 'griot-neural') return 'model:griot-neural';
  const brands: [RegExp, string][] = [
    [/openai|chatgpt|^gpt/, 'openai'],
    [/anthropic|claude/, 'claude'],
    [/deepseek/, 'deepseek'],
    [/ollama/, 'ollama'],
    [/gemini|google/, 'gemini'],
    [/openrouter/, 'openrouter'],
    [/groq/, 'groq'],
    [/grok|xai|x-ai/, 'grok'],
  ];
  return (
    'model:' + (brands.find(([pattern]) => pattern.test(name))?.[1] || 'openai')
  );
}
export const CellIcon = memo(function CellIcon({
  type,
  icon,
  provider,
  size = 32,
}: {
  type: string;
  icon?: string;
  provider?: string;
  size?: number;
}) {
  const definition = cellDefinition(type);
  const key =
    definition?.canonicalType === 'model'
      ? modelIcon(provider)
      : icon || definition?.icon || 'lucide:circle-dot';
  return (
    <View testID="cell-icon" style={{ width: size, height: size }}>
      <SvgXml
        xml={assets[key] || assets['lucide:circle-dot']}
        width={size}
        height={size}
        color={C.ink}
      />
    </View>
  );
});
