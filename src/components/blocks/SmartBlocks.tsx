import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Icon, Txt } from '../UI';
import { C } from '../../theme';
import type { SmartUi, UiAnswer, UiBlock } from '../../types';
import { answerKey } from '../../services/smartui';
import { ChartView } from './SmartCharts';
import { ChoicesView, ConfirmView, FormView, type InteractFn } from './SmartInteractive';

const box = { backgroundColor: C.white, borderColor: C.border, borderWidth: 1, borderRadius: 16, padding: 11 } as const;

function Title({ children }: { children?: string }) {
  return children ? (
    <Txt size={12} weight="700" style={{ marginBottom: 7 }}>
      {children}
    </Txt>
  ) : null;
}

const toneColor = (t?: string) => (t === 'up' ? C.success : t === 'down' ? C.error : C.muted);

function Kpis({ b }: { b: Extract<UiBlock, { type: 'kpis' }> }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
      {b.items.map((k, i) => (
        <View key={i} style={[box, { flexGrow: 1, flexBasis: '45%' }]}>
          <Txt size={10} color={C.muted}>{k.label}</Txt>
          <Txt size={18} weight="700" style={{ marginTop: 2 }}>{k.value}</Txt>
          {!!k.delta && <Txt size={10} weight="600" color={toneColor(k.tone)}>{k.delta}</Txt>}
          {!!k.hint && <Txt size={10} color={C.faint}>{k.hint}</Txt>}
        </View>
      ))}
    </View>
  );
}

