import type {
  Agent,
  AgentCell,
  AgentMessage,
  AgentRun,
  FileAttachment,
  PendingMessage,
  RunStatus,
  Session,
} from '../types';

export interface KeyValueStore {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
  removePrefix(prefix: string): Promise<void>;
}

export const TERMINAL_STATUSES = new Set<RunStatus>([
  'success',
  'failed',
  'cancelled',
  'expired',
]);
export const scopeKey = (session: Session) => {
  if (
    !session.userId ||
    !session.workspaceId ||
    session.workspaceId === 'ws_default'
  ) {
    throw new Error('Seleciona um espaço de trabalho autenticado.');
  }
  return `user:${encodeURIComponent(session.userId)}:workspace:${encodeURIComponent(session.workspaceId)}:`;
};

export const newMessageId = () =>
  `mobile_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;

export function validateAttachments(files: FileAttachment[]): void {
  if (files.length > 4)
    throw new Error('Podes anexar até quatro ficheiros por mensagem.');
  let total = 0;
  for (const file of files) {
    if (
      !file.name.trim() ||
      file.name.length > 180 ||
      /[\x00-\x1f\x7f/\\]/.test(file.name)
    )
      throw new Error(
        'O nome do ficheiro é inválido. Renomeia-o antes de enviar.',
      );
    const text =
      /\.(txt|md|csv|tsv|json|jsonl|yaml|yml|xml|js|jsx|ts|tsx|py|sh|sql|html|css|toml|ini|log|ipynb)$/i.test(
        file.name,
      ) || file.mimeType.startsWith('text/');
    if (
      !text &&
      ![
        'application/json',
        'application/xml',
        'application/pdf',
        'image/png',
        'image/jpeg',
        'image/webp',
        'image/gif',
      ].includes(file.mimeType)
    ) {
      throw new Error(
        'Envia texto, PDF, PNG, JPEG, WebP ou GIF. Este chat ainda não recebe vídeo ou áudio.',
      );
    }
    if (
      !file.data ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(file.data) ||
      file.data.length % 4 !== 0
    )
      throw new Error(
        `Não foi possível ler ${file.name}. Seleciona o ficheiro novamente.`,
      );
    const size =
      (file.data.length / 4) * 3 -
      (file.data.endsWith('==') ? 2 : file.data.endsWith('=') ? 1 : 0);
    if (size < 1 || size > 2 * 1024 * 1024)
      throw new Error('Cada ficheiro pode ter até 2 MiB.');
    if (text && size > 192 * 1024)
      throw new Error('Ficheiros de texto podem ter até 192 KiB.');
    total += size;
  }
  if (total > 4 * 1024 * 1024)
    throw new Error('Os anexos podem ter até 4 MiB no total.');
}

const CELL_NAMES: Record<string, string> = {
  artcraft_pdf: 'PDFCraft',
  artcraft_photocraft: 'PhotoCraft',
  artcraft_vectorcraft: 'VectorCraft',
  artcraft_lightcraft: 'LightCraft',
  artcraft_soundcraft: 'SoundCraft',
  artcraft_filmcraft: 'FilmCraft',
  artcraft_wordcraft: 'WordCraft',
  artcraft_gridcraft: 'GridCraft',
  artcraft_deckcraft: 'DeckCraft',
  artcraft_cadcraft: 'CADCraft',
  artcraft_figcraft: 'FigCraft',
  artcraft_designcraft: 'DesignCraft',
  artcraft_effectcraft: 'EffectCraft',
  source: 'Fonte',
  action: 'Ação',
  processor: 'Processador',
  executor: 'Código',
  agent: 'Especialista',
  model: 'Modelo',
  memory: 'Memória',
  container: 'Contentor',
  skill: 'Skill',
  http: 'HTTP',
  call_workflow: 'Workflow',
  google_sheets: 'Google Sheets',
};

/** The agent API addresses the central agent of a workflow, never an arbitrary graph node. */
export function workflowAgent(row: Record<string, any>): Agent {
  const nodes = Array.isArray(row.graph?.nodes) ? row.graph.nodes : [];
  const avatar = nodes.find(
    (node: any) => node.avatar?.kind === 'motion',
  )?.avatar;
  const cells: AgentCell[] = nodes
    .filter(
      (node: any) =>
        typeof node.id === 'string' && typeof node.type === 'string',
    )
    .map((node: any) => ({
      id: node.id,
      type: node.type,
      name: node.title || CELL_NAMES[node.type] || node.type,
      credentialId:
        typeof node.config?.credentialId === 'string'
          ? node.config.credentialId
          : undefined,
      kind:
        node.type === 'skill'
          ? 'Skills'
          : [
                'http',
                'google_sheets',
                'github',
                'slack',
                'telegram',
                'custom_connector',
              ].includes(node.type)
            ? 'Conectores'
            : 'Cells',
    }));
  return {
    id: String(row.id),
    workflowId: String(row.id),
    workspaceId: String(row.workspace_id),
    name: String(row.name || 'Agente principal'),
    description: String(row.description || 'Agente central do teu espaço'),
    status: row.is_active === false ? 'paused' : 'idle',
    nodes: cells,
    avatar:
      avatar &&
      ['circle', 'heart', 'diamond', 'spade', 'club'].includes(avatar.shape) &&
      [
        'black',
        'turquoise',
        'cyan',
        'neonBlue',
        'lilac',
        'lightPurple',
      ].includes(avatar.color)
        ? { shape: avatar.shape, color: avatar.color }
        : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function acknowledgePending(
  pending: PendingMessage[],
  pendingId: string | undefined,
  run: Pick<AgentRun, 'id' | 'workflowId'>,
): PendingMessage[] {
  return pending.map((item) =>
    item.id === pendingId && item.workflowId === run.workflowId
      ? { ...item, runId: run.id, status: 'sent', files: [], error: undefined }
      : item,
  );
}
export function recoverUnconfirmedPending(
  pending: PendingMessage[],
): PendingMessage[] {
  return pending.map((item) =>
    item.status === 'sending'
      ? {
          ...item,
          status: 'failed',
          error:
            'Este envio ficou sem confirmação. Repete a mesma mensagem para confirmar o resultado.',
        }
      : item,
  );
}

export function conversationMessages(
  workflowId: string,
  runs: AgentRun[],
  pending: PendingMessage[],
): AgentMessage[] {
  const visibleRuns = runs.filter((run) => run.workflowId === workflowId);
  const knownRuns = new Set(visibleRuns.map((run) => run.id));
  const localIds = new Map<string, string>();
  for (const item of pending)
    if (item.workflowId === workflowId && item.runId)
      localIds.set(item.runId, item.id);
  const messages: AgentMessage[] = [];
  for (const run of visibleRuns) {
    messages.push({
      id: localIds.get(run.id) || `user:${run.id}`,
      agentId: workflowId,
      runId: run.id,
      role: 'user',
      content: run.message,
      createdAt: run.createdAt,
      status: 'sent',
      attachments: run.files,
    });
    if (run.answer || TERMINAL_STATUSES.has(run.status))
      messages.push({
        id: `assistant:${run.id}`,
        agentId: workflowId,
        runId: run.id,
        role: 'assistant',
        content:
          run.answer ||
          (run.status === 'success'
            ? run.generatedFiles?.length
              ? 'O ficheiro está pronto.'
              : 'O pedido foi concluído.'
            : run.status === 'cancelled'
              ? 'Este pedido foi cancelado.'
              : run.status === 'expired'
                ? 'Este pedido demorou demasiado. Tenta novamente.'
                : 'Não foi possível concluir este pedido. Tenta novamente ou consulta os detalhes em Tarefas.'),
        createdAt: run.updatedAt || run.createdAt,
        status: run.status === 'failed' ? 'failed' : 'sent',
      });
  }
  for (const item of pending) {
    if (
      item.workflowId !== workflowId ||
      (item.runId && knownRuns.has(item.runId))
    )
      continue;
    messages.push({
      id: item.id,
      pendingId: item.id,
      agentId: workflowId,
      runId: item.runId,
      role: 'user',
      content: item.content,
      createdAt: item.createdAt,
      status: item.status,
      error: item.error,
      attachments: item.files.map((file) => ({
        name: file.name,
        mimeType: file.mimeType,
      })),
    });
  }
  return messages.sort(
    (a, b) =>
      a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
}

export function trustedDownload(url: unknown, supabaseUrl: string): string {
  if (typeof url !== 'string')
    throw new Error('O servidor não devolveu uma ligação de download.');
  const target = new URL(url),
    expected = new URL(supabaseUrl);
  if (
    target.protocol !== 'https:' ||
    target.origin !== expected.origin ||
    target.username ||
    target.password ||
    !target.pathname.startsWith('/storage/v1/object/sign/')
  )
    throw new Error('Ligação de download recusada.');
  return target.href;
}
