import React, { useState } from 'react';
import { ActivityIndicator, Pressable, Switch, TextInput, View } from 'react-native';
import { Icon, Txt } from '../UI';
import { C } from '../../theme';
import type { UiAnswer, UiBlock } from '../../types';

export type InteractFn = (blockId: string, answer: UiAnswer) => Promise<void>;

type Props<T> = { b: T; answer?: UiAnswer; onInteract?: InteractFn };

const box = { backgroundColor: C.white, borderColor: C.border, borderWidth: 1, borderRadius: 16, padding: 11 } as const;
const input = {
  backgroundColor: C.surface,
  borderColor: C.border,
  borderWidth: 1,
  borderRadius: 14,
  paddingHorizontal: 11,
  minHeight: 38,
  fontSize: 12,
  color: C.ink,
} as const;

function Button({ label, onPress, primary, danger, disabled, loading }: { label: string; onPress: () => void; primary?: boolean; danger?: boolean; disabled?: boolean; loading?: boolean }) {
  const bg = danger ? C.error : primary ? C.ink : C.surface2;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      style={{
        backgroundColor: bg,
        borderColor: primary || danger ? bg : C.border,
        borderWidth: 1,
        borderRadius: 999,
        minHeight: 36,
        paddingHorizontal: 14,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {loading ? <ActivityIndicator size="small" color={primary || danger ? C.white : C.ink} /> : <Txt size={12} weight="600" color={primary || danger ? C.white : C.ink}>{label}</Txt>}
    </Pressable>
  );
}

function Answered({ answer }: { answer: UiAnswer }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 7 }}>
      <Icon name="checkmark-circle" size={15} color={C.success} />
      <Txt size={11} color={C.muted} style={{ flex: 1 }}>{answer.summary}</Txt>
    </View>
  );
}

function useSubmit(id: string, onInteract?: InteractFn) {
  const [loading, setLoading] = useState(false);
  const submit = async (answer: UiAnswer) => {
    if (loading || !onInteract) return;
    setLoading(true);
    try {
      await onInteract(id, answer);
    } finally {
      setLoading(false);
    }
  };
  return { loading, submit, disabled: !onInteract };
}

const Title = ({ t }: { t?: string }) => (t ? <Txt size={12} weight="700" style={{ marginBottom: 7 }}>{t}</Txt> : null);

export function ChoicesView({ b, answer, onInteract }: Props<Extract<UiBlock, { type: 'choices' }>>) {
  const [picked, setPicked] = useState<string[]>([]);
  const { loading, submit, disabled } = useSubmit(b.id, onInteract);
  const chosen = (answer?.values.selected as string[] | undefined) ?? picked;
  const send = (ids: string[]) => {
    const labels = b.options.filter((o) => ids.includes(o.id)).map((o) => o.label);
    submit({ action: 'select', values: { selected: ids, labels }, summary: `Escolhi: ${labels.join(', ')}` });
  };
  return (
    <View style={box}>
      <Title t={b.title} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {b.options.map((o) => {
          const sel = chosen.includes(o.id);
          return (
            <Pressable
              key={o.id}
              disabled={!!answer || loading || disabled}
              onPress={() => (b.multi ? setPicked((p) => (p.includes(o.id) ? p.filter((x) => x !== o.id) : [...p, o.id])) : send([o.id]))}
              style={{
                borderRadius: 999,
                borderWidth: 1,
                borderColor: sel ? C.ink : C.border,
                backgroundColor: sel ? C.ink : C.surface2,
                paddingHorizontal: 12,
                minHeight: 32,
                justifyContent: 'center',
                opacity: answer && !sel ? 0.45 : 1,
              }}
            >
              <Txt size={12} weight="600" color={sel ? C.white : C.ink}>{o.label}</Txt>
            </Pressable>
          );
        })}
      </View>
      {answer ? (
        <Answered answer={answer} />
      ) : b.multi ? (
        <View style={{ marginTop: 9, alignItems: 'flex-start' }}>
          <Button label={b.submit || 'Enviar'} primary disabled={!picked.length || disabled} loading={loading} onPress={() => send(picked)} />
        </View>
      ) : loading ? (
        <ActivityIndicator size="small" color={C.ink} style={{ marginTop: 7, alignSelf: 'flex-start' }} />
      ) : null}
    </View>
  );
}

