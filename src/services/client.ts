import { CellApi, ApiError, SessionExpiredError } from './api.ts';
import {
  newMessageId,
  scopeKey,
  trustedDownload,
  validateAttachments,
  workflowAgent,
  type KeyValueStore,
} from './contracts.ts';
import type {
  Agent,
  AgentAvatarChoice,
  AgentDraft,
  AgentProfile,
  AgentRun,
  CaptureItem,
  CredentialVaultItem,
  FileAttachment,
  GlobalVariableItem,
  PendingMessage,
  RunOperation,
  Session,
  WorkspaceInfo,
} from '../types';

export class CellClient {
  readonly demo = false;
  readonly api: CellApi;
  private store: KeyValueStore;
  private locks = new Map<string, Promise<unknown>>();
  constructor(api: CellApi, store: KeyValueStore) {
    this.api = api;
    this.store = store;
  }
  private authenticated(session?: Session): Session {
    if (!session?.userId || !session.accessToken)
      throw new SessionExpiredError();
    return session;
  }
  private async serial<T>(key: string, action: () => Promise<T>): Promise<T> {
    const task = (this.locks.get(key) || Promise.resolve())
      .catch(() => {})
      .then(action);
    this.locks.set(key, task);
    try {
      return await task;
    } finally {
      if (this.locks.get(key) === task) this.locks.delete(key);
    }
  }

  async signIn(email: string, password: string): Promise<Session> {
    const session = await this.api.signIn(email, password);
    const spaces = await this.getWorkspaces(session);
    if (!spaces.length)
      throw new Error('Esta conta ainda não tem um espaço de trabalho ativo.');
    session.workspaceId = spaces[0].id;
    return session;
  }
  async restoreSession(session: Session): Promise<Session> {
    this.authenticated(session);
    if (!session.refreshToken) throw new SessionExpiredError();
    this.api.activate(session);
    if (!session.expiresAt || session.expiresAt <= Date.now() / 1000 + 60)
      await this.api.refresh(session);
    return session;
  }
  async clearLocalAccount(session: Session): Promise<void> {
    this.api.invalidate();
    await Promise.allSettled([...this.locks.values()]);
    await this.store.removePrefix(
      `user:${encodeURIComponent(session.userId || '')}:`,
    );
  }
  async getWorkspaces(session?: Session): Promise<WorkspaceInfo[]> {
    const auth = this.authenticated(session);
    const rows = await this.api.request(
      '/cells_workspaces?select=id,name,tier,owner_id,created_at&order=created_at.desc',
      auth,
      { rest: true, workspace: false },
    );
    if (!Array.isArray(rows))
      throw new ApiError('Resposta de espaços inválida.', 502);
    return rows.map((row) => ({
      id: String(row.id),
      name: row.name || 'Espaço de trabalho',
      plan: row.tier,
      owner_id: row.owner_id,
      createdAt: row.created_at,
    }));
  }
  async getAgents(session?: Session): Promise<Agent[]> {
    const auth = this.authenticated(session),
      key = scopeKey(auth) + 'agents';
    const rows = await this.api.request(
      `/cells_workflows?workspace_id=eq.${encodeURIComponent(auth.workspaceId!)}&select=id,name,description,graph,workspace_id,is_active,created_at,updated_at&order=updated_at.desc&limit=100`,
      auth,
      { rest: true },
    );
    if (!Array.isArray(rows))
      throw new ApiError('Resposta de agentes inválida.', 502);
    const agents = rows.map(workflowAgent);
    await this.store.set(key, agents);
    return agents;
  }
  async getCachedAgents(session: Session): Promise<Agent[]> {
    return (await this.store.get<Agent[]>(scopeKey(session) + 'agents')) || [];
  }
  async getPrimaryAgent(session: Session): Promise<string | null> {
    return this.store.get<string>(scopeKey(session) + 'primary');
  }
  async setPrimaryAgent(id: string, session: Session): Promise<void> {
    await this.store.set(scopeKey(session) + 'primary', id);
  }
  async getDraft(id: string, session: Session): Promise<AgentDraft | null> {
    return this.store.get<AgentDraft>(scopeKey(session) + 'draft:' + id);
  }
  async saveDraft(
    id: string,
    draft: AgentDraft,
    session: Session,
  ): Promise<void> {
    await this.store.set(scopeKey(session) + 'draft:' + id, draft);
  }

