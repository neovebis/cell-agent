import type { AgentRun } from '../types';
export interface ActivityEntry {
  id: string;
  kind: 'progress' | 'tool' | 'file';
  title: string;
  detail?: string;
  time?: string;
  failed?: boolean;
  fileId?: string;
}
export interface ActivitySource {
  url: string;
  title: string;
  host: string;
}
export interface RunActivity {
  entries: ActivityEntry[];
  sources: ActivitySource[];
}
const SENSITIVE =
  /^(authorization|cookie|set-cookie|password|passwd|secret|key|sig|api.?key|access.?token|refresh.?token|token|signature|x-amz-.+|x-goog-.+)$/i;
const HIDDEN =
  /^(reasoning|thinking|chain_of_thought|analysis|systemPrompt|credentials?|headers|env|environment)$/i;
const DETAILS = [
  'command',
  'language',
  'code',
  'path',
  'content',
  'stdout',
  'stderr',
  'output',
  'text',
  'summary',
  'error',
] as const;
export function activitySourceUrl(value: unknown): string | undefined {
  if (
    typeof value !== 'string' ||
    value.length > 4096 ||
    /[\u0000-\u0020\\]/.test(value)
  )
    return;
  try {
    const u = new URL(value);
    if (
      !['https:', 'http:'].includes(u.protocol) ||
      !u.hostname ||
      u.username ||
      u.password ||
      u.pathname.includes('/storage/v1/object/sign/')
    )
      return;
    // React Native's legacy URL has no hash setter or iterable searchParams.
    for (const part of u.search.slice(1).split('&')) {
      const key = decodeURIComponent(part.split('=')[0].replace(/\+/g, ' '));
      if (SENSITIVE.test(key)) return;
    }
    return value.split('#')[0];
  } catch {
    return;
  }
}
/** Displays public execution records, with credentials removed. */
export function publicActivityText(value: unknown, limit = 12000): string {
  if (typeof value !== 'string') return '';
  return value
    .slice(0, limit)
    .replace(/\bBearer\s+[^\s'"<>]+/gi, 'Bearer [oculto]')
    .replace(/\b(?:sk-|sb_secret_)[a-zA-Z0-9_-]{12,}/g, '[oculto]')
    .replace(/\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, '[oculto]')
    .replace(
      /((?:password|passwd|secret|client[_-]?secret|api[_-]?key|access[_-]?token|refresh[_-]?token|token|authorization|cookie)["\']?\s*[=:]\s*)(?:"[^"]*"|'[^']*'|[^\s,;&]+)/gi,
      '$1[oculto]',
    )
    .replace(
      /https?:\/\/[^\s<>"')]+/gi,
      (raw) => activitySourceUrl(raw) || '[ligação privada]',
    );
}
export function activityToolLabel(tool?: string): string {
  const n = tool || 'Ferramenta';
  if (/web[._:]?search|search[._:]?web/i.test(n)) return 'Pesquisa na internet';
  if (/project\.command/.test(n)) return 'Executou um comando';
  if (/sandbox:|code\.execute|execute[._:]?code/i.test(n))
    return n.startsWith('sandbox:')
      ? 'Código · ' + n.slice(8)
      : 'Execução de código';
  if (/project\.read|attachment\.read|read[._:]?file/.test(n))
    return 'Leu um ficheiro';
  if (/project\.(write|edit)|write[._:]?file/.test(n))
    return 'Escreveu num ficheiro';
  if (/project\.browser/.test(n)) return 'Verificou no navegador';
  if (/project\.(build|check)/.test(n)) return 'Verificou o projeto';
  if (/node\.test|execute[._:]?nodes/.test(n)) return 'Usou Cells';
  return publicActivityText(n, 100);
}
export function activityLabel(run: AgentRun): string {
  if (run.status === 'waiting_approval') return 'Aguarda a tua autorização';
  if (run.status === 'paused') return 'Em pausa';
  if (run.status === 'failed') return 'Ver o que aconteceu';
  if (['queued', 'running'].includes(run.status)) {
    const last = run.observations?.at(-1);
    return last
      ? activityToolLabel(last.tool)
      : publicActivityText(run.summary, 150) || 'A preparar o pedido';
  }
  const tools = run.toolCalls ?? run.observations?.length ?? 0,
    files = run.generatedFiles?.length ?? 0;
  const sources = new Set(
    (run.searches || []).flatMap((s) =>
      (s.sources || []).map((v) => activitySourceUrl(v.url)).filter(Boolean),
    ),
  ).size;
  const parts = [
    tools ? tools + (tools === 1 ? ' operação' : ' operações') : '',
    files ? files + (files === 1 ? ' ficheiro' : ' ficheiros') : '',
    sources ? sources + (sources === 1 ? ' fonte' : ' fontes') : '',
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Ver atividade';
}
const cached = new WeakMap<AgentRun, RunActivity>();
export function buildRunActivity(run: AgentRun): RunActivity {
  const previous = cached.get(run);
  if (previous) return previous;
  const entries: ActivityEntry[] = [],
    sources = new Map<string, ActivitySource>(),
    seen = new WeakSet<object>();
  let budget = 600;
  const collect = (v: unknown, d = 0) => {
    if (--budget < 0 || d > 5 || !v || typeof v !== 'object' || seen.has(v))
      return;
    seen.add(v);
    if (Array.isArray(v)) {
      v.slice(0, 100).forEach((x) => collect(x, d + 1));
      return;
    }
    const o = v as Record<string, unknown>,
      url = activitySourceUrl(o.url ?? o.link ?? o.href);
    if (url && sources.size < 100)
      sources.set(url, {
        url,
        host: new URL(url).hostname,
        title:
          publicActivityText(o.title ?? o.name, 200) || new URL(url).hostname,
      });
    for (const [k, x] of Object.entries(o))
      if (!SENSITIVE.test(k) && !HIDDEN.test(k)) collect(x, d + 1);
  };
  for (const search of (run.searches || []).slice(-30)) collect(search.sources);
  for (const [index, o] of (run.observations || []).slice(-100).entries()) {
    const r = o.result,
      detail: string[] = [];
    if (typeof r === 'string') detail.push(publicActivityText(r));
    else if (r && typeof r === 'object' && !Array.isArray(r)) {
      const object = r as Record<string, unknown>;
      for (const k of DETAILS) {
        const text = publicActivityText(object[k]);
        if (text) detail.push(k + '\n' + text);
      }
      if (typeof object.exitCode === 'number')
        detail.push('Código de saída: ' + object.exitCode);
    }
    if (o.error) detail.push(publicActivityText(o.error));
    collect(r);
    entries.push({
      id: 'tool:' + (o.step ?? index),
      kind: 'tool',
      title: activityToolLabel(o.tool),
      detail: detail.join('\n\n').slice(0, 12000) || undefined,
      failed: o.success === false,
    });
  }
  for (const f of run.generatedFiles || [])
    entries.push({
      id: 'file:' + f.id,
      kind: 'file',
      title: publicActivityText(f.name, 300),
      fileId: f.id,
    });
  // Public checkpoints have times; never invent timestamps for observations.
  const events = (run.events || [])
    .slice(-250)
    .map((event, index) => ({ event, index }))
    .sort((a, b) =>
      (a.event.createdAt || a.event.created_at || '').localeCompare(
        b.event.createdAt || b.event.created_at || '',
      ),
    );
  for (const { event, index } of events) {
    const title = publicActivityText(event.summary, 500);
    if (title)
      entries.push({
        id: 'event:' + index,
        kind: 'progress',
        title,
        time: event.createdAt || event.created_at,
      });
  }

  const activity = { entries, sources: [...sources.values()] };
  cached.set(run, activity);
  return activity;
}
