import type { SmartUi, UiBlock, UiTone } from '../types';

/**
 * Smart UI (phase 1): client-side parser + sanitizer for structured agent replies.
 * Adapted from NEXO normalize.ts. Never throws; drops anything invalid; strips URLs/HTML.
 */

export const UI_INSTRUCTION_START = '[[CELL_UI_FORMAT]]';
export const UI_INSTRUCTION_END = '[[/CELL_UI_FORMAT]]';
export const INTERACTION_START = '[[CELL_UI_INTERACTION]]';
export const INTERACTION_END = '[[/CELL_UI_INTERACTION]]';

export const UI_INSTRUCTION = `${UI_INSTRUCTION_START}
Formato opcional (app móvel CELL). Só quando ajudar, responde APENAS com JSON:
{"reply":"texto curto","ui":{"v":1,"title":"","blocks":[...]}}
Blocos: prose{text} callout{title,text} kpis{items:[{label,value,delta,tone:up|down|flat}]} table{columns:[{key,label}],rows:[{}]} bars{unit,items:[{label,value}]} steps{items:[{title,detail}]} checklist{items:[{label,done}]} timeline{events:[{when,title,state:done|now|next}]} chart{kind:bar|line|area|pie,xKey,series:[{key,label}],data:[{}]}
Interativos (só se precisares de decisão/dados do utilizador; "id" único): choices{id,multi,options:[{id,label}]} confirm{id,text,approve,reject,tone:"danger"} form{id,submit,fields:[{name,label,kind:text|number|select|toggle,options,required}]}
A resposta do utilizador chega como ${INTERACTION_START}{"blockId","action","values"}${INTERACTION_END}.
Máx. 6 blocos, sem URLs nem HTML. Caso contrário responde em texto normal.
${UI_INSTRUCTION_END}`;

/** Appends the format instruction to an outgoing message. */
export function withUiInstruction(message: string): string {
  return `${message}\n\n${UI_INSTRUCTION}`;
}

/** Removes the instruction block from a message (for history shown to the user). */
function stripBetween(message: string, start: string, end: string): string {
  let out = message;
  for (let guard = 0; guard < 5; guard++) {
    const i = out.indexOf(start);
    if (i < 0) break;
    const j = out.indexOf(end, i);
    out = out.slice(0, i) + (j < 0 ? '' : out.slice(j + end.length));
  }
  return out;
}

/** Removes the hidden format and interaction blocks (for what the user sees). */
export function stripUiInstruction(message: string): string {
  if (!message.includes('[[CELL_UI_')) return message;
  return stripBetween(stripBetween(message, UI_INSTRUCTION_START, UI_INSTRUCTION_END), INTERACTION_START, INTERACTION_END).trim();
}

/** Readable summary + hidden machine-readable interaction payload for the agent. */
export function buildInteractionMessage(summary: string, blockId: string, action: string, values: Record<string, unknown>): string {
  return `${summary}\n\n${INTERACTION_START}${JSON.stringify({ blockId, action, values })}${INTERACTION_END}`;
}

/** Extracts the interaction payload from a message (used by tests / future features). */
export function parseInteraction(message: string): { blockId: string; action: string; values: Record<string, unknown> } | null {
  const i = message.indexOf(INTERACTION_START);
  const j = message.indexOf(INTERACTION_END, i);
  if (i < 0 || j < 0) return null;
  const o = obj(tryJson(message.slice(i + INTERACTION_START.length, j)));
  return typeof o.blockId === 'string' && typeof o.action === 'string' ? { blockId: o.blockId, action: o.action, values: obj(o.values) } : null;
}

/** Stable key for persisting an answer: block id + hash of the ui content. */
export function answerKey(ui: SmartUi, blockId: string): string {
  const str = JSON.stringify(ui.blocks);
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return `${blockId}:${(h >>> 0).toString(36)}`;
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

function block(raw: unknown, index = 0): UiBlock | null {
  const o = obj(raw);
  const id = clean(o.id, 40).replace(/[^\w-]/g, '') || `b${index}`;
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
    case 'chart': {
      const kind = o.kind === 'line' || o.kind === 'area' || o.kind === 'pie' ? o.kind : o.kind === 'bar' ? 'bar' : null;
      const xKey = clean(o.xKey, 40);
      const series = arr(o.series)
        .slice(0, 4)
        .map((x) => {
          const so = obj(x);
          const key = clean(so.key, 40);
          return key ? { key, label: clean(so.label, 40) || key } : null;
        })
        .filter(<T,>(x: T | null): x is T => x !== null);
      if (!kind || !xKey || !series.length) return null;
      const data = arr(o.data)
        .slice(0, 24)
        .map((r) => {
          const ro = obj(r);
          const row: Record<string, string | number> = { [xKey]: clean(ro[xKey], 24) };
          for (const sr of series) row[sr.key] = num(ro[sr.key]) ?? 0;
          return row;
        })
        .filter((r) => r[xKey] !== '');
      return data.length ? { type: 'chart', title, kind, xKey, series: kind === 'pie' ? series.slice(0, 1) : series, data } : null;
    }
    case 'choices': {
      const options = arr(o.options)
        .slice(0, 10)
        .map((x, i) => {
          if (typeof x === 'string') return clean(x, 60) ? { id: `o${i}`, label: clean(x, 60) } : null;
          const xo = obj(x);
          const label = clean(xo.label, 60);
          return label ? { id: clean(xo.id, 40) || `o${i}`, label } : null;
        })
        .filter(<T,>(x: T | null): x is T => x !== null);
      return options.length ? { type: 'choices', id, title, multi: o.multi === true, submit: opt(o.submit, 24), options } : null;
    }
    case 'confirm': {
      const text = clean(o.text, 300) || title || '';
      return text
        ? { type: 'confirm', id, title: o.text ? title : undefined, text, approve: opt(o.approve, 24), reject: opt(o.reject, 24), tone: o.tone === 'danger' ? 'danger' : undefined }
        : null;
    }
    case 'form': {
      const seen = new Set<string>();
      const fields = arr(o.fields)
        .slice(0, 8)
        .map((x) => {
          const f = obj(x);
          const name = clean(f.name, 40).replace(/[^\w-]/g, '');
          const label = clean(f.label, 60) || name;
          if (!name || seen.has(name)) return null;
          seen.add(name);
          const kind = f.kind === 'number' || f.kind === 'select' || f.kind === 'toggle' ? f.kind : 'text';
          const options = arr(f.options).slice(0, 12).map((v) => clean(v, 40)).filter(Boolean);
          if (kind === 'select' && !options.length) return null;
          return {
            name,
            label,
            kind: kind as 'text' | 'number' | 'select' | 'toggle',
            options: kind === 'select' ? options : undefined,
            required: f.required === true,
            placeholder: opt(f.placeholder, 60),
          };
        })
        .filter(<T,>(x: T | null): x is T => x !== null);
      return fields.length ? { type: 'form', id, title, submit: opt(o.submit, 24), fields } : null;
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
        const leaf = block(n, blocks.length);
        if (leaf) {
          // Interactive block ids must be unique within the message
          if ('id' in leaf && blocks.some((x) => 'id' in x && x.id === leaf.id)) leaf.id = `${leaf.id}_${blocks.length}`;
          blocks.push(leaf);
        }
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