function Table({ b }: { b: Extract<UiBlock, { type: 'table' }> }) {
  return (
    <View style={box}>
      <Title>{b.title}</Title>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: C.border, paddingBottom: 5 }}>
            {b.columns.map((c) => (
              <Txt key={c.key} size={10} weight="700" color={C.muted} style={{ width: 96, textAlign: c.align }}>
                {c.label}
              </Txt>
            ))}
          </View>
          {b.rows.map((r, i) => (
            <View key={i} style={{ flexDirection: 'row', paddingVertical: 5, borderBottomWidth: i < b.rows.length - 1 ? 1 : 0, borderColor: C.surface2 }}>
              {b.columns.map((c) => (
                <Txt key={c.key} size={11} style={{ width: 96, textAlign: c.align }}>
                  {r[c.key] || '—'}
                </Txt>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function Bars({ b }: { b: Extract<UiBlock, { type: 'bars' }> }) {
  const max = Math.max(...b.items.map((i) => Math.abs(i.value)), 1);
  return (
    <View style={box}>
      <Title>{b.title}</Title>
      <View style={{ gap: 7 }}>
        {b.items.map((it, i) => (
          <View key={i}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Txt size={11} numberOfLines={1} style={{ flex: 1 }}>{it.label}</Txt>
              <Txt size={11} weight="600">{`${it.value}${b.unit || ''}`}</Txt>
            </View>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: C.surface2, marginTop: 3 }}>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: C.ink, width: `${(Math.abs(it.value) / max) * 100}%` }} />
            </View>
            {!!it.note && <Txt size={10} color={C.faint}>{it.note}</Txt>}
          </View>
        ))}
      </View>
    </View>
  );
}

function Steps({ b }: { b: Extract<UiBlock, { type: 'steps' }> }) {
  return (
    <View style={box}>
      <Title>{b.title}</Title>
      <View style={{ gap: 8 }}>
        {b.items.map((s, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center' }}>
              <Txt size={10} weight="700" color={C.white}>{String(i + 1)}</Txt>
            </View>
            <View style={{ flex: 1 }}>
              <Txt size={12} weight="600">{s.title}</Txt>
              {!!s.detail && <Txt size={11} color={C.muted}>{s.detail}</Txt>}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function Checklist({ b }: { b: Extract<UiBlock, { type: 'checklist' }> }) {
  const [done, setDone] = useState(() => b.items.map((i) => !!i.done));
  return (
    <View style={box}>
      <Title>{b.title}</Title>
      {b.items.map((it, i) => (
        <Pressable
          key={i}
          onPress={() => setDone((d) => d.map((v, j) => (j === i ? !v : v)))}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 }}
        >
          <Icon name={done[i] ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={done[i] ? C.ink : C.faint} />
          <Txt size={12} color={done[i] ? C.muted : C.ink} style={{ flex: 1, textDecorationLine: done[i] ? 'line-through' : 'none' }}>
            {it.label}
          </Txt>
        </Pressable>
      ))}
    </View>
  );
}

function Timeline({ b }: { b: Extract<UiBlock, { type: 'timeline' }> }) {
  return (
    <View style={box}>
      <Title>{b.title}</Title>
      {b.events.map((e, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ alignItems: 'center', width: 12 }}>
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                marginTop: 3,
                backgroundColor: e.state === 'next' ? C.white : C.ink,
                borderWidth: 2,
                borderColor: e.state === 'next' ? C.borderDark : C.ink,
              }}
            />
            {i < b.events.length - 1 && <View style={{ flex: 1, width: 2, backgroundColor: C.border }} />}
          </View>
          <View style={{ flex: 1, paddingBottom: 9 }}>
            {!!e.when && <Txt size={10} color={C.muted}>{e.when}</Txt>}
            <Txt size={12} weight={e.state === 'now' ? '700' : '600'}>{e.title}</Txt>
            {!!e.detail && <Txt size={11} color={C.muted}>{e.detail}</Txt>}
          </View>
        </View>
      ))}
    </View>
  );
}

function Block({ b, answer, onInteract }: { b: UiBlock; answer?: UiAnswer; onInteract?: InteractFn }) {
  switch (b.type) {
    case 'chart':
      return <ChartView b={b} />;
    case 'choices':
      return <ChoicesView b={b} answer={answer} onInteract={onInteract} />;
    case 'confirm':
      return <ConfirmView b={b} answer={answer} onInteract={onInteract} />;
    case 'form':
      return <FormView b={b} answer={answer} onInteract={onInteract} />;
    case 'prose':
      return <Txt size={12} style={{ lineHeight: 18 }}>{b.text}</Txt>;
    case 'callout':
      return (
        <View style={[box, { backgroundColor: C.surface }]}>
          {!!b.title && <Txt size={12} weight="700">{b.title}</Txt>}
          <Txt size={11} color={C.muted} style={{ marginTop: b.title ? 3 : 0 }}>{b.text}</Txt>
        </View>
      );
    case 'kpis':
      return <Kpis b={b} />;
    case 'table':
      return <Table b={b} />;
    case 'bars':
      return <Bars b={b} />;
    case 'steps':
      return <Steps b={b} />;
    case 'checklist':
      return <Checklist b={b} />;
    case 'timeline':
      return <Timeline b={b} />;
    default:
      return null;
  }
}

/** Renders a sanitized SmartUi below an assistant message. */
export function SmartUiView({
  ui,
  answers,
  onInteract,
}: {
  ui: SmartUi;
  /** Persisted answers keyed by answerKey(ui, blockId). */
  answers?: Record<string, UiAnswer>;
  /** Called with the answer key so the parent can persist and send it. */
  onInteract?: (key: string, blockId: string, answer: UiAnswer) => Promise<void>;
}) {
  return (
    <View style={{ marginTop: 8, gap: 8 }}>
      {(!!ui.kicker || !!ui.title) && (
        <View>
          {!!ui.kicker && <Txt size={10} color={C.muted} weight="600">{ui.kicker.toUpperCase()}</Txt>}
          {!!ui.title && <Txt size={15} weight="700">{ui.title}</Txt>}
        </View>
      )}
      {ui.blocks.map((b, i) => {
        const id = 'id' in b ? b.id : undefined;
        const key = id ? answerKey(ui, id) : '';
        return (
          <Block
            key={i}
            b={b}
            answer={id ? answers?.[key] : undefined}
            onInteract={id && onInteract ? (blockId, answer) => onInteract(key, blockId, answer) : undefined}
          />
        );
      })}
    </View>
  );
}
