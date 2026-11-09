import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import type { AgentMessage, AgentRun } from '../types';
import { C } from '../theme';
import { Icon, Txt } from './UI';

export function ThinkingBubble({ agentName }: { agentName: string }) {
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0.35))).current;
  useEffect(() => {
    let active = true;
    const animations: Animated.CompositeAnimation[] = [];
    void AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduced) => {
        if (!active || reduced) return;
        dots.forEach((value, index) => {
          const animation = Animated.loop(
            Animated.sequence([
              Animated.delay(index * 140),
              Animated.timing(value, {
                toValue: 0.9,
                duration: 380,
                useNativeDriver: true,
                isInteraction: false,
              }),
              Animated.timing(value, {
                toValue: 0.35,
                duration: 380,
                useNativeDriver: true,
                isInteraction: false,
              }),
            ]),
          );
          animations.push(animation);
          animation.start();
        });
      });
    return () => {
      active = false;
      animations.forEach((animation) => animation.stop());
    };
  }, [dots]);
  return (
    <View
      testID="chat-typing"
      accessibilityRole="progressbar"
      accessibilityLabel={agentName + ' está a responder'}
      style={styles.typing}
    >
      {dots.map((opacity, index) => (
        <Animated.View key={index} style={[styles.dot, { opacity }]} />
      ))}
    </View>
  );
}

export function MessageBubble({
  item,
  files = [],
  onFile,
  onError,
}: {
  item: AgentMessage;
  files?: AgentRun['generatedFiles'];
  onFile: (runId: string, fileId: string) => void;
  onError: (message: string) => void;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const offset = useRef(new Animated.Value(4)).current;
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const [copyOpen, setCopyOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const isUser = item.role === 'user';
  useEffect(() => {
    let active = true;
    let animation: Animated.CompositeAnimation | undefined;
    void AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduced) => {
        if (!active) return;
        if (reduced) {
          opacity.setValue(1);
          offset.setValue(0);
          return;
        }
        animation = Animated.parallel([
          Animated.timing(opacity, {
            toValue: 1,
            duration: 160,
            useNativeDriver: true,
            isInteraction: false,
          }),
          Animated.timing(offset, {
            toValue: 0,
            duration: 160,
            useNativeDriver: true,
            isInteraction: false,
          }),
        ]);
        animation.start();
      });
    return () => {
      active = false;
      animation?.stop();
      clearTimeout(copyTimer.current);
    };
  }, [opacity, offset]);
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
      testID={isUser ? 'user-message' : 'agent-message'}
      style={[
        styles.message,
        {
          alignItems: isUser ? 'flex-end' : 'flex-start',
          opacity,
          transform: [{ translateY: offset }],
        },
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
            {item.status === 'failed' ? 'Não enviado' : time}
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
}

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
  agentBody: { maxWidth: '100%', paddingVertical: 4 },
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
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 2,
    marginBottom: 10,
  },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.muted },
});