  async createAgent(
    name: string,
    description: string,
    session?: Session,
    avatar?: AgentAvatarChoice,
  ): Promise<Agent> {
    const auth = this.authenticated(session);
    scopeKey(auth);
    if (!name.trim() || name.length > 120 || description.length > 4000)
      throw new Error(
        'Indica um nome até 120 caracteres e instruções até 4000 caracteres.',
      );
    const id = 'wf_' + newMessageId(),
      nodeId = 'ag_' + newMessageId(),
      time = new Date().toISOString();
    const graph = {
      id,
      name: name.trim(),
      nodes: [
        {
          id: nodeId,
          type: 'agent',
          title: name.trim(),
          x: 350,
          y: 280,
          ...(avatar ? { avatar: { kind: 'motion', ...avatar } } : {}),
          config: {
            role: name.trim(),
            systemPrompt: description.trim(),
            enableSandboxHarness: false,
          },
        },
      ],
      edges: [],
    };
    const rows = await this.api.request('/cells_workflows', auth, {
      rest: true,
      method: 'POST',
      body: {
        id,
        name: name.trim(),
        description: description.trim(),
        workspace_id: auth.workspaceId,
        user_id: auth.userId,
        is_active: true,
        version: '1.0.0',
        viewport: { x: 40, y: 40, zoom: 0.92 },
        graph,
        created_at: time,
        updated_at: time,
      },
    });
    if (!Array.isArray(rows) || !rows[0])
      throw new ApiError('O serviço não confirmou a criação do agente.', 502);
    return workflowAgent(rows[0]);
  }

  async getAgentProfile(
    workflowId: string,
    session?: Session,
  ): Promise<AgentProfile | null> {
    const body = await this.api.request(
      `/api/agents/profile?workflowId=${encodeURIComponent(workflowId)}`,
      this.authenticated(session),
    );
    if (!body.profile) return null;
    const { grants, ...config } = body.profile;
    return {
      workflowId,
      config,
      grants: {
        ...grants,
        editGraph: Boolean(grants?.editGraph),
        executeCode: Boolean(grants?.executeCode),
        webSearch: Boolean(grants?.webSearch),
        teams: Boolean(grants?.teams),
        externalEffects: Boolean(grants?.externalEffects),
        verificationRequired: Boolean(grants?.verificationRequired),
        executeNodes: grants?.executeNodes || [],
        credentialIds: grants?.credentialIds || [],
        variableNames: grants?.variableNames || [],
      },
      revision: body.revision,
    };
  }
  async saveAgentProfile(
    workflowId: string,
    profile: Partial<AgentProfile>,
    session?: Session,
  ): Promise<void> {
    if (!profile.config?.credentialId || !profile.config.model?.trim())
      throw new Error('Seleciona uma credencial e um modelo.');
    if (profile.revision !== undefined) {
      const current = await this.getAgentProfile(workflowId, session);
      if (current?.revision !== profile.revision)
        throw new Error(
          'A configuração mudou noutro cliente. Atualiza antes de guardar.',
        );
    }
    await this.api.request('/api/agents/profile', this.authenticated(session), {
      method: 'POST',
      body: {
        workflowId,
        profile: { ...profile.config, grants: profile.grants },
      },
    });
  }
  async getModels(
    credentialId: string,
    provider: string,
    session: Session,
  ): Promise<{ id: string; name: string }[]> {
    const body = await this.api.request(
      `/api/credentials/models?id=${encodeURIComponent(credentialId)}&provider=${encodeURIComponent(provider)}&operation=chat`,
      session,
    );
    const models = Array.isArray(body) ? body : body.models;
    if (!Array.isArray(models))
      throw new Error('O serviço não devolveu o catálogo de modelos.');
    return models
      .filter(
        (model) =>
          typeof (typeof model === 'string' ? model : model.id) === 'string',
      )
      .map((model) =>
        typeof model === 'string'
          ? { id: model, name: model }
          : { id: model.id, name: model.name || model.id },
      );
  }

