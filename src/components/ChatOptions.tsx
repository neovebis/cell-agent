import React, { useEffect, useRef } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
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
  const insets = useSafeAreaInsets();
  const pending = useRef<(() => void) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const finish = () => {
    const action = pending.current;
    pending.current = null;
    action?.();
  };
  useEffect(() => {
    if (visible) pending.current = null;
  }, [visible]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const select = (action: () => void) => {
    pending.current = action;
    onClose();
    // iOS needs the first native modal to finish dismissing before opening settings.
    if (Platform.OS !== 'ios') timer.current = setTimeout(finish, 0);
  };
  const items = [
    {
      label: 'Configurar modelo',
      icon: 'options-outline' as const,
      action: onModel,
    },
    {
      label: 'Capacidades',
      icon: 'extension-puzzle-outline' as const,
      action: onTools,
    },
    { label: 'Tarefas', icon: 'list-outline' as const, action: onActivity },
    {
      label: isPrimary ? 'Agente principal' : 'Definir como principal',
      icon: 'checkmark-circle-outline' as const,
      action: onPrimary,
      disabled: isPrimary,
    },
  ];
  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
      onDismiss={finish}
    >
      <View style={styles.layer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fechar opções"
          onPress={onClose}
          style={styles.backdrop}
        />
        <View
          testID="chat-options-menu"
          style={[styles.sheet, { top: insets.top + 54 }]}
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
        </View>
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
