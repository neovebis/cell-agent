import React, { memo, useRef, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import type { Agent } from '../types';
import { Card, PageTitle, RoundButton, Txt } from './UI';
import { LiveMotion } from './LiveMotion';
import { C } from '../theme';
export const AgentList = memo(function AgentList({
  agents,
  onOpen,
  onCreate,
  obscured,
}: {
  agents: Agent[];
  onOpen: (agent: Agent) => void;
  onCreate: () => void;
  obscured: boolean;
}) {
  const [visible, setVisible] = useState<Set<string>>(() => new Set());
  const viewability = useRef({
    itemVisiblePercentThreshold: 1,
    minimumViewTime: 80,
  }).current;
  const onViewable = useRef(
    ({
      viewableItems,
    }: {
      viewableItems: Array<{ item: Agent; isViewable: boolean }>;
    }) => {
      const next = new Set(
        viewableItems.filter((v) => v.isViewable).map((v) => v.item.id),
      );
      setVisible((old) =>
        old.size === next.size && [...old].every((id) => next.has(id))
          ? old
          : next,
      );
    },
  ).current;
  return (
    <FlatList
      data={agents}
      keyExtractor={(agent) => agent.id}
      extraData={{ visible, obscured }}
      initialNumToRender={7}
      maxToRenderPerBatch={5}
      windowSize={5}
      viewabilityConfig={viewability}
      onViewableItemsChanged={onViewable}
      contentContainerStyle={{
        padding: 20,
        paddingTop: 24,
        paddingBottom: 104,
      }}
      ListHeaderComponent={
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <PageTitle kicker="Espaço de Trabalho Ativo" title="Agentes" />
          <RoundButton
            icon="add"
            label="Criar novo agente"
            onPress={onCreate}
            size={40}
          />
        </View>
      }
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      renderItem={({ item: agent }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={'Abrir chat de ' + agent.name}
          onPress={() => onOpen(agent)}
        >
          <Card
            style={{
              padding: 14,
              minHeight: 74,
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <LiveMotion
              size={40}
              active={!obscured && visible.has(agent.id)}
              shape={agent.avatar?.shape ?? 'circle'}
              colorId={agent.avatar?.color ?? 'black'}
            />
            <View style={{ flex: 1, marginLeft: 12, gap: 3 }}>
              <Txt weight="600" size={16}>
                {agent.name}
              </Txt>
              <Txt color={C.muted} size={13} numberOfLines={1}>
                {agent.description}
              </Txt>
            </View>
          </Card>
        </Pressable>
      )}
      ListEmptyComponent={
        <Card style={{ padding: 20, gap: 8 }}>
          <Txt weight="700" size={17}>
            Nenhum agente no espaço
          </Txt>
          <Txt color={C.muted} size={14}>
            Os fluxos e agentes reais são carregados da tua base de dados
            Supabase. Toca no botão + acima para criar o teu primeiro agente
            autónomo.
          </Txt>
        </Card>
      }
    />
  );
});
