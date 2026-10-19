import * as SecureStore from 'expo-secure-store';
import type {
  ActivityItem,
  Agent,
  AgentMessage,
  AgentProfile,
  CaptureItem,
  CellGateway,
  Connection,
  CredentialVaultItem,
  FileAttachment,
  GlobalVariableItem,
  Session,
  WorkspaceInfo,
} from '../types';

declare const process: any;

export const apiBaseUrl = (
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_CELL_API_URL) ||
  'https://cell-griot.pages.dev'
).replace(/\/$/, '');

export const supabaseUrl = (
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_SUPABASE_URL) ||
  'https://oxulnwbwpfxwjbvxlrga.supabase.co'
).replace(/\/$/, '');

export const supabaseAnonKey =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_SUPABASE_ANON_KEY) ||
  'sb_publishable_aEBNlthmZizezIeYKodSnw_0ndTYG42';

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const now = () => new Date().toISOString();

const CAPTURES_STORAGE_KEY = 'cell_mobile_captures_store_v2';
const MESSAGES_STORAGE_KEY = 'cell_mobile_messages_store_v2';

class RealCellGateway implements CellGateway {
  demo = false as const;

  private async getLocalMessages(): Promise<AgentMessage[]> {
    try {
      const raw = await SecureStore.getItemAsync(MESSAGES_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as AgentMessage[]) : [];
    } catch {
      return [];
    }
  }

  private async saveLocalMessage(msg: AgentMessage): Promise<void> {
    try {
      const list = await this.getLocalMessages();
      const updated = [...list, msg];
      await SecureStore.setItemAsync(MESSAGES_STORAGE_KEY, JSON.stringify(updated.slice(-300)));
    } catch {
      // Non-fatal
    }
  }

  async clearMessages(agentId: string): Promise<void> {
    try {
      const list = await this.getLocalMessages();
      const filtered = list.filter((m) => m.agentId !== agentId);
      await SecureStore.setItemAsync(MESSAGES_STORAGE_KEY, JSON.stringify(filtered));
    } catch {
      // Non-fatal
    }
  }

