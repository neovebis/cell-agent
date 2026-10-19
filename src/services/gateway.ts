import * as SecureStore from 'expo-secure-store';
import type {
  ActivityItem,
  Agent,
  AgentMessage,
  CaptureItem,
  CellGateway,
  Connection,
  Session,
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

const CAPTURES_STORAGE_KEY = 'cell_mobile_captures_store_v1';
const MESSAGES_STORAGE_KEY = 'cell_mobile_messages_store_v1';

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

  async getAgents(session?: Session): Promise<Agent[]> {
    if (!session?.accessToken) return [];

    try {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/cells_workflows?select=id,name,description,graph,status&order=updated_at.desc&limit=50`,
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
            name: String(w.name || 'Agente'),
            description: String(w.description || 'Agente autónomo do CELL SYSTEM'),
            status: 'idle',
          }));
        }
      }
    } catch {
      // Fallback below
    }

    // Default starter agents for new workspaces
    return [
      {
        id: 'wf_starter_eliot',
        name: 'Eliot',
        description: 'Automação e execução de missões autónomas',
        status: 'idle',
      },
      {
        id: 'wf_starter_atlas',
        name: 'Atlas',
        description: 'Investigação, síntese e análise de dados',
        status: 'idle',
      },
      {
        id: 'wf_starter_nova',
        name: 'Nova',
        description: 'Assistência, organização e contexto',
        status: 'idle',
      },
    ];
  }

  async createAgent(name: string, description: string, session?: Session): Promise<Agent> {
    if (!session?.accessToken) {
      throw new Error('Sessão necessária para criar agentes.');
    }

    const newId = `wf_agent_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const wsId = session.workspaceId || 'ws_default';

    const payload = {
      id: newId,
      name: name.trim(),
      description: description.trim() || 'Agente criado via CELL AGENT Mobile',
      workspace_id: wsId,
      status: 'ACTIVE',
      is_active: true,
      version: '1.0.0',
      graph: {
        nodes: [
          {
            id: 'agent-main',
            type: 'agent',
            title: name.trim(),
            x: 400,
            y: 300,
            config: {
              prompt: description.trim(),
              role: name.trim(),
            },
          },
        ],
        edges: [],
      },
      created_at: now(),
      updated_at: now(),
    };

    try {
      await fetch(`${supabaseUrl}/rest/v1/cells_workflows`, {
        method: 'POST',
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${session.accessToken}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify(payload),
      });
    } catch {
      // Proceed even if database returns insert warning
    }

    return {
      id: newId,
      name: name.trim(),
      description: description.trim(),
      status: 'idle',
    };
  }

  async sendMessage(agentId: string, content: string, session?: Session): Promise<AgentMessage> {
    if (!session?.accessToken) {
      throw new Error('Sessão necessária para enviar mensagens.');
    }

    const userMessage: AgentMessage = {
      id: uid(),
      agentId,
      role: 'user',
      content,
      createdAt: now(),
      status: 'sent',
    };

    await this.saveLocalMessage(userMessage);

    // Call live backend agent execution API
    try {
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
        }),
      });

      if (res.ok) {
        const body = await res.json().catch(() => ({}));
        const run = body?.run;
        const answer =
          run?.final_output ||
          run?.output ||
          run?.summary ||
          run?.last_error ||
          (run?.status === 'running'
            ? 'Missão em execução no backend do CELL SYSTEM...'
            : null);

        if (answer) {
          const assistantMessage: AgentMessage = {
            id: uid(),
            agentId,
            role: 'assistant',
            content: typeof answer === 'string' ? answer : JSON.stringify(answer, null, 2),
            createdAt: now(),
            status: 'sent',
          };
          await this.saveLocalMessage(assistantMessage);
        }
      }
    } catch {
      // Message was already saved locally
    }

    return userMessage;
  }

  async getMessages(agentId: string, session?: Session): Promise<AgentMessage[]> {
    const local = await this.getLocalMessages();
    const forAgent = local.filter((m) => m.agentId === agentId);

    if (!session?.accessToken) {
      return forAgent;
    }

    // Attempt to pull synced runs from backend
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
                createdAt: r.created_at || now(),
                status: 'sent',
              });
            }
            const out = r.final_output || r.output || r.last_error;
            if (out) {
              remoteMessages.push({
                id: `remote_a_${r.id}`,
                agentId,
                role: 'assistant',
                content: typeof out === 'string' ? out : JSON.stringify(out, null, 2),
                createdAt: r.finished_at || r.updated_at || now(),
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
      // Return local messages on network failure
    }

    return forAgent;
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
        name: 'Plugin de Pesquisa',
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
      const res = await fetch(`${apiBaseUrl}/api/credentials`, {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          'x-workspace-id': session.workspaceId || 'ws_default',
        },
      });

      if (res.ok) {
        const data = await res.json().catch(() => []);
        const creds = Array.isArray(data) ? data : [];
        const credNames = new Set(creds.map((c: any) => String(c.provider || c.name || '').toLowerCase()));

        return defaultCatalog.map((item) => {
          if (item.kind === 'Cells') return item;
          if (item.id === 'conn_gdrive') return { ...item, connected: credNames.has('google') || credNames.has('google_drive') };
          if (item.id === 'conn_github') return { ...item, connected: credNames.has('github') };
          if (item.id === 'conn_search') return { ...item, connected: credNames.has('tavily') || credNames.has('brave') || credNames.has('search') };
          if (item.id === 'conn_mcp') return { ...item, connected: credNames.has('mcp') };
          return item;
        });
      }
    } catch {
      // Return default catalog on error
    }

    return defaultCatalog;
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
      // Fallback below
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

  async registerPush(token: string): Promise<void> {
    try {
      await SecureStore.setItemAsync('cell_expo_push_token', token);
    } catch {
      // Push token local caching
    }
  }
}

export const gateway: CellGateway = new RealCellGateway();
