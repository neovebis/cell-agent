import type { SmartUi, UiBlock, UiTone } from '../types';

/**
 * Smart UI (phase 1): client-side parser + sanitizer for structured agent replies.
 * Adapted from NEXO normalize.ts. Never throws; drops anything invalid; strips URLs/HTML.
 */

export const UI_INSTRUCTION_START = '[[CELL_UI_FORMAT]]';
export const UI_INSTRUCTION_END = '[[/CELL_UI_FORMAT]]';

export const UI_INSTRUCTION = `${UI_INSTRUCTION_START}
Formato opcional da resposta (app móvel CELL). Só quando ajudar (dados, listas, passos, comparações), responde APENAS com JSON:
{"reply":"texto curto","ui":{"v":1,"title":"","summary":"","blocks":[...]}}
Blocos: {"type":"prose","text":""} {"type":"callout","title":"","text":""} {"type":"kpis","items":[{"label":"","value":"","delta":"+4%","tone":"up|down|flat"}]} {"type":"table","columns":[{"key":"a","label":"A","align":"left|right"}],"rows":[{"a":""}]} {"type":"bars","unit":"%","items":[{"label":"","value":0}]} {"type":"steps","items":[{"title":"","detail":""}]} {"type":"checklist","items":[{"label":"","done":false}]} {"type":"timeline","events":[{"when":"","title":"","state":"done|now|next"}]}
Máx. 6 blocos, sem URLs nem HTML. Caso contrário responde em texto normal.
${UI_INSTRUCTION_END}`;

/** Appends the format instruction to an outgoing message. */
export function withUiInstruction(message: string): string {
  return `${message}\n\n${UI_INSTRUCTION}`;
}

/** Removes the instruction block from a message (for history shown to the user). */
export function stripUiInstruction(message: string): string {
  const i = message.indexOf(UI_INSTRUCTION_START);
  if (i < 0) return message;
  const j = message.indexOf(UI_INSTRUCTION_END, i);
  const tail = j < 0 ? '' : message.slice(j + UI_INSTRUCTION_END.length);
  return (message.slice(0, i) + tail).trimEnd();
}

const MAX_BLOCKS = 8;
const MAX_ITEMS = 12;
const MAX_ROWS = 20;
const MAX_COLS = 6;

