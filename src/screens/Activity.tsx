import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { AgentSelector } from '../components/AgentSelector';
import { RunCard } from '../components/RunCard';
import { Card, Icon, PageTitle, Pill, Txt } from '../components/UI';
import { TERMINAL_STATUSES } from '../services/contracts';
import { C } from '../theme';
import type { Agent, AgentRun, RunOperation } from '../types';
type Props = {
  runs: AgentRun[];
  agent: Agent | null;
  agents: Agent[];
  onSelectAgent: (agent: Agent) => void;
  onRefresh: () => void;
  busyId: string | null;
  onControl: (run: AgentRun, operation: RunOperation) => void;
  onFile: (runId: string, fileId: string) => void;
};
export function ActivityScreen({
  runs,
  agent,
  agents,
  onSelectAgent,
  onRefresh,
  busyId,
  onControl,
  onFile,
}: Props) {
  const [filter, setFilter] = useState('Todas');
  const visible = [...runs]
    .reverse()
    .filter(
      (run) =>
        filter === 'Todas' ||
        (filter === 'Em curso'
          ? !TERMINAL_STATUSES.has(run.status)
          : filter === 'Concluídas'
            ? run.status === 'success'
            : ['failed', 'cancelled', 'expired'].includes(run.status)),
    );
  return (
    <ScrollView
      contentContainerStyle={{
        padding: 20,
        paddingTop: 24,
        paddingBottom: 104,
        gap: 14,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <PageTitle kicker="Missões e resultados" title="Atividade" />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Atualizar tarefas"
          onPress={onRefresh}
          style={{ padding: 12, minWidth: 44, minHeight: 44 }}
        >
          <Icon name="refresh-outline" />
        </Pressable>
      </View>
      <AgentSelector
        agents={agents}
        selected={agent?.id}
        onSelect={onSelectAgent}
      />
      {!!agent && (
        <Txt weight="600" size={14}>
          Tarefas de {agent.name}
        </Txt>
      )}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {['Todas', 'Em curso', 'Concluídas', 'Interrompidas'].map((value) => (
          <Pill
            key={value}
            selected={filter === value}
            onPress={() => setFilter(value)}
          >
            {value}
          </Pill>
        ))}
      </ScrollView>
      {!visible.length ? (
        <Card style={{ paddingVertical: 32, alignItems: 'center', gap: 10 }}>
          <Icon name="checkmark-circle-outline" color={C.muted} size={32} />
          <Txt color={C.muted}>Sem tarefas nesta seleção.</Txt>
        </Card>
      ) : (
        visible.map((run) => (
          <View key={run.id} style={{ gap: 8 }}>
            <Txt size={14} weight="600" numberOfLines={2}>
              {run.message || 'Pedido com anexo'}
            </Txt>
            <RunCard
              run={run}
              busy={busyId === run.id}
              onControl={onControl}
              onFile={onFile}
            />
          </View>
        ))
      )}
    </ScrollView>
  );
}