export function ConfirmView({ b, answer, onInteract }: Props<Extract<UiBlock, { type: 'confirm' }>>) {
  const { loading, submit, disabled } = useSubmit(b.id, onInteract);
  const [which, setWhich] = useState<string | null>(null);
  const act = (action: 'approve' | 'reject') => {
    setWhich(action);
    submit({ action, values: {}, summary: action === 'approve' ? 'Aprovado' : 'Rejeitado' });
  };
  return (
    <View style={[box, b.tone === 'danger' && { borderColor: C.error }]}>
      <Title t={b.title} />
      <Txt size={12}>{b.text}</Txt>
      {answer ? (
        <Answered answer={answer} />
      ) : (
        <View style={{ flexDirection: 'row', gap: 7, marginTop: 9 }}>
          <Button label={b.approve || 'Aprovar'} primary={b.tone !== 'danger'} danger={b.tone === 'danger'} disabled={disabled} loading={loading && which === 'approve'} onPress={() => act('approve')} />
          <Button label={b.reject || 'Rejeitar'} disabled={disabled || loading} loading={loading && which === 'reject'} onPress={() => act('reject')} />
        </View>
      )}
    </View>
  );
}

export function FormView({ b, answer, onInteract }: Props<Extract<UiBlock, { type: 'form' }>>) {
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const { loading, submit, disabled } = useSubmit(b.id, onInteract);
  const shown = (answer?.values as Record<string, string | boolean> | undefined) ?? values;
  const set = (k: string, v: string | boolean) => setValues((p) => ({ ...p, [k]: v }));
  const missing = b.fields.some((f) => f.required && f.kind !== 'toggle' && !String(values[f.name] ?? '').trim());

  const send = () => {
    const out: Record<string, string | number | boolean> = {};
    const parts: string[] = [];
    for (const f of b.fields) {
      const raw = values[f.name];
      if (f.kind === 'toggle') out[f.name] = raw === true;
      else if (f.kind === 'number') {
        const n = Number(String(raw ?? '').replace(',', '.'));
        if (String(raw ?? '').trim() && Number.isFinite(n)) out[f.name] = n;
      } else if (String(raw ?? '').trim()) out[f.name] = String(raw).trim().slice(0, 500);
      if (out[f.name] !== undefined) parts.push(`${f.label}: ${out[f.name] === true ? 'Sim' : out[f.name] === false ? 'Não' : out[f.name]}`);
    }
    submit({ action: 'submit', values: out, summary: parts.length ? parts.join(' · ') : 'Formulário enviado' });
  };

  const locked = !!answer || loading;
  return (
    <View style={box}>
      <Title t={b.title} />
      <View style={{ gap: 8 }}>
        {b.fields.map((f) => (
          <View key={f.name}>
            <Txt size={11} weight="600" color={C.muted} style={{ marginBottom: 3 }}>
              {f.label}
              {f.required ? ' *' : ''}
            </Txt>
            {f.kind === 'toggle' ? (
              <Switch value={shown[f.name] === true} disabled={locked} onValueChange={(v) => set(f.name, v)} trackColor={{ true: C.ink, false: C.border }} />
            ) : f.kind === 'select' ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
                {(f.options || []).map((o) => {
                  const sel = String(shown[f.name] ?? '') === o;
                  return (
                    <Pressable
                      key={o}
                      disabled={locked}
                      onPress={() => set(f.name, o)}
                      style={{ borderRadius: 999, borderWidth: 1, borderColor: sel ? C.ink : C.border, backgroundColor: sel ? C.ink : C.surface2, paddingHorizontal: 11, minHeight: 30, justifyContent: 'center' }}
                    >
                      <Txt size={11} weight="600" color={sel ? C.white : C.ink}>{o}</Txt>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <TextInput
                editable={!locked}
                value={String(shown[f.name] ?? '')}
                onChangeText={(t) => set(f.name, t)}
                placeholder={f.placeholder}
                placeholderTextColor={C.faint}
                keyboardType={f.kind === 'number' ? 'numeric' : 'default'}
                style={[input, locked && { opacity: 0.6 }]}
              />
            )}
          </View>
        ))}
      </View>
      {answer ? (
        <Answered answer={answer} />
      ) : (
        <View style={{ marginTop: 10, alignItems: 'flex-start' }}>
          <Button label={b.submit || 'Enviar'} primary disabled={missing || disabled} loading={loading} onPress={send} />
        </View>
      )}
    </View>
  );
}