function clean(value: unknown, max = 180): string {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  return String(value)
    .replace(/<[^>]*>/g, '')
    .replace(/\b(?:https?|ftp|file|javascript|data):\/?\/?\S*/gi, '')
    .replace(/\bwww\.\S+/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}
const opt = (value: unknown, max = 80) => clean(value, max) || undefined;
function num(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const tone = (v: unknown): UiTone | undefined => (v === 'up' || v === 'down' || v === 'flat' ? v : undefined);

function block(raw: unknown): UiBlock | null {
  const o = obj(raw);
  const title = opt(o.title);
  switch (o.type) {
    case 'prose': {
      const text = clean(o.text, 800);
      return text ? { type: 'prose', text } : null;
    }
    case 'callout': {
      const text = clean(o.text, 400);
      return text ? { type: 'callout', title, text } : null;
    }
    case 'kpis': {
      const items = arr(o.items)
        .slice(0, 6)
        .map((it) => {
          const x = obj(it);
          const label = clean(x.label, 40);
          const value = clean(x.value, 24);
          return label && value ? { label, value, delta: opt(x.delta, 16), hint: opt(x.hint, 60), tone: tone(x.tone) } : null;
        })
        .filter(<T,>(x: T | null): x is T => x !== null);
      return items.length ? { type: 'kpis', items } : null;
    }
    case 'table': {
      const columns = arr(o.columns)
        .slice(0, MAX_COLS)
        .map((c) => {
          const x = obj(c);
          const key = clean(x.key, 40);
          return key
            ? { key, label: clean(x.label, 40) || key, align: x.align === 'right' ? ('right' as const) : ('left' as const) }
            : null;
        })
        .filter(<T,>(x: T | null): x is T => x !== null);
      if (!columns.length) return null;
      const rows = arr(o.rows)
        .slice(0, MAX_ROWS)
        .map((r) => {
          const x = obj(r);
          const row: Record<string, string> = {};
          for (const c of columns) row[c.key] = clean(x[c.key], 80);
          return row;
        })
        .filter((r) => Object.values(r).some(Boolean));
      return rows.length ? { type: 'table', title, columns, rows } : null;
    }
    case 'bars': {
      const items = arr(o.items)
        .slice(0, MAX_ITEMS)
        .map((it) => {
          const x = obj(it);
          const label = clean(x.label, 40);
          const value = num(x.value);
          return label && value !== null ? { label, value, note: opt(x.note, 60) } : null;
        })
        .filter(<T,>(x: T | null): x is T => x !== null);
      return items.length ? { type: 'bars', title, unit: opt(o.unit, 8), items } : null;
    }
    case 'steps': {
      const items = arr(o.items)
        .slice(0, MAX_ITEMS)
        .map((it) => {
          const x = obj(it);
          const t = clean(x.title, 80);
          return t ? { title: t, detail: opt(x.detail, 200) } : null;
        })
        .filter(<T,>(x: T | null): x is T => x !== null);
      return items.length ? { type: 'steps', title, items } : null;
    }
    case 'checklist': {
      const items = arr(o.items)
        .slice(0, MAX_ITEMS)
        .map((it) => {
          const x = obj(it);
          const label = clean(x.label, 100);
          return label ? { label, done: x.done === true } : null;
        })
        .filter(<T,>(x: T | null): x is T => x !== null);
      return items.length ? { type: 'checklist', title, items } : null;
    }
    case 'timeline': {
      const events = arr(o.events)
        .slice(0, MAX_ITEMS)
        .map((it) => {
          const x = obj(it);
          const t = clean(x.title, 80);
          const state: 'done' | 'now' | 'next' | undefined =
            x.state === 'done' || x.state === 'now' || x.state === 'next' ? x.state : undefined;
          return t ? { when: clean(x.when, 30), title: t, detail: opt(x.detail, 200), state } : null;
        })
        .filter(<T,>(x: T | null): x is T => x !== null);
      return events.length ? { type: 'timeline', title, events } : null;
    }
    default:
      return null;
  }
}

/** Sanitizes a raw ui/artifact object. Returns null if no valid block remains. */
export function sanitizeUi(raw: unknown): SmartUi | null {
  try {
    const o = obj(raw);
    const blocks: UiBlock[] = [];
    for (const b of arr(o.blocks)) {
      const ob = obj(b);
      // Flatten NEXO containers (columns / app screens) into their leaf blocks
      const nested =
        ob.type === 'columns' ? arr(ob.blocks) : ob.type === 'app' ? arr(ob.screens).flatMap((s) => arr(obj(s).blocks)) : [b];
      for (const n of nested) {
        const leaf = block(n);
        if (leaf) blocks.push(leaf);
        if (blocks.length >= MAX_BLOCKS) break;
      }
      if (blocks.length >= MAX_BLOCKS) break;
    }
    if (!blocks.length) return null;
    return { v: 1, title: opt(o.title), kicker: opt(o.kicker, 40), summary: opt(o.summary, 240), blocks };
  } catch {
    return null;
  }
}

function tryJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Finds a JSON object in free text: whole string, ```json fence, or first balanced {...}. */
function findJson(text: string): unknown {
  const t = text.trim();
  if (t.startsWith('{')) {
    const whole = tryJson(t);
    if (whole !== undefined) return whole;
  }
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    const f = tryJson(fence[1].trim());
    if (f !== undefined) return f;
  }
  const start = t.indexOf('{');
  if (start < 0) return undefined;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < t.length; i++) {
    const ch = t[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return tryJson(t.slice(start, i + 1));
  }
  return undefined;
}

/**
 * Turns an agent output (string or jsonb object) into { text, ui? }.
 * Accepts {reply|text|answer, ui|artifact}. Falls back to the original text unchanged.
 */
export function parseAgentOutput(out: unknown): { text: string; ui?: SmartUi } {
  try {
    const fallback = typeof out === 'string' ? out : JSON.stringify(out, null, 2);
    const candidate = typeof out === 'string' ? findJson(out) : out;
    const o = obj(candidate);
    const rawUi = o.ui ?? o.artifact;
    if (rawUi === undefined) {
      // Plain object with a text field (e.g. final_output = {answer: "..."})
      const t = typeof out !== 'string' ? o.reply ?? o.text ?? o.answer : undefined;
      return { text: typeof t === 'string' ? t : fallback };
    }
    const ui = sanitizeUi(rawUi);
    const reply = clean(o.reply ?? o.text ?? o.answer, 2000);
    if (!ui) return { text: reply || fallback };
    // Keep any prose the agent wrote around the JSON
    let text = reply;
    if (!text && typeof out === 'string') {
      text = out.replace(/```(?:json)?[\s\S]*?```/gi, '').replace(/\{[\s\S]*\}/, '').trim();
    }
    return { text: text || ui.summary || ui.title || '', ui };
  } catch {
    return { text: typeof out === 'string' ? out : String(out ?? '') };
  }
}