  async getRuns(
    workflowId: string,
    session: Session,
    signal?: AbortSignal,
  ): Promise<AgentRun[]> {
    const body = await this.api.request(
      `/api/agents/runs?workflowId=${encodeURIComponent(workflowId)}`,
      session,
      { signal },
    );
    if (!Array.isArray(body.runs))
      throw new ApiError('Histórico de execuções inválido.', 502);
    const runs = body.runs.filter(
      (run: AgentRun) => run.workflowId === workflowId,
    );
    await this.store.set(scopeKey(session) + 'runs:' + workflowId, runs);
    return runs;
  }
  async getCachedRuns(
    workflowId: string,
    session: Session,
  ): Promise<AgentRun[]> {
    return (
      (await this.store.get<AgentRun[]>(
        scopeKey(session) + 'runs:' + workflowId,
      )) || []
    );
  }
  async getPending(
    workflowId: string,
    session: Session,
  ): Promise<PendingMessage[]> {
    return (
      (await this.store.get<PendingMessage[]>(
        scopeKey(session) + 'pending:' + workflowId,
      )) || []
    );
  }
  async discardPending(
    workflowId: string,
    pendingId: string,
    session: Session,
  ): Promise<void> {
    const key = scopeKey(session) + 'pending:' + workflowId;
    await this.serial(key, async () => {
      const current = await this.getPending(workflowId, session);
      await this.store.set(
        key,
        current.filter(
          (item) => item.id !== pendingId || item.status === 'sent',
        ),
      );
    });
  }
  private async updatePending(
    item: PendingMessage,
    session: Session,
  ): Promise<void> {
    const key = scopeKey(session) + 'pending:' + item.workflowId;
    await this.serial(key, async () => {
      const current = (await this.store.get<PendingMessage[]>(key)) || [];
      const others = current.filter((entry) => entry.id !== item.id);
      const unsent = others.filter((entry) => entry.status !== 'sent');
      if (unsent.length >= 50 && item.status !== 'sent')
        throw new Error(
          'Tens 50 mensagens por enviar. Resolve os envios pendentes antes de criar outro.',
        );
      await this.store.set(key, [
        ...others.filter((entry) => entry.status === 'sent').slice(-20),
        ...unsent,
        item,
      ]);
    });
  }
  async createRun(
    workflowId: string,
    content: string,
    files: FileAttachment[],
    session: Session,
    retryId?: string,
    onQueued?: (message: PendingMessage) => void,
  ): Promise<AgentRun> {
    validateAttachments(files);
    if (
      (!content.trim() && !files.length) ||
      Array.from(content).reduce(
        (size, char) =>
          size +
          ((char.codePointAt(0) || 0) > 0xffff
            ? 4
            : (char.codePointAt(0) || 0) > 0x7ff
              ? 3
              : (char.codePointAt(0) || 0) > 0x7f
                ? 2
                : 1),
        0,
      ) > 8000
    )
      throw new Error('Escreve um pedido até 8 KB ou anexa um ficheiro.');
    const previous = retryId
      ? (await this.getPending(workflowId, session)).find(
          (item) => item.id === retryId,
        )
      : undefined;
    if (retryId && !previous)
      throw new Error('Esta mensagem já não está disponível para repetir.');
    const pending: PendingMessage = previous || {
      id: newMessageId(),
      workflowId,
      content,
      files,
      createdAt: new Date().toISOString(),
      status: 'sending',
    };
    pending.status = 'sending';
    delete pending.error;
    await this.updatePending(pending, session);
    onQueued?.(pending);
    try {
      const body = await this.api.request('/api/agents/runs', session, {
        method: 'POST',
        body: {
          workflowId,
          message: pending.content,
          idempotencyKey: pending.id,
          files: pending.files.map(({ name, mimeType, data }) => ({
            name,
            mimeType,
            data,
          })),
        },
      });
      if (!body.run?.id || body.run.workflowId !== workflowId)
        throw new ApiError(
          'O servidor não confirmou a execução. Tenta novamente com a mesma mensagem.',
          502,
        );
      await this.updatePending(
        { ...pending, runId: body.run.id, status: 'sent', files: [] },
        session,
      );
      return body.run;
    } catch (error) {
      if (error instanceof SessionExpiredError) throw error;
      pending.status = 'failed';
      pending.error = error instanceof Error ? error.message : 'Erro de envio.';
      await this.updatePending(pending, session);
      if (error instanceof Error)
        Object.assign(error, { pendingId: pending.id });
      throw error;
    }
  }
  async retryMessage(
    workflowId: string,
    pendingId: string,
    session: Session,
  ): Promise<AgentRun> {
    const item = (await this.getPending(workflowId, session)).find(
      (entry) => entry.id === pendingId,
    );
    if (!item) throw new Error('Mensagem indisponível.');
    return this.createRun(
      workflowId,
      item.content,
      item.files,
      session,
      pendingId,
    );
  }
  async controlRun(
    run: AgentRun,
    operation: RunOperation,
    session: Session,
  ): Promise<AgentRun> {
    const current = (
      await this.api.request(
        `/api/agents/runs?id=${encodeURIComponent(run.id)}`,
        session,
      )
    ).run as AgentRun;
    if (!current || current.workflowId !== run.workflowId)
      throw new Error('Execução fora deste agente.');
    if (
      operation === 'approve' &&
      (current.status !== 'waiting_approval' ||
        !run.approvalHash ||
        current.approvalHash !== run.approvalHash)
    )
      throw new Error(
        'O pedido de aprovação mudou. Atualiza a tarefa antes de aprovar.',
      );
    const result = await this.api.request('/api/agents/control', session, {
      method: 'POST',
      body: {
        runId: run.id,
        operation,
        ...(operation === 'approve' ? { approvalHash: run.approvalHash } : {}),
      },
    });
    return result.run;
  }
  async advanceRun(
    runId: string,
    session: Session,
    signal?: AbortSignal,
  ): Promise<void> {
    await this.api.request('/api/agents/tick', session, {
      method: 'POST',
      body: { runId },
      signal,
      timeoutMs: 125000,
    });
  }
  async getFileUrl(
    runId: string,
    fileId: string,
    session: Session,
  ): Promise<string> {
    const result = await this.api.request(
      `/api/agents/attachments?runId=${encodeURIComponent(runId)}&id=${encodeURIComponent(fileId)}`,
      session,
    );
    return trustedDownload(result.url, this.api.config.supabaseUrl);
  }

