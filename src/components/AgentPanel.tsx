import React, { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeInRight,
  FadeOutRight,
  ReduceMotion,
} from 'react-native-reanimated';
import type { Agent } from '../types';
import { C } from '../theme';
import { LiveMotion } from './LiveMotion';
import { RoundButton, Txt } from './UI';
const enter = FadeInRight.duration(180)
  .easing(Easing.out(Easing.cubic))
  .reduceMotion(ReduceMotion.System);
const exit = FadeOutRight.duration(130).reduceMotion(ReduceMotion.System);
export function AgentPanel({
  agent,
  kind,
  onClose,
  children,
}: {
  agent: Agent;
  kind: 'tasks' | 'tools';
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Animated.View
      testID={kind === 'tasks' ? 'agent-task-panel' : 'agent-capability-panel'}
      accessibilityViewIsModal
      entering={enter}
      exiting={exit}
      style={styles.panel}
    >
      <View style={styles.header}>
        <RoundButton
          icon="arrow-back"
          size={40}
          label="Voltar à conversa"
          onPress={onClose}
        />
        <View style={styles.identity}>
          <LiveMotion
            size={24}
            shape={agent.avatar?.shape ?? 'circle'}
            colorId={agent.avatar?.color ?? 'black'}
          />
          <Txt
            size={14}
            weight="600"
            numberOfLines={1}
            style={{ flexShrink: 1 }}
          >
            {agent.name}
          </Txt>
        </View>
        <View style={{ width: 40 }} />
      </View>
      {children}
    </Animated.View>
  );
}
const styles = StyleSheet.create({
  panel: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: C.white,
    zIndex: 10,
  },
  header: {
    minHeight: 60,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  identity: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
});