  async signIn(email: string, password: string): Promise<Session> {
    const trimmedEmail = email.trim().toLowerCase();
    const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: supabaseAnonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: trimmedEmail, password }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg =
        data.error_description ||
        data.msg ||
        data.message ||
        'Email ou palavra-passe incorretos no CELL SYSTEM.';
      throw new Error(msg);
    }

    const accessToken = data.access_token as string;
    const user = data.user;
    const displayName =
      user?.user_metadata?.full_name ||
      user?.user_metadata?.name ||
      trimmedEmail.split('@')[0] ||
      'Utilizador';
    const userEmail = user?.email || trimmedEmail;
    const userId = user?.id || '';

    let workspaceId = 'ws_default';
    try {
      const wsRes = await fetch(
        `${supabaseUrl}/rest/v1/cells_workspaces?select=id,name&order=created_at.desc&limit=1`,
        {
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      if (wsRes.ok) {
        const wsList = await wsRes.json().catch(() => []);
        if (Array.isArray(wsList) && wsList[0]?.id) {
          workspaceId = wsList[0].id;
        }
      }
    } catch {
      workspaceId = 'ws_default';
    }

    return {
      accessToken,
      displayName,
      email: userEmail,
      workspaceId,
      userId,
    };
  }

  async getWorkspaces(session?: Session): Promise<WorkspaceInfo[]> {
    if (!session?.accessToken) return [];

    try {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/cells_workspaces?select=id,name,plan,owner_id,created_at&order=created_at.desc`,
        {
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${session.accessToken}`,
          },
        }
      );
      if (res.ok) {
        const rows = await res.json().catch(() => []);
        if (Array.isArray(rows) && rows.length > 0) {
          return rows.map((w: any) => ({
            id: String(w.id),
            name: String(w.name || 'Espaço de Trabalho'),
            plan: w.plan || 'Free',
            owner_id: w.owner_id,
            createdAt: w.created_at,
          }));
        }
      }
    } catch {
      // Fallback
    }

    return [{ id: session.workspaceId || 'ws_default', name: 'Espaço Pessoal (Ativo)', plan: 'Pro' }];
  }

  async getAgents(session?: Session): Promise<Agent[]> {
    if (!session?.accessToken) return [];

    try {
      const filter = session.workspaceId
        ? `&workspace_id=eq.${encodeURIComponent(session.workspaceId)}`
        : '';
      const res = await fetch(
        `${supabaseUrl}/rest/v1/cells_workflows?select=id,name,description,graph,is_active,created_at,updated_at${filter}&order=updated_at.desc&limit=50`,
        {
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${session.accessToken}`,
          },
        }
      );

      if (res.ok) {
        const rows = await res.json().catch(() => []);
        if (Array.isArray(rows)) {
          return rows.map((w: any) => {
            // Check if graph contains specialized agent config
            const agentNode = Array.isArray(w.graph?.nodes)
              ? w.graph.nodes.find((n: any) => n.type === 'agent')
              : null;

            return {
              id: String(w.id),
              name: String(w.name || 'Agente'),
              description: String(
                w.description ||
                  agentNode?.config?.role ||
                  'Agente autónomo do CELL SYSTEM'
              ),
              status: w.is_active === false ? 'paused' : 'idle',
              workflowId: String(w.id),
              createdAt: w.created_at,
              updatedAt: w.updated_at,
              config: agentNode?.config
                ? {
                    provider: agentNode.config.provider || 'google',
                    model: agentNode.config.model || 'gemini-1.5-pro',
                    role: agentNode.config.role || w.name,
                    systemPrompt: agentNode.config.systemPrompt || agentNode.config.prompt || '',
                    temperature: agentNode.config.temperature ?? 0.7,
                    maxModelCalls: agentNode.config.maxIterations ?? 24,
                  }
                : undefined,
            };
          });
        }
      }
    } catch {
      // Network error
    }

    // Absolutely zero fake agents: return empty array if no real workflows found
    return [];
  }

  async createAgent(name: string, description: string, session?: Session): Promise<Agent> {
    if (!session?.accessToken) {
      throw new Error('Sessão necessária para criar agentes.');
    }

    const newId = `wf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const wsId = session.workspaceId || 'ws_default';

    const payload = {
      id: newId,
      name: name.trim(),
      description: description.trim() || 'Agente autónomo CELL SYSTEM',
      workspace_id: wsId,
      is_active: true,
      version: '1.0.0',
      graph: {
        nodes: [
          {
            id: 'agent-central',
            type: 'agent',
            title: name.trim(),
            x: 350,
            y: 280,
            config: {
              role: name.trim(),
              systemPrompt: description.trim(),
              provider: 'google',
              model: 'gemini-1.5-pro',
              temperature: 0.7,
              maxIterations: 24,
              enableSandboxHarness: true,
              verificationRequired: false,
              memoryType: 'durable',
            },
          },
        ],
        edges: [],
      },
      created_at: now(),
      updated_at: now(),
    };

    const res = await fetch(`${supabaseUrl}/rest/v1/cells_workflows`, {
      method: 'POST',
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Não foi possível guardar o agente no servidor.');
    }

    return {
      id: newId,
      name: name.trim(),
      description: description.trim(),
      status: 'idle',
      workflowId: newId,
    };
  }

  async getAgentProfile(workflowId: string, session?: Session): Promise<AgentProfile | null> {
    if (!session?.accessToken) return null;

    try {
      const res = await fetch(
        `${apiBaseUrl}/api/agents/profile?workflowId=${encodeURIComponent(workflowId)}`,
        {
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
            'x-workspace-id': session.workspaceId || 'ws_default',
          },
        }
      );

      if (res.ok) {
        const body = await res.json().catch(() => null);
        if (body?.profile) {
          return {
            workflowId,
            config: {
              provider: body.profile.provider || 'google',
              model: body.profile.model || 'gemini-1.5-pro',
              role: body.profile.role || '',
              systemPrompt: body.profile.systemPrompt || '',
              maxModelCalls: body.profile.maxModelCalls ?? 24,
              maxToolCalls: body.profile.maxToolCalls ?? 32,
              maxOutputTokens: body.profile.maxOutputTokens ?? 2048,
              maxDurationSeconds: body.profile.maxDurationSeconds ?? 1800,
              temperature: body.profile.temperature ?? 0.7,
              concurrency: body.profile.concurrency ?? 2,
              credentialId: body.profile.credentialId || '',
            },
            grants: {
              editGraph: Boolean(body.profile.grants?.editGraph),
              executeCode: Boolean(body.profile.grants?.executeCode),
              webSearch: Boolean(body.profile.grants?.webSearch),
              teams: Boolean(body.profile.grants?.teams),
              externalEffects: Boolean(body.profile.grants?.externalEffects),
              verificationRequired: Boolean(body.profile.grants?.verificationRequired),
              executeNodes: body.profile.grants?.executeNodes || [],
              credentialIds: body.profile.grants?.credentialIds || [],
              variableNames: body.profile.grants?.variableNames || [],
            },
            revision: body.revision ?? 0,
          };
        }
      }
    } catch {
      // Return default
    }

    return {
      workflowId,
      config: {
        provider: 'google',
        model: 'gemini-1.5-pro',
        role: 'Agente Autónomo',
        systemPrompt: 'És um agente inteligente do CELL SYSTEM.',
        maxModelCalls: 24,
        maxToolCalls: 32,
        maxOutputTokens: 2048,
        maxDurationSeconds: 1800,
        temperature: 0.7,
        concurrency: 2,
      },
      grants: {
        editGraph: false,
        executeCode: true,
        webSearch: true,
        teams: false,
        externalEffects: false,
        verificationRequired: false,
      },
    };
  }

  async saveAgentProfile(
    workflowId: string,
    profile: Partial<AgentProfile>,
    session?: Session
  ): Promise<void> {
    if (!session?.accessToken) throw new Error('Sessão necessária para salvar perfil.');

    const res = await fetch(`${apiBaseUrl}/api/agents/profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.accessToken}`,
        'x-workspace-id': session.workspaceId || 'ws_default',
      },
      body: JSON.stringify({
        workflowId,
        profile: {
          ...profile.config,
          grants: profile.grants,
        },
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Falha ao guardar perfil do agente no servidor.');
    }
  }

  async sendMessage(
    agentId: string,
    content: string,
    attachments?: FileAttachment[],
    session?: Session
  ): Promise<AgentMessage> {
    if (!session?.accessToken) {
      throw new Error('Sessão necessária para comunicar com os agentes.');
    }

    const userMessage: AgentMessage = {
      id: uid(),
      agentId,
      role: 'user',
      content,
      createdAt: now(),
      status: 'sent',
      attachments: attachments?.map((a) => ({ name: a.name, mimeType: a.mimeType })),
    };

    await this.saveLocalMessage(userMessage);

    // Call live backend agent execution API
    try {
      const filesPayload =
        attachments && attachments.length > 0
          ? attachments.map((a) => ({
              name: a.name,
              mimeType: a.mimeType,
              data: a.data,
            }))
          : undefined;

      const res = await fetch(`${apiBaseUrl}/api/agents/runs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.accessToken}`,
          'x-workspace-id': session.workspaceId || 'ws_default',
        },
        body: JSON.stringify({
          workflowId: agentId,
          message: content,
          idempotencyKey: uid(),
          files: filesPayload,
        }),
      });

      if (res.ok) {
        const body = await res.json().catch(() => ({}));
        const runId = body?.run?.id;

        if (runId) {
          // Immediately trigger execution drain tick
          fetch(`${apiBaseUrl}/api/agents/tick`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.accessToken}`,
              'x-workspace-id': session.workspaceId || 'ws_default',
            },
            body: JSON.stringify({ runId }),
          }).catch(() => {});

          // Poll run status for completion
          let answerText: string | null = null;
          for (let attempt = 0; attempt < 12; attempt++) {
            await new Promise((r) => setTimeout(r, 1800));

            const pollRes = await fetch(`${apiBaseUrl}/api/agents/runs?id=${encodeURIComponent(runId)}`, {
              headers: {
                Authorization: `Bearer ${session.accessToken}`,
                'x-workspace-id': session.workspaceId || 'ws_default',
              },
            }).catch(() => null);

            if (pollRes && pollRes.ok) {
              const pollData = await pollRes.json().catch(() => ({}));
              const currentRun = pollData?.run;

              if (currentRun?.status === 'success') {
                answerText =
                  currentRun.answer ||
                  currentRun.final_output ||
                  currentRun.output ||
                  currentRun.summary ||
                  'Missão concluída com sucesso.';
                break;
              } else if (currentRun?.status === 'failed') {
                answerText =
                  currentRun.last_error ||
                  currentRun.summary ||
                  'A execução do agente encontrou uma falha no CELL SYSTEM.';
                break;
              } else if (currentRun?.status === 'waiting_approval') {
                answerText = `Ação pendente de aprovação manual: ${currentRun.approval?.reason || 'Operação sensível'}`;
                break;
              }
            }
          }

          if (answerText) {
            const assistantMessage: AgentMessage = {
              id: uid(),
              agentId,
              role: 'assistant',
              content: answerText,
              createdAt: now(),
              status: 'sent',
            };
            await this.saveLocalMessage(assistantMessage);
          } else {
            // Long running mission notification
            const pendingNotice: AgentMessage = {
              id: uid(),
              agentId,
              role: 'assistant',
              content: `A missão continua a executar em segundo plano (ID: ${runId.slice(0, 8)}). Podes acompanhar os passos no separador Atividade.`,
              createdAt: now(),
              status: 'sent',
            };
            await this.saveLocalMessage(pendingNotice);
          }
        }
      } else {
        const errorBody = await res.json().catch(() => ({}));
        throw new Error(errorBody.message || 'Erro ao submeter missão para o agente.');
      }
    } catch (e: any) {
      const errorMessage: AgentMessage = {
        id: uid(),
        agentId,
        role: 'assistant',
        content: `⚠️ Não foi possível obter resposta: ${e?.message || 'Falha de ligação.'}`,
        createdAt: now(),
        status: 'failed',
      };
      await this.saveLocalMessage(errorMessage);
    }

    return userMessage;
  }

  async getMessages(agentId: string, session?: Session): Promise<AgentMessage[]> {
    const local = await this.getLocalMessages();
    const forAgent = local.filter((m) => m.agentId === agentId);

    if (!session?.accessToken) {
      return forAgent;
    }

    try {
      const res = await fetch(
        `${apiBaseUrl}/api/agents/runs?workflowId=${encodeURIComponent(agentId)}`,
        {
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
            'x-workspace-id': session.workspaceId || 'ws_default',
          },
        }
      );

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const runs = Array.isArray(data?.runs) ? data.runs : [];

        if (runs.length > 0) {
          const remoteMessages: AgentMessage[] = [];
          for (const r of runs) {
            if (r.message) {
              remoteMessages.push({
                id: `remote_u_${r.id}`,
                agentId,
                role: 'user',
                content: String(r.message),
                createdAt: r.createdAt || r.created_at || now(),
                status: 'sent',
              });
            }
            const out = r.answer || r.final_output || r.output || r.summary || r.last_error;
            if (out) {
              remoteMessages.push({
                id: `remote_a_${r.id}`,
                agentId,
                role: 'assistant',
                content: typeof out === 'string' ? out : JSON.stringify(out, null, 2),
                createdAt: r.updatedAt || r.finished_at || now(),
                status: 'sent',
              });
            }
          }

          // Combine with deduplication
          const combinedMap = new Map<string, AgentMessage>();
          for (const m of forAgent) combinedMap.set(m.content + m.createdAt.slice(0, 16), m);
          for (const m of remoteMessages) combinedMap.set(m.content + m.createdAt.slice(0, 16), m);
          return Array.from(combinedMap.values()).sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        }
      }
    } catch {
      // Non-fatal: return local messages
    }

    return forAgent;
  }

  async getCredentials(session?: Session): Promise<CredentialVaultItem[]> {
    if (!session?.accessToken) return [];

    try {
      const res = await fetch(`${apiBaseUrl}/api/credentials`, {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          'x-workspace-id': session.workspaceId || 'ws_default',
        },
      });

      if (res.ok) {
        const data = await res.json().catch(() => []);
        if (Array.isArray(data)) {
          return data.map((c: any) => ({
            id: String(c.id),
            name: String(c.name || c.provider || 'Credencial'),
            provider: String(c.provider || 'api_key'),
            maskedKey: c.maskedKey || (c.provider ? `${c.provider.toUpperCase()} (••••••)` : '••••••••'),
            created_at: c.created_at,
          }));
        }
      }
    } catch {
      // Fallback
    }

    return [];
  }

  async getVariables(session?: Session): Promise<GlobalVariableItem[]> {
    if (!session?.accessToken) return [];

    try {
      const res = await fetch(`${apiBaseUrl}/api/variables`, {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          'x-workspace-id': session.workspaceId || 'ws_default',
        },
      });

      if (res.ok) {
        const data = await res.json().catch(() => []);
        if (Array.isArray(data)) {
          return data.map((v: any) => ({
            id: String(v.id || v.name),
            name: String(v.name || v.key),
            key: String(v.key || v.name),
            maskedValue: '••••••••',
            created_at: v.created_at,
          }));
        }
      }
    } catch {
      // Fallback
    }

    return [];
  }

  async getConnections(session?: Session): Promise<Connection[]> {
    const defaultCatalog: Connection[] = [
      {
        id: 'conn_gdrive',
        name: 'Google Drive',
        kind: 'Conectores',
        description: 'Acesso a ficheiros, folhas de cálculo e documentos na cloud.',
        connected: false,
      },
      {
        id: 'conn_github',
        name: 'GitHub',
        kind: 'Conectores',
        description: 'Repositórios de código, issues, pull requests e webhooks.',
        connected: false,
      },
      {
        id: 'conn_search',
        name: 'Pesquisa Web Real-Time',
        kind: 'Plugins',
        description: 'Pesquisa web em tempo real e extração semântica de fontes.',
        connected: false,
      },
      {
        id: 'conn_mcp',
        name: 'Servidor MCP',
        kind: 'MCP',
        description: 'Protocolo de Ferramentas de Contexto (Model Context Protocol).',
        connected: false,
      },
      {
        id: 'conn_skills',
        name: 'Análise de Dados',
        kind: 'Skills',
        description: 'Procedimentos e rotinas analíticas reutilizáveis.',
        connected: false,
      },
      {
        id: 'conn_cells',
        name: 'Células Circulares',
        kind: 'Cells',
        description: 'Motor nativo radial determinístico do CELL SYSTEM.',
        connected: true,
      },
    ];

    if (!session?.accessToken) {
      return defaultCatalog;
    }

    try {
      const creds = await this.getCredentials(session);
      const credNames = new Set(creds.map((c) => c.provider.toLowerCase()));

      return defaultCatalog.map((item) => {
        if (item.kind === 'Cells') return item;
        if (item.id === 'conn_gdrive') return { ...item, connected: credNames.has('google') || credNames.has('google_drive') };
        if (item.id === 'conn_github') return { ...item, connected: credNames.has('github') };
        if (item.id === 'conn_search') return { ...item, connected: credNames.has('tavily') || credNames.has('brave') || credNames.has('google') };
        if (item.id === 'conn_mcp') return { ...item, connected: credNames.has('mcp') };
        return item;
      });
    } catch {
      return defaultCatalog;
    }
  }

  async getActivity(session?: Session): Promise<ActivityItem[]> {
    if (!session?.accessToken) return [];

    try {
      const res = await fetch(`${apiBaseUrl}/api/jobs`, {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          'x-workspace-id': session.workspaceId || 'ws_default',
        },
      });

      if (res.ok) {
        const data = await res.json().catch(() => []);
        const jobs = Array.isArray(data) ? data : [];

        if (jobs.length > 0) {
          return jobs.map((job: any) => {
            const isComplete = job.status === 'completed' || job.status === 'success';
            const isFailed = job.status === 'failed' || job.status === 'error';
            const isApproval = job.status === 'approval' || job.status === 'waiting_approval';
            const kind: ActivityItem['kind'] = isComplete
              ? 'complete'
              : isFailed
              ? 'failed'
              : isApproval
              ? 'approval'
              : 'running';

            return {
              id: String(job.id),
              title: `Execução ${job.workflow_id ? job.workflow_id.slice(0, 14) : 'do Grafo'}`,
              subtitle: job.last_error ? `Falha: ${job.last_error}` : `Estado: ${job.status}`,
              kind,
              createdAt: job.created_at || now(),
              agentId: job.workflow_id,
            };
          });
        }
      }
    } catch {
      // Fallback
    }

    return [];
  }

  async getCaptures(): Promise<CaptureItem[]> {
    try {
      const raw = await SecureStore.getItemAsync(CAPTURES_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as CaptureItem[]) : [];
    } catch {
      return [];
    }
  }

  async saveCapture(
    item: Omit<CaptureItem, 'id' | 'createdAt' | 'synced'>
  ): Promise<CaptureItem> {
    const saved: CaptureItem = {
      ...item,
      id: uid(),
      createdAt: now(),
      synced: true,
    };

    try {
      const current = await this.getCaptures();
      const updated = [saved, ...current].slice(0, 100);
      await SecureStore.setItemAsync(CAPTURES_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Storage error
    }

    return saved;
  }

  async uploadCaptureFile(item: CaptureItem, session?: Session): Promise<string> {
    if (!item.base64 && !item.uri) {
      throw new Error('Ficheiro sem dados para carregar.');
    }

    // In CELL AGENT backend, attachments are sent directly via base64 in runs API
    // or can be synced to Supabase storage bucket `agent-attachments`
    return item.uri || 'synced';
  }

  async registerPush(token: string): Promise<void> {
    try {
      await SecureStore.setItemAsync('cell_expo_push_token', token);
    } catch {
      // Push token local caching
    }
  }
}

export const gateway: CellGateway = new RealCellGateway();