  async getCredentials(session?: Session): Promise<CredentialVaultItem[]> {
    const rows = await this.api.request(
      '/api/credentials',
      this.authenticated(session),
    );
    if (!Array.isArray(rows))
      throw new ApiError('Resposta do cofre inválida.', 502);
    return rows.map((row) => ({
      id: String(row.id),
      name: row.name || row.provider,
      provider: row.provider,
      maskedKey: row.maskedKey || '••••••••',
      created_at: row.created_at,
    }));
  }
  async getVariables(session?: Session): Promise<GlobalVariableItem[]> {
    const rows = await this.api.request(
      '/api/variables',
      this.authenticated(session),
    );
    if (!Array.isArray(rows))
      throw new ApiError('Resposta de variáveis inválida.', 502);
    return rows.map((row) => ({
      id: String(row.id),
      name: row.name,
      key: row.name,
      maskedValue: '••••••••',
      created_at: row.created_at,
    }));
  }
  async getCaptures(session?: Session): Promise<CaptureItem[]> {
    return (
      (await this.store.get<CaptureItem[]>(
        scopeKey(this.authenticated(session)) + 'captures',
      )) || []
    );
  }
  async saveCapture(
    item: Omit<CaptureItem, 'id' | 'createdAt' | 'synced'>,
    session?: Session,
  ): Promise<CaptureItem> {
    const auth = this.authenticated(session),
      key = scopeKey(auth) + 'captures';
    const saved = {
      ...item,
      id: newMessageId(),
      createdAt: new Date().toISOString(),
      synced: false,
    };
    await this.serial(key, async () => {
      const current = await this.getCaptures(auth);
      await this.store.set(key, [saved, ...current].slice(0, 100));
    });
    return saved;
  }
}
