import React, { memo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';
import { C } from '../theme';

type FileKind =
  'pdf' | 'image' | 'video' | 'audio' | 'code' | 'archive' | 'document';
function presentation(
  name: string,
  mimeType = '',
): { kind: FileKind; label: string } {
  const extension = name.split('.').pop()?.toLowerCase() || '';
  const mime = mimeType.split(';')[0].trim().toLowerCase();
  if (mime === 'application/pdf' || extension === 'pdf')
    return { kind: 'pdf', label: 'PDF' };
  if (
    mime.startsWith('image/') ||
    /^(png|jpe?g|gif|webp|heic|avif|svg)$/.test(extension)
  )
    return { kind: 'image', label: 'Imagem' };
  if (mime.startsWith('video/') || /^(mp4|mov|webm|mkv)$/.test(extension))
    return { kind: 'video', label: 'Vídeo' };
  if (mime.startsWith('audio/') || /^(mp3|wav|m4a|ogg|flac)$/.test(extension))
    return { kind: 'audio', label: 'Áudio' };
  if (
    /^(zip|rar|7z|tar|gz)$/.test(extension) ||
    /zip|compressed|tar/.test(mime)
  )
    return {
      kind: 'archive',
      label: /^(zip|rar|7z|tar|gz)$/.test(extension)
        ? extension.toUpperCase()
        : 'Arquivo',
    };
  if (
    /^(js|jsx|ts|tsx|py|html|css|json|sh|sql|xml|yml|yaml)$/.test(extension) ||
    /json|javascript|xml/.test(mime)
  )
    return {
      kind: 'code',
      label: extension.toUpperCase().slice(0, 4) || 'Código',
    };
  const label = /spreadsheet|excel/.test(mime)
    ? 'XLSX'
    : /wordprocessing|msword/.test(mime)
      ? 'DOCX'
      : /presentation|powerpoint/.test(mime)
        ? 'PPTX'
        : /^(txt|md|csv|docx?|xlsx?|pptx?)$/.test(extension)
          ? extension.toUpperCase()
          : 'Ficheiro';
  return { kind: 'document', label };
}

export function fileCaption(file: {
  name: string;
  mimeType?: string;
  size?: number;
}) {
  const label = presentation(file.name, file.mimeType).label;
  const size = file.size;
  if (!size || !Number.isFinite(size) || size < 0) return label;
  const formatted =
    size < 1024
      ? size + ' B'
      : size < 1024 * 1024
        ? Math.ceil(size / 1024) + ' KB'
        : (size / (1024 * 1024)).toLocaleString('pt-PT', {
            maximumFractionDigits: 1,
          }) + ' MB';
  return label + ' · ' + formatted;
}

export const FileIcon = memo(function FileIcon({
  name,
  mimeType,
  size = 28,
  color = C.ink,
}: {
  name: string;
  mimeType?: string;
  size?: number;
  color?: string;
}) {
  const { kind, label } = presentation(name, mimeType);
  const compact = size < 24;
  return (
    <View
      testID={'file-icon-' + kind}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size * 0.875, height: size, flexShrink: 0 }}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 28 32"
        fill="none"
        accessible={false}
      >
        <Path
          d="M16 2H6a2 2 0 0 0-2 2v24a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V10L16 2Z"
          stroke={color}
          strokeWidth={1.4}
          strokeLinejoin="round"
          opacity={0.7}
        />
        <Path
          d="M16 2v6a2 2 0 0 0 2 2h6"
          stroke={color}
          strokeWidth={1.4}
          strokeLinejoin="round"
          opacity={0.7}
        />
        {kind === 'image' ? (
          <>
            <Circle cx={10} cy={16} r={1.5} fill={color} />
            <Path
              d="m7 25 5-6 3 3 3-4 3 7H7Z"
              stroke={color}
              strokeWidth={1.4}
              strokeLinejoin="round"
            />
          </>
        ) : kind === 'video' ? (
          <Path
            d="m11 16 7 5-7 5V16Z"
            stroke={color}
            strokeWidth={1.4}
            strokeLinejoin="round"
          />
        ) : kind === 'audio' ? (
          <Path
            d="M8 19v4m4-7v10m4-12v14m4-9v4"
            stroke={color}
            strokeWidth={1.6}
            strokeLinecap="round"
          />
        ) : kind === 'code' ? (
          <Path
            d="m10 17-4 4 4 4m8-8 4 4-4 4m-5 2 2-12"
            stroke={color}
            strokeWidth={1.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : kind === 'archive' ? (
          <Path
            d="M12 12h4m-4 4h4m-4 4h4m-4 4h4"
            stroke={color}
            strokeWidth={1.6}
            strokeLinecap="round"
          />
        ) : compact ? (
          <Path
            d="M8 17h12M8 21h12M8 25h8"
            stroke={color}
            strokeWidth={1.4}
            strokeLinecap="round"
          />
        ) : (
          <SvgText
            x={14}
            y={24}
            fill={color}
            fontSize={label.length > 3 ? 5.8 : 7}
            fontWeight="600"
            fontFamily="sans-serif"
            textAnchor="middle"
            letterSpacing={0.15}
          >
            {label === 'Ficheiro' ? 'FILE' : label}
          </SvgText>
        )}
      </Svg>
    </View>
  );
});
