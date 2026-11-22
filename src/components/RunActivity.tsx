import React, { memo, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from 'react-native-reanimated';
import type { AgentRun } from '../types';
import {
  activityLabel,
  buildRunActivity,
  publicActivityText,
  type ActivityEntry,
  type RunActivity,
} from '../services/runActivity';
import { C } from '../theme';
import { Icon, RoundButton, Txt } from './UI';

export const ActivityBar = memo(function ActivityBar({
  run,
  onOpen,
  width,
  attached = false,
}: {
  run: AgentRun;
  onOpen: (id: string) => void;
  width?: number;
  attached?: boolean;
}) {
  const label = activityLabel(run);
  const showLabel = width === undefined || width >= 100;
  const showIcon = width === undefined || width >= 48;
  return (
    <Pressable
      testID="run-activity-bar"
      accessibilityRole="button"
      accessibilityLabel={'Ver atividade da resposta: ' + label}
      onPress={() => onOpen(run.id)}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      style={[
        styles.bar,
        attached && styles.attachedBar,
        width !== undefined && { width },
        !showLabel && { paddingHorizontal: 6, justifyContent: 'center' },
      ]}
    >
      {showIcon && (
        <Icon
          name={
            ['queued', 'running'].includes(run.status)
              ? 'time-outline'
              : 'list-outline'
          }
          size={13}
          color={C.muted}
        />
      )}
      {showLabel && (
        <Txt
          size={11}
          color={C.muted}
          numberOfLines={1}
          style={{ flex: 1, lineHeight: 15 }}
        >
          {label}
        </Txt>
      )}
      <Icon name="chevron-forward" size={11} color={C.muted} />
    </Pressable>
  );
});

const ActivityRow = memo(function ActivityRow({
  entry,
  onFile,
}: {
  entry: ActivityEntry;
  onFile: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const interactive = !!(entry.detail || entry.fileId);
  return (
    <View style={styles.row}>
      <View style={styles.rail}>
        <View style={styles.marker}>
          <Icon
            name={
              entry.failed
                ? 'alert-circle-outline'
                : entry.kind === 'file'
                  ? 'document-outline'
                  : entry.kind === 'tool'
                    ? 'terminal-outline'
                    : 'ellipse'
            }
            size={entry.kind === 'progress' ? 7 : 16}
            color={entry.failed ? C.error : C.muted}
          />
        </View>
        <View style={styles.line} />
      </View>
      <View style={{ flex: 1, minWidth: 0, paddingBottom: 18 }}>
        <Pressable
          disabled={!interactive}
          accessibilityRole={interactive ? 'button' : undefined}
          accessibilityState={entry.detail ? { expanded } : undefined}
          onPress={() =>
            entry.fileId ? onFile(entry.fileId) : setExpanded((v) => !v)
          }
          style={styles.rowTitle}
        >
          <Txt
            size={13}
            weight={entry.kind === 'progress' ? '400' : '500'}
            color={entry.failed ? C.error : C.ink}
            style={{ flex: 1, lineHeight: 20 }}
          >
            {entry.title}
          </Txt>
          {interactive && (
            <Icon
              name={
                entry.fileId
                  ? 'download-outline'
                  : expanded
                    ? 'chevron-up'
                    : 'chevron-down'
              }
              size={15}
              color={C.muted}
            />
          )}
        </Pressable>
        {!!entry.time && !Number.isNaN(Date.parse(entry.time)) && (
          <Txt size={10} color={C.faint}>
            {new Date(entry.time).toLocaleTimeString('pt-PT', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Txt>
        )}
        {expanded && !!entry.detail && (
          <View style={styles.detail}>
            <Text
              selectable
              style={{
                fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
                fontSize: 11,
                lineHeight: 17,
                color: C.ink,
              }}
            >
              {entry.detail}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
});

export function RunActivitySheet({
  run,
  agentName,
  onClose,
  onFile,
  onError,
}: {
  run: AgentRun | null;
  agentName: string;
  onClose: () => void;
  onFile: (runId: string, fileId: string) => void;
  onError: (message: string) => void;
}) {
  const insets = useSafeAreaInsets(),
    reduced = useReducedMotion();
  const [loaded, setLoaded] = useState<{
    id: string;
    activity: RunActivity;
  } | null>(null);
  useEffect(() => {
    if (!run) {
      setLoaded(null);
      return;
    }
    const frame = requestAnimationFrame(() =>
      setLoaded({ id: run.id, activity: buildRunActivity(run) }),
    );
    return () => cancelAnimationFrame(frame);
  }, [run]);
  if (!run) return null;
  const activity = loaded?.id === run.id ? loaded.activity : null;
  const openSource = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      onError('Não foi possível abrir esta fonte.');
    }
  };
  return (
    <Modal
      visible
      transparent
      animationType={reduced ? 'none' : 'slide'}
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={styles.modal}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fechar atividade"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View
          testID="run-activity-sheet"
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              paddingBottom: Math.max(insets.bottom, 12),
              height: '82%',
              maxHeight: '86%',
            },
          ]}
        >
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1, gap: 3 }}>
              <Txt size={17} weight="600">
                Atividade do agente
              </Txt>
              <Txt size={12} color={C.muted} numberOfLines={1}>
                {agentName} · {activityLabel(run)}
              </Txt>
            </View>
            <RoundButton
              icon="close"
              label="Fechar detalhes da atividade"
              size={34}
              onPress={onClose}
            />
          </View>
          {!!run.summary && (
            <Txt
              size={12}
              color={C.muted}
              style={{
                paddingHorizontal: 18,
                paddingBottom: 12,
                lineHeight: 18,
              }}
            >
              {publicActivityText(run.summary, 500)}
            </Txt>
          )}
          {!activity ? (
            <ActivityIndicator color={C.ink} style={{ padding: 32 }} />
          ) : (
            <FlatList
              testID="activity-timeline"
              data={activity.entries}
              keyExtractor={(entry) => entry.id}
              initialNumToRender={10}
              maxToRenderPerBatch={8}
              windowSize={5}
              contentContainerStyle={{
                paddingHorizontal: 18,
                paddingTop: 8,
                paddingBottom: 8,
              }}
              renderItem={({ item, index }) => (
                <View>
                  {item.kind === 'progress' &&
                    activity.entries[index - 1]?.kind !== 'progress' && (
                      <Txt
                        size={11}
                        weight="500"
                        color={C.muted}
                        style={{ marginBottom: 12 }}
                      >
                        Progresso partilhado
                      </Txt>
                    )}
                  <ActivityRow
                    entry={item}
                    onFile={(id) => onFile(run.id, id)}
                  />
                </View>
              )}
              ListEmptyComponent={
                <Txt
                  size={13}
                  color={C.muted}
                  style={{ paddingVertical: 20, lineHeight: 20 }}
                >
                  Sem registos adicionais para este pedido.
                </Txt>
              }
              ListFooterComponent={
                activity.sources.length ? (
                  <View
                    testID="activity-sources"
                    style={{ paddingTop: 6, paddingBottom: 12, gap: 7 }}
                  >
                    <Txt size={13} weight="500" style={{ marginBottom: 4 }}>
                      Fontes · {activity.sources.length}
                    </Txt>
                    {activity.sources.map((source) => (
                      <Pressable
                        key={source.url}
                        accessibilityRole="link"
                        accessibilityLabel={'Abrir fonte: ' + source.title}
                        onPress={() => void openSource(source.url)}
                        style={styles.source}
                      >
                        <Icon name="globe-outline" size={17} color={C.muted} />
                        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                          <Txt size={12} numberOfLines={2}>
                            {source.title}
                          </Txt>
                          <Txt size={10} color={C.muted} numberOfLines={1}>
                            {source.host}
                          </Txt>
                        </View>
                        <Icon name="open-outline" size={14} color={C.muted} />
                      </Pressable>
                    ))}
                  </View>
                ) : null
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    maxWidth: '86%',
    minHeight: 28,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#EAEAEA',
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
  },
  attachedBar: {
    marginTop: -5,
    paddingTop: 10,
    minHeight: 33,
  },
  modal: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  sheet: {
    backgroundColor: C.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    flexShrink: 1,
    overflow: 'hidden',
  },
  handle: {
    width: 32,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.border,
    alignSelf: 'center',
    marginTop: 9,
    marginBottom: 5,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 18,
    paddingTop: 10,
    paddingBottom: 14,
  },
  row: { flexDirection: 'row', gap: 11 },
  rail: { width: 27, alignItems: 'center' },
  marker: {
    width: 27,
    height: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: {
    width: 1,
    flex: 1,
    backgroundColor: C.border,
    minHeight: 7,
    marginTop: 2,
    marginBottom: 2,
  },
  rowTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    minHeight: 32,
  },
  detail: {
    backgroundColor: C.surface2,
    borderRadius: 12,
    padding: 11,
    marginTop: 8,
  },
  source: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    padding: 12,
    minHeight: 50,
  },
});
