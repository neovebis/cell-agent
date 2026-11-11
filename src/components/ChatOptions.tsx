import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../theme';
import { Icon, Txt } from './UI';
export function ChatOptions({
  visible,
  agentName,
  isPrimary,
  onClose,
  onModel,
  onTools,
  onActivity,
  onPrimary,
}: {
  visible: boolean;
  agentName: string;
  isPrimary: boolean;
  onClose: () => void;
  onModel: () => void;
  onTools: () => void;
  onActivity: () => void;
  onPrimary: () => void;
}) {
  const insets = useSafeAreaInsets(),
    [presented, setPresented] = useState(visible);
  const phase = useSharedValue(visible ? 1 : 0),
    pending = useRef<(() => void) | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hide = useCallback(() => setPresented(false), []);
  const finish = useCallback(() => {
    const action = pending.current;
    pending.current = null;
    action?.();
  }, []);
  useEffect(() => {
    if (visible) {
      pending.current = null;
      setPresented(true);
      phase.value = withTiming(1, {
        duration: 150,
        easing: Easing.out(Easing.cubic),
      });
    } else
      phase.value = withTiming(
        0,
        { duration: 90, easing: Easing.in(Easing.quad) },
        (done) => {
          if (done) runOnJS(hide)();
        },
      );
    return () => cancelAnimation(phase);
  }, [visible, phase, hide]);
  useEffect(() => {
    if (!presented && Platform.OS !== 'ios')
      timer.current = setTimeout(finish, 0);
    return () => clearTimeout(timer.current);
  }, [presented, finish]);
  const backdrop = useAnimatedStyle(() => ({ opacity: phase.value }));
  const entrance = useAnimatedStyle(() => ({
    opacity: phase.value,
    transform: [
      { translateY: -6 * (1 - phase.value) },
      { scale: 0.96 + phase.value * 0.04 },
    ],
  }));
  const select = (action: () => void) => {
    pending.current = action;
    onClose();
  };
  const items = [
    {
      label: 'Configurar modelo',
      icon: 'options-outline' as const,
      action: onModel,
      disabled: false,
    },
    {
      label: 'Capacidades',
      icon: 'extension-puzzle-outline' as const,
      action: onTools,
      disabled: false,
    },
    {
      label: 'Tarefas',
      icon: 'list-outline' as const,
      action: onActivity,
      disabled: false,
    },
    {
      label: isPrimary ? 'Agente principal' : 'Definir como principal',
      icon: 'checkmark-circle-outline' as const,
      action: onPrimary,
      disabled: isPrimary,
    },
  ];
  return (
    <Modal
      visible={presented}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
      onDismiss={finish}
    >
      <View style={styles.layer}>
        <Animated.View
          pointerEvents="none"
          style={[styles.backdrop, backdrop]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fechar opções"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View
          testID="chat-options-menu"
          style={[styles.sheet, { top: insets.top + 64 }, entrance]}
        >
          <Txt
            size={12}
            color={C.muted}
            numberOfLines={1}
            style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: 5 }}
          >
            {agentName}
          </Txt>
          {items.map((item) => (
            <Pressable
              key={item.label}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              disabled={item.disabled}
              onPress={() => select(item.action)}
              style={({ pressed }) => [
                styles.item,
                pressed && { backgroundColor: C.surface2 },
                item.disabled && { opacity: 0.5 },
              ]}
            >
              <Icon name={item.icon} size={18} color={C.muted} />
              <Txt size={13} weight="500" style={{ flex: 1 }}>
                {item.label}
              </Txt>
            </Pressable>
          ))}
        </Animated.View>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  layer: { flex: 1 },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  sheet: {
    position: 'absolute',
    right: 12,
    width: 232,
    padding: 5,
    backgroundColor: C.white,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
});
