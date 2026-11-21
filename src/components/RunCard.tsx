import React, { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import type { AgentRun, RunOperation, RunStatus } from '../types';
import { C } from '../theme';
import { Card, Icon, Txt } from './UI';

export const RUN_LABELS: Record<RunStatus, string> = {
  queued: 'Na fila',
  running: 'A trabalhar',
  paused: 'Em pausa',
  waiting_approval: 'Precisa da tua aprovação',
  success: 'Concluída',
  failed: 'Falhou',
  cancelled: 'Cancelada',
  expired: 'Prazo terminado',
};
export function RunCard({
  run,
  busy,
  onControl,
  onFile,
}: {
  run: AgentRun;
  busy?: boolean;
  onControl: (run: AgentRun, operation: RunOperation) => void;
  onFile: (runId: string, fileId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const approval = run.status === 'waiting_approval',
    working = ['queued', 'running'].includes(run.status);
  const action = run.approval?.action
    ? JSON.stringify(run.approval.action, null, 2)
    : '';
  const controls: {
    label: string;
    operation: RunOperation;
    primary?: boolean;
  }[] = approval
    ? [
        { label: 'Aprovar operação', operation: 'approve', primary: true },
        { label: 'Recusar e cancelar', operation: 'cancel' },
      ]
    : run.status === 'paused'
      ? [
          { label: 'Retomar', operation: 'resume', primary: true },
          { label: 'Cancelar', operation: 'cancel' },
        ]
      : working
        ? [
            { label: 'Pausar', operation: 'pause' },
            { label: 'Cancelar', operation: 'cancel' },
          ]
        : [];
  return (
    <Card
      style={{
        padding: 17,
        gap: 10,
        backgroundColor: approval ? '#FFF8E8' : C.surface,
        borderColor: approval ? '#EBD4A0' : C.border,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
        {working ? (
          <ActivityIndicator size="small" color={C.ink} />
        ) : (
          <Icon
            name={
              approval
                ? 'shield-checkmark-outline'
                : run.status === 'success'
                  ? 'checkmark-circle-outline'
                  : 'time-outline'
            }
            size={20}
            color={run.status === 'failed' ? C.error : C.ink}
          />
        )}
        <Txt size={14} weight="700" style={{ flex: 1 }}>
          {RUN_LABELS[run.status] || run.status}
        </Txt>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            expanded ? 'Recolher detalhes' : 'Ver detalhes da tarefa'
          }
          onPress={() => setExpanded((value) => !value)}
          style={{
            minHeight: 44,
            minWidth: 44,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={18} />
        </Pressable>
      </View>
      {!!(approval ? run.approval?.reason : run.summary) && (
        <Txt size={13} color={C.muted}>
          {approval ? run.approval?.reason : run.summary}
        </Txt>
      )}
      {run.retryAt && working && (
        <Txt size={12} color={C.muted}>
          À espera de capacidade · nova tentativa a partir de{' '}
          {new Date(run.retryAt).toLocaleTimeString('pt-PT')}
        </Txt>
      )}
      <Txt size={11} color={C.muted}>
        {run.modelCalls ?? 0} chamadas ao modelo · {run.toolCalls ?? 0}{' '}
        ferramentas usadas
      </Txt>
      {(expanded || approval) && (
        <View style={{ gap: 9 }}>
          {approval && !!action && (
            <View>
              <Txt size={12} weight="600">
                Operação a autorizar
              </Txt>
              <Text
                selectable
                style={{
                  fontSize: 12,
                  lineHeight: 18,
                  color: C.ink,
                  marginTop: 7,
                }}
              >
                {action.slice(0, 12000)}
              </Text>
              {action.length > 12000 && (
                <Txt color={C.error} size={12}>
                  O pedido é demasiado extenso para revisão nesta app. Podes
                  recusá-lo ou revê-lo no cliente original.
                </Txt>
              )}
            </View>
          )}
          {(run.observations || []).slice(-8).map((step, index) => (
            <View key={index} style={{ flexDirection: 'row', gap: 8 }}>
              <Icon
                name={
                  step.success
                    ? 'checkmark-circle-outline'
                    : 'alert-circle-outline'
                }
                size={16}
                color={step.success ? C.success : C.error}
              />
              <View style={{ flex: 1 }}>
                <Txt size={12} weight="600">
                  {step.tool || 'Operação'}
                </Txt>
                {!!step.error && (
                  <Txt size={12} color={C.error}>
                    {step.error}
                  </Txt>
                )}
              </View>
            </View>
          ))}
          <Txt size={11} color={C.faint}>
            Atualizada em {new Date(run.updatedAt).toLocaleString('pt-PT')}
          </Txt>
        </View>
      )}
      {(run.generatedFiles || []).map((file) => (
        <Pressable
          key={file.id}
          accessibilityRole="button"
          accessibilityLabel={`Descarregar ${file.name}`}
          onPress={() => onFile(run.id, file.id)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            backgroundColor: C.white,
            borderRadius: 16,
            padding: 13,
            minHeight: 50,
          }}
        >
          <Icon name="document-attach-outline" size={22} />
          <View style={{ flex: 1 }}>
            <Txt size={13} weight="600">
              {file.name}
            </Txt>
            <Txt size={11} color={C.muted}>
              {Math.max(1, Math.ceil(file.size / 1024))} KB · Ficheiro privado
            </Txt>
          </View>
          <Icon name="download-outline" size={20} />
        </Pressable>
      ))}
      {!!controls.length && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {controls.map((control) => (
            <Pressable
              key={control.operation}
              accessibilityRole="button"
              disabled={
                busy ||
                (control.operation === 'approve' &&
                  (!run.approvalHash || action.length > 12000))
              }
              onPress={() => onControl(run, control.operation)}
              style={{
                minHeight: 44,
                paddingHorizontal: 15,
                justifyContent: 'center',
                borderRadius: 22,
                backgroundColor: control.primary ? C.ink : C.white,
                borderWidth: 1,
                borderColor: C.border,
                opacity: busy ? 0.5 : 1,
              }}
            >
              <Txt
                size={12}
                weight="600"
                color={control.primary ? C.white : C.ink}
              >
                {control.label}
              </Txt>
            </Pressable>
          ))}
        </View>
      )}
    </Card>
  );
}
