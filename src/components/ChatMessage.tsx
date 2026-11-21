import React, { memo, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import * as Clipboard from 'expo-clipboard';
import type { AgentMessage, AgentRun } from '../types';
import { C } from '../theme';
import { Icon, Txt } from './UI';

const NO_FILES: NonNullable<AgentRun['generatedFiles']> = [];

function ThinkingDot({
  phase,
  index,
  reduced,
}: {
  phase: SharedValue<number>;
  index: number;
  reduced: boolean;
}) {
  const motion = useAnimatedStyle(() => {
    const wave = reduced ? 0.5 : (Math.sin(phase.value - index * 0.85) + 1) / 2;
    return {
      opacity: 0.35 + wave * 0.6,
      transform: [
        { translateY: reduced ? 0 : -3.5 * wave },
        { scale: 0.82 + wave * 0.28 },
      ],
    };
  });
  return <Animated.View testID="typing-dot" style={[styles.dot, motion]} />;
}

export const ThinkingBubble = memo(function ThinkingBubble({
  agentName,
}: {
  agentName: string;
}) {
  const phase = useSharedValue(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    phase.value = reduced
      ? 0
      : withRepeat(
          withTiming(Math.PI * 2, { duration: 1350, easing: Easing.linear }),
          -1,
          false,
        );
    return () => cancelAnimation(phase);
  }, [phase, reduced]);
  return (
    <View
      testID="chat-typing"
      accessibilityRole="progressbar"
      accessibilityLabel={agentName + ' está a responder'}
      style={styles.typing}
    >
      {[0, 1, 2].map((index) => (
        <ThinkingDot
          key={index}
          phase={phase}
          index={index}
          reduced={reduced}
        />
      ))}
    </View>
  );
});

export const MessageBubble = memo(function MessageBubble({
  item,
  files = NO_FILES,
  animate = true,
  onFile,
  onError,
}: {
  item: AgentMessage;
  files?: AgentRun['generatedFiles'];
  animate?: boolean;
  onFile: (runId: string, fileId: string) => void;
  onError: (message: string) => void;
}) {
  const reduced = useReducedMotion();
  const opacity = useSharedValue(animate && !reduced ? 0 : 1);
  const offset = useSharedValue(animate && !reduced ? 6 : 0);
  const entrance = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: offset.value }],
  }));
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const [copyOpen, setCopyOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const isUser = item.role === 'user';
  useEffect(() => {
    const config = {
      duration: reduced || !animate ? 0 : 240,
      easing: Easing.out(Easing.cubic),
    };
    opacity.value = withTiming(1, config);
    offset.value = withTiming(0, config);
    return () => {
      cancelAnimation(opacity);
      cancelAnimation(offset);
    };
  }, [animate, reduced, opacity, offset]);
  useEffect(() => () => clearTimeout(copyTimer.current), []);
  const date = new Date(item.createdAt);
  const time = Number.isNaN(date.valueOf())
    ? ''
    : date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  const copy = async () => {
    try {
      await Clipboard.setStringAsync(item.content);
      setCopied(true);
      clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => {
        setCopied(false);
        setCopyOpen(false);
      }, 1200);
    } catch {
      onError('Não foi possível copiar a mensagem.');
    }
  };
  return (
    <Animated.View
      nativeID={item.id}
      testID={isUser ? 'user-message' : 'agent-message'}
      style={[
        styles.message,
        { alignItems: isUser ? 'flex-end' : 'flex-start' },
        entrance,
      ]}
    >
      {copyOpen && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Copiar mensagem"
          onPress={() => void copy()}
          style={styles.copy}
        >
          <Icon
            name={copied ? 'checkmark-outline' : 'copy-outline'}
            size={14}
          />
          <Txt size={12}>{copied ? 'Copiado' : 'Copiar'}</Txt>
        </Pressable>
      )}
      <Pressable
        onPress={() => {
          if (isUser) setCopyOpen((value) => !value);
        }}
        onLongPress={() => setCopyOpen(true)}
        style={[styles.body, isUser ? styles.userBody : styles.agentBody]}
      >
        {!!item.content && (
          <Txt
            size={14}
            color={isUser ? C.white : C.ink}
            style={{ lineHeight: 21 }}
          >
            {item.content}
          </Txt>
        )}
        {!!item.attachments?.length && (
          <View style={{ gap: 5, marginTop: 7 }}>
            {item.attachments.map((file, index) => (
              <View key={index} style={styles.attachment}>
                <Icon
                  name="document-attach-outline"
                  size={14}
                  color={isUser ? C.white : C.muted}
                />
                <Txt
                  size={12}
                  color={isUser ? C.white : C.muted}
                  numberOfLines={1}
                  style={{ flexShrink: 1 }}
                >
                  {file.name}
                </Txt>
              </View>
            ))}
          </View>
        )}
        {isUser && (
          <Txt
            size={9}
            color={item.status === 'failed' ? '#FFB4B4' : '#B9B9B9'}
            style={{ alignSelf: 'flex-end', marginTop: 3 }}
          >
            {item.status === 'failed' ? 'Por confirmar' : time}
          </Txt>
        )}
      </Pressable>
      {!isUser &&
        files.map((file) => (
          <Pressable
            key={file.id}
            accessibilityRole="button"
            accessibilityLabel={'Descarregar ' + file.name}
            onPress={() => item.runId && onFile(item.runId, file.id)}
            style={styles.file}
          >
            <Icon name="document-attach-outline" size={17} />
            <Txt size={13} numberOfLines={1} style={{ flex: 1 }}>
              {file.name}
            </Txt>
            <Icon name="download-outline" size={17} color={C.muted} />
          </Pressable>
        ))}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  message: { marginBottom: 18 },
  body: { maxWidth: '86%' },
  userBody: {
    backgroundColor: '#111111',
    borderRadius: 18,
    borderBottomRightRadius: 6,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  agentBody: {
    backgroundColor: C.surface2,
    borderRadius: 18,
    borderBottomLeftRadius: 6,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  attachment: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  file: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    minHeight: 44,
    maxWidth: '100%',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 13,
    paddingHorizontal: 12,
    marginTop: 7,
  },
  copy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 10,
    marginBottom: 4,
    backgroundColor: C.surface2,
    borderRadius: 18,
  },
  typing: {
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 3,
    borderRadius: 18,
    borderBottomLeftRadius: 6,
    backgroundColor: C.surface2,
    marginBottom: 10,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.ink },
});
