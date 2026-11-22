import React, { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import type { Agent, AgentMessage, AgentRun } from '../types';
import { MessageBubble, ThinkingBubble } from './ChatMessage';
import { ActivityBar } from './RunActivity';
import { LiveMotion } from './LiveMotion';
import { Txt } from './UI';
import { C } from '../theme';

export interface ChatActions {
  onFile: (runId: string, fileId: string) => void;
  onError: (message: string) => void;
  onRetry: (id: string) => void;
  onDiscard: (id: string) => void;
  onSettings: () => void;
  onActivity: () => void;
  onTrace: (id: string) => void;
}
const NO_FILES: NonNullable<AgentRun['generatedFiles']> = [];
const key = (item: AgentMessage) => item.id;

/** Draft keystrokes never invalidate the virtualized conversation. */
export const ChatTranscript = memo(function ChatTranscript({
  messages,
  runs,
  agent,
  busy,
  canSend,
  obscured,
  composerHeight,
  actions,
}: {
  messages: AgentMessage[];
  runs: AgentRun[];
  agent: Agent;
  busy: boolean;
  canSend: boolean;
  obscured: boolean;
  composerHeight: number;
  actions: ChatActions;
}) {
  const list = useRef<FlatList<AgentMessage>>(null),
    follow = useRef(true),
    painted = useRef(false),
    frame = useRef<number | undefined>(undefined);
  const reduced = useReducedMotion();
  const runsById = useMemo(
    () =>
      new Map(
        runs.filter((r) => r.workflowId === agent.id).map((r) => [r.id, r]),
      ),
    [runs, agent.id],
  );
  const replying =
    busy || runs.some((r) => ['queued', 'running'].includes(r.status));
  const working = runs
    .filter((r) => ['queued', 'running'].includes(r.status))
    .at(-1);
  const attention = runs
    .filter((r) => ['waiting_approval', 'paused'].includes(r.status))
    .at(-1);
  const showLiveBar =
    working &&
    !messages.some((m) => m.role === 'assistant' && m.runId === working.id);
  const scrollLatest = useCallback(() => {
    if (!follow.current) return;
    if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      list.current?.scrollToEnd({ animated: painted.current && !reduced });
      if (messages.length) painted.current = true;
    });
  }, [messages.length, reduced]);
  useEffect(
    () => () => {
      if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    },
    [],
  );
  const renderItem = useCallback(
    ({ item, index }: { item: AgentMessage; index: number }) => {
      const run = item.runId ? runsById.get(item.runId) : undefined;
      return (
        <View>
          <MessageBubble
            item={item}
            animate={index >= messages.length - 2}
            files={run?.generatedFiles || NO_FILES}
            run={run}
            onActivity={actions.onTrace}
            onFile={actions.onFile}
            onError={actions.onError}
          />
          {item.pendingId && item.status === 'failed' && (
            <View style={{ alignItems: 'flex-end', paddingBottom: 6 }}>
              <Txt size={12} color={C.error}>
                {item.error || 'O envio não ficou confirmado.'}
              </Txt>
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => actions.onDiscard(item.pendingId!)}
                style={{ padding: 12, minHeight: 44 }}
              >
                <Txt size={12} color={C.muted}>
                  Remover envio local
                </Txt>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => actions.onRetry(item.pendingId!)}
                style={{ padding: 12, minHeight: 44 }}
              >
                <Txt size={12} color={C.error}>
                  Repetir envio
                </Txt>
              </Pressable>
            </View>
          )}
          {item.role === 'user' &&
            item.runId &&
            (run?.files || []).map((file) => (
              <Pressable
                key={file.id}
                accessibilityRole="button"
                onPress={() => actions.onFile(item.runId!, file.id)}
                style={{ padding: 12, minHeight: 44 }}
              >
                <Txt size={12} color={C.muted}>
                  Abrir anexo · {file.name}
                </Txt>
              </Pressable>
            ))}
        </View>
      );
    },
    [runsById, messages.length, busy, actions],
  );
  return (
    <FlatList
      testID="chat-messages"
      ref={list}
      style={{ flex: 1 }}
      data={messages}
      keyExtractor={key}
      contentContainerStyle={{
        paddingHorizontal: 18,
        paddingTop: 68,
        paddingBottom: composerHeight + 16,
        flexGrow: 1,
      }}
      initialNumToRender={12}
      maxToRenderPerBatch={8}
      windowSize={7}
      updateCellsBatchingPeriod={32}
      keyboardShouldPersistTaps="handled"
      scrollEventThrottle={100}
      onScroll={(event) => {
        const { layoutMeasurement, contentOffset, contentSize } =
          event.nativeEvent;
        follow.current =
          contentSize.height - contentOffset.y - layoutMeasurement.height < 160;
      }}
      onLayout={scrollLatest}
      onContentSizeChange={scrollLatest}
      renderItem={renderItem}
      ListFooterComponent={
        <View style={{ paddingTop: 2 }}>
          {replying && (
            <View>
              <ThinkingBubble agentName={agent.name} />
              {showLiveBar && (
                <ActivityBar run={working} onOpen={actions.onTrace} />
              )}
            </View>
          )}
          {!!attention && (
            <View
              style={{
                gap: 1,
                paddingVertical: 4,
                marginBottom: 6,
                marginTop: 8,
              }}
            >
              <Txt size={13} color={C.muted}>
                {attention.status === 'paused'
                  ? 'Este pedido está em pausa.'
                  : attention.approval?.reason ||
                    'Preciso da tua autorização para continuar.'}
              </Txt>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  attention.status === 'paused'
                    ? 'Rever pedido em pausa'
                    : 'Rever autorização'
                }
                onPress={actions.onActivity}
                style={{
                  alignSelf: 'flex-start',
                  justifyContent: 'center',
                  minHeight: 44,
                }}
              >
                <Txt size={13} weight="500">
                  {attention.status === 'paused'
                    ? 'Rever pedido'
                    : 'Rever autorização'}{' '}
                  ↗
                </Txt>
              </Pressable>
            </View>
          )}
        </View>
      }
      ListEmptyComponent={
        !replying && !attention ? (
          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              marginBottom: 40,
            }}
          >
            <LiveMotion
              size={52}
              active={!obscured}
              shape={agent.avatar?.shape ?? 'circle'}
              colorId={agent.avatar?.color ?? 'black'}
            />
            <Txt size={22} weight="500" style={{ marginTop: 8 }}>
              Como posso ajudar?
            </Txt>
            <Txt
              size={13}
              color={C.muted}
              style={{
                textAlign: 'center',
                paddingHorizontal: 20,
                lineHeight: 20,
              }}
            >
              {canSend
                ? 'Escreve uma mensagem ou partilha um ficheiro.'
                : 'Escolhe o modelo nas opções para começar.'}
            </Txt>
            {!canSend && (
              <Pressable
                accessibilityRole="button"
                onPress={actions.onSettings}
                style={{ minHeight: 44, justifyContent: 'center' }}
              >
                <Txt size={13} weight="600">
                  Escolher modelo
                </Txt>
              </Pressable>
            )}
          </View>
        ) : null
      }
    />
  );
});
