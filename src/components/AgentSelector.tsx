import React from 'react';
import { ScrollView } from 'react-native';
import type { Agent } from '../types';
import { Pill } from './UI';
export function AgentSelector({
  agents,
  selected,
  onSelect,
}: {
  agents: Agent[];
  selected?: string;
  onSelect: (agent: Agent) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingBottom: 14 }}
    >
      {agents.map((agent) => (
        <Pill
          key={agent.id}
          selected={agent.id === selected}
          onPress={() => onSelect(agent)}
        >
          {agent.name}
        </Pill>
      ))}
    </ScrollView>
  );
}
