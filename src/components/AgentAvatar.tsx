import React from 'react';
import { Image, View } from 'react-native';

// Master artwork: the exact original file sent by the user, byte-for-byte.
// Original upload was named .png but contains JPEG bytes, therefore stored .jpg.
// Do not replace this with an SVG or a recreated approximation.
const ORIGINAL_LOGO = require('../assets/cell-agent-logo-original.jpg');

/** The image is merely displayed larger in a clipped square avatar.
 * No pixels of the source artwork, shapes, eyes or colors are modified.
 */
export function AgentAvatar({ size = 48 }: { size?: number; dark?: boolean }) {
  const zoom = 2.15; // black face occupies ~86% of avatar instead of ~40%
  const renderedSize = size * zoom;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Logo original do agente CELL"
      style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}
    >
      <Image
        source={ORIGINAL_LOGO}
        resizeMode="contain"
        style={{ width: renderedSize, height: renderedSize }}
        fadeDuration={0}
      />
    </View>
  );
}
