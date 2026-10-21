import * as SecureStore from 'expo-secure-store';
import { forgetSession, saveSession } from './session';
import { parseAgentOutput, stripUiInstruction, withUiInstruction } from './smartui';
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
  SendOptions,
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

  /** Called when the session can no longer be refreshed (user must sign in again). */
  onSessionExpired?: () => void;

  private refreshing: Promise<boolean> | null = null;

  private async refreshSession(session: Partial<Session>): Promise<boolean> {
    if (!session.refreshToken) return false;
    if (!this.refreshing) {
      this.refreshing = (async () => {
        try {
          const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
            method: 'POST',
            headers: { apikey: supabaseAnonKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: session.refreshToken }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data.access_token) return false;
          session.accessToken = data.access_token;
          session.refreshToken = data.refresh_token || session.refreshToken;
          session.expiresAt = Date.now() + Number(data.expires_in || 3600) * 1000;
          if (session.displayName) await saveSession(session as Session).catch(() => {});
          return true;
        } catch {
          return false;
        }
      })().finally(() => {
        this.refreshing = null;
      });
    }
    return this.refreshing;
  }

  private async expireSession(): Promise<void> {
    await forgetSession().catch(() => {});
    this.onSessionExpired?.();
  }

  /**
   * fetch with the session's bearer token: refreshes shortly before expiry and,
   * on a 401, refreshes once and retries. Clears the session if refresh fails.
   */
  private async authFetch(session: Partial<Session>, url: string, init: RequestInit = {}): Promise<Response> {
    if (session.refreshToken && session.expiresAt && Date.now() > session.expiresAt - 60_000) {
      if (!(await this.refreshSession(session))) await this.expireSession();
    }
    const withToken = (): RequestInit => ({
      ...init,
      headers: { ...((init.headers as Record<string, string>) || {}), Authorization: `Bearer ${session.accessToken}` },
    });
    const res = await fetch(url, withToken());
    if (res.status !== 401 || !session.refreshToken) return res;
    if (!(await this.refreshSession(session))) {
      await this.expireSession();
      return res;
    }
    return fetch(url, withToken());
  }

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

  private async removeLocalMessage(id: string): Promise<void> {
    try {
      const list = await this.getLocalMessages();
      await SecureStore.setItemAsync(MESSAGES_STORAGE_KEY, JSON.stringify(list.filter((m) => m.id !== id)));
    } catch {
      // Non-fatal
    }
  }

  async clearMessages(agentId: string): Promise<void> {
    const cleanId = agentId.includes(':') ? agentId.split(':')[0] : agentId;
    try {
      const list = await this.getLocalMessages();
      const filtered = list.filter((m) => m.agentId !== agentId && m.agentId !== cleanId);
      await SecureStore.setItemAsync(MESSAGES_STORAGE_KEY, JSON.stringify(filtered));
    } catch {
      // Non-fatal
    }
  }

  private async bootstrapWorkspace(accessToken: string): Promise<string | null> {
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/rpc/bootstrap_cell_workspace`, {
        method: 'POST',
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ p_name: 'Espaço Pessoal', p_region: 'eu-central-1' }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.workspace?.id) return String(data.workspace.id);
      }
    } catch {
      // Non-fatal
    }
    return null;
  }

  private async resolveActiveWorkspace(session: { accessToken: string; userId?: string }): Promise<string> {
    // 1. Try cells_workspaces table
    try {
      const res = await this.authFetch(session, 
        `${supabaseUrl}/rest/v1/cells_workspaces?select=id,name,tier&order=created_at.desc&limit=1`,
        {
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${session.accessToken}`,
          },
        }
      );
      if (res.ok) {
        const list = await res.json().catch(() => []);
        if (Array.isArray(list) && list[0]?.id) {
          return String(list[0].id);
        }
      }
    } catch {}

    // 2. Try cells_workspace_members table
    if (session.userId) {
      try {
        const memRes = await this.authFetch(session, 
          `${supabaseUrl}/rest/v1/cells_workspace_members?user_id=eq.${encodeURIComponent(session.userId)}&status=eq.active&select=workspace_id&limit=1`,
          {
            headers: {
              apikey: supabaseAnonKey,
              Authorization: `Bearer ${session.accessToken}`,
            },
          }
        );
        if (memRes.ok) {
          const memList = await memRes.json().catch(() => []);
          if (Array.isArray(memList) && memList[0]?.workspace_id) {
            return String(memList[0].workspace_id);
          }
        }
      } catch {}
    }

    // 3. Try cells_workflows to see where existing workflows live
    try {
      const wfRes = await this.authFetch(session, 
        `${supabaseUrl}/rest/v1/cells_workflows?select=workspace_id&order=updated_at.desc&limit=1`,
        {
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${session.accessToken}`,
          },
        }
      );
      if (wfRes.ok) {
        const wfList = await wfRes.json().catch(() => []);
        if (Array.isArray(wfList) && wfList[0]?.workspace_id) {
          return String(wfList[0].workspace_id);
        }
      }
    } catch {}

    // 4. Try bootstrap_cell_workspace RPC
    const bootstrapped = await this.bootstrapWorkspace(session.accessToken);
    if (bootstrapped) return bootstrapped;

    return 'ws_default';
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

    const workspaceId = await this.resolveActiveWorkspace({ accessToken, userId });

    return {
      accessToken,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000,
      displayName,
      email: userEmail,
      workspaceId,
      userId,
    };
  }

  async getWorkspaces(session?: Session): Promise<WorkspaceInfo[]> {
    if (!session?.accessToken) return [];

    // Query cells_workspaces table (tier column, not plan)
    try {
      const res = await this.authFetch(session, 
        `${supabaseUrl}/rest/v1/cells_workspaces?select=id,name,tier,owner_id,created_at&order=created_at.desc`,
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
            plan: w.tier || 'Free',
            owner_id: w.owner_id,
            createdAt: w.created_at,
          }));
        }
      }
    } catch {
      // Fallback
    }

    // Query cells_workspace_members if cells_workspaces is empty
    if (session.userId) {
      try {
        const memRes = await this.authFetch(session, 
          `${supabaseUrl}/rest/v1/cells_workspace_members?user_id=eq.${encodeURIComponent(session.userId)}&status=eq.active&select=workspace_id,role`,
          {
            headers: {
              apikey: supabaseAnonKey,
              Authorization: `Bearer ${session.accessToken}`,
            },
          }
        );
        if (memRes.ok) {
          const memRows = await memRes.json().catch(() => []);
          if (Array.isArray(memRows) && memRows.length > 0) {
            return memRows.map((m: any) => ({
              id: String(m.workspace_id),
              name: `Espaço (${m.role})`,
              plan: m.role === 'owner' ? 'Pro' : 'Membro',
            }));
          }
        }
      } catch {}
    }

    return [{ id: session.workspaceId || 'ws_default', name: 'Espaço Pessoal (Ativo)', plan: 'Pro' }];
  }

  async getAgents(session?: Session): Promise<Agent[]> {
    if (!session?.accessToken) return [];

    try {
      // Query without hardcoded workspace_id filter so Supabase RLS returns all workflows the user can access
      const res = await this.authFetch(session, 
        `${supabaseUrl}/rest/v1/cells_workflows?select=id,name,description,graph,viewport,workspace_id,user_id,is_active,created_at,updated_at&order=updated_at.desc&limit=100`,
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
          // If session workspaceId is not set or default, auto-update it with the first real workspace_id found
          if (rows.length > 0 && (!session.workspaceId || session.workspaceId === 'ws_default')) {
            const realWsId = rows[0].workspace_id;
            if (realWsId && realWsId !== 'ws_default') {
              session.workspaceId = realWsId;
            }
          }

          const extractedAgents: Agent[] = [];

          // Only show workflows from the currently selected workspace
          const activeWsId = session.workspaceId && session.workspaceId !== 'ws_default' ? session.workspaceId : null;
          const scopedRows = activeWsId ? rows.filter((w: any) => w.workspace_id === activeWsId) : rows;

          for (const w of scopedRows) {
            const rawNodes = Array.isArray(w.graph?.nodes) ? w.graph.nodes : [];
            const agentNodes = rawNodes.filter(
              (n: any) =>
                n.type === 'agent' ||
                n.type === 'circa_agent' ||
                n.canonicalType === 'agent' ||
                n.id === 'agent-central'
            );

            const baseStatus: Agent['status'] = w.is_active === false ? 'paused' : 'idle';

            if (agentNodes.length === 1) {
              const node = agentNodes[0];
              extractedAgents.push({
                id: String(w.id),
                name: String(node.title || node.config?.role || w.name || 'Agente'),
                description: String(
                  node.config?.systemPrompt ||
                  node.config?.prompt ||
                  node.config?.role ||
                  w.description ||
                  'Agente autónomo do CELL SYSTEM'
                ),
                status: baseStatus,
                workflowId: String(w.id),
                workspaceId: String(w.workspace_id || ''),
                createdAt: w.created_at,
                updatedAt: w.updated_at,
                config: node.config
                  ? {
                      provider: node.config.provider || 'google',
                      model: node.config.model || 'gemini-1.5-pro',
                      role: node.config.role || node.title || w.name,
                      systemPrompt: node.config.systemPrompt || node.config.prompt || '',
                      temperature: node.config.temperature ?? 0.7,
                      maxModelCalls: node.config.maxIterations ?? 24,
                      credentialId: node.config.credentialId,
                    }
                  : undefined,
              });
            } else if (agentNodes.length > 1) {
              for (const node of agentNodes) {
                extractedAgents.push({
                  id: `${w.id}:${node.id}`,
                  name: String(node.title || node.config?.role || `${w.name} - Agente`),
                  description: String(
                    node.config?.systemPrompt ||
                    node.config?.prompt ||
                    node.config?.role ||
                    w.description ||
                    'Agente especialista autónomo'
                  ),
                  status: baseStatus,
                  workflowId: String(w.id),
                  workspaceId: String(w.workspace_id || ''),
                  createdAt: w.created_at,
                  updatedAt: w.updated_at,
                  config: node.config
                    ? {
                        provider: node.config.provider || 'google',
                        model: node.config.model || 'gemini-1.5-pro',
                        role: node.config.role || node.title || w.name,
                        systemPrompt: node.config.systemPrompt || node.config.prompt || '',
                        temperature: node.config.temperature ?? 0.7,
                        maxModelCalls: node.config.maxIterations ?? 24,
                        credentialId: node.config.credentialId,
                      }
                    : undefined,
                });
              }
            } else {
              // 0 agent nodes: Workflow itself acts as the Central Agent
              extractedAgents.push({
                id: String(w.id),
                name: String(w.name || 'Agente Central'),
                description: String(w.description || 'Agente orquestrador do CELL SYSTEM'),
                status: baseStatus,
                workflowId: String(w.id),
                workspaceId: String(w.workspace_id || ''),
                createdAt: w.created_at,
                updatedAt: w.updated_at,
                config: {
                  provider: 'google',
                  model: 'gemini-1.5-pro',
                  role: String(w.name || 'Agente Central'),
                  systemPrompt: String(w.description || 'És um agente inteligente do CELL SYSTEM.'),
                  temperature: 0.7,
                  maxModelCalls: 24,
                },
              });
            }
          }

          return extractedAgents;
        }
      }
    } catch {
      // Network error
    }

    return [];
  }

  async createAgent(name: string, description: string, session?: Session): Promise<Agent> {
    if (!session?.accessToken) {
      throw new Error('Sessão necessária para criar agentes.');
    }

    let targetWsId = session.workspaceId;
    if (!targetWsId || targetWsId === 'ws_default') {
      targetWsId = await this.resolveActiveWorkspace(session);
      session.workspaceId = targetWsId;
    }

    let userId = session.userId;
    if (!userId) {
      try {
        const uRes = await this.authFetch(session, `${supabaseUrl}/auth/v1/user`, {
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${session.accessToken}`,
          },
        });
        if (uRes.ok) {
          const uData = await uRes.json().catch(() => ({}));
          userId = uData?.id || '';
          session.userId = userId;
        }
      } catch {}
    }

    const newId = `wf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const agentNodeId = `ag_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const trimmedName = name.trim();
    const trimmedDesc = description.trim() || 'Agente autónomo CELL SYSTEM';

    const payload = {
      id: newId,
      name: trimmedName,
      description: trimmedDesc,
      workspace_id: targetWsId,
      user_id: userId,
      is_active: true,
      version: '1.0.0',
      viewport: { x: 40, y: 40, zoom: 0.92 },
      graph: {
        id: newId,
        name: trimmedName,
        nodes: [
          {
            id: agentNodeId,
            type: 'agent',
            title: trimmedName,
            x: 350,
            y: 280,
            config: {
              role: trimmedName,
              systemPrompt: trimmedDesc,
              provider: 'google',
              model: 'gemini-1.5-pro',
              temperature: 0.7,
              maxIterations: 10,
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

    let res = await this.authFetch(session, `${supabaseUrl}/rest/v1/cells_workflows`, {
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
      // If RLS permission error on workspace, bootstrap a personal workspace and retry
      if (res.status === 403 || res.status === 400 || err.code === '42501') {
        const freshWsId = await this.bootstrapWorkspace(session.accessToken);
        if (freshWsId && freshWsId !== targetWsId) {
          payload.workspace_id = freshWsId;
          session.workspaceId = freshWsId;
          targetWsId = freshWsId;
          res = await this.authFetch(session, `${supabaseUrl}/rest/v1/cells_workflows`, {
            method: 'POST',
            headers: {
              apikey: supabaseAnonKey,
              Authorization: `Bearer ${session.accessToken}`,
              'Content-Type': 'application/json',
              Prefer: 'return=representation',
            },
            body: JSON.stringify(payload),
          });
        }
      }

      if (!res.ok) {
        const errRetry = await res.json().catch(() => ({}));
        throw new Error(errRetry.message || err.message || 'Não foi possível criar o agente.');
      }
    }

    // Attempt to register central profile on backend if credential exists
    try {
      const creds = await this.getCredentials(session);
      const modelCred = creds.find((c) => ['google', 'openai', 'anthropic'].includes(c.provider.toLowerCase())) || creds[0];
      if (modelCred) {
        await this.saveAgentProfile(
          newId,
          {
            workflowId: newId,
            config: {
              provider: modelCred.provider.toLowerCase().includes('openai')
                ? 'openai'
                : modelCred.provider.toLowerCase().includes('anthropic')
                ? 'anthropic'
                : 'google',
              model: modelCred.provider.toLowerCase().includes('openai')
                ? 'gpt-4o'
                : modelCred.provider.toLowerCase().includes('anthropic')
                ? 'claude-3-5-sonnet-20241022'
                : 'gemini-1.5-pro',
              role: trimmedName,
              systemPrompt: trimmedDesc,
              maxModelCalls: 24,
              maxToolCalls: 32,
              maxOutputTokens: 2048,
              maxDurationSeconds: 1800,
              temperature: 0.7,
              concurrency: 2,
              credentialId: modelCred.id,
            },
            grants: {
              editGraph: false,
              executeCode: true,
              webSearch: true,
              teams: false,
              externalEffects: false,
              verificationRequired: false,
              executeNodes: [],
              credentialIds: [modelCred.id],
              variableNames: [],
            },
          },
          session
        );
      }
    } catch {
      // Non-fatal
    }

    return {
      id: newId,
      name: trimmedName,
      description: trimmedDesc,
      status: 'idle',
      workflowId: newId,
      workspaceId: targetWsId,
      createdAt: payload.created_at,
      updatedAt: payload.updated_at,
      config: payload.graph.nodes[0].config,
    };
  }

  async getAgentProfile(workflowId: string, session?: Session): Promise<AgentProfile | null> {
    if (!session?.accessToken) return null;
    const cleanWfId = workflowId.includes(':') ? workflowId.split(':')[0] : workflowId;

    try {
      const res = await this.authFetch(session, 
        `${apiBaseUrl}/api/agents/profile?workflowId=${encodeURIComponent(cleanWfId)}`,
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
            workflowId: cleanWfId,
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
      workflowId: cleanWfId,
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
    const cleanWfId = workflowId.includes(':') ? workflowId.split(':')[0] : workflowId;

    const res = await this.authFetch(session, `${apiBaseUrl}/api/agents/profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.accessToken}`,
        'x-workspace-id': session.workspaceId || 'ws_default',
      },
      body: JSON.stringify({
        workflowId: cleanWfId,
        profile: {
          ...profile.config,
          grants: profile.grants,
        },
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Falha ao guardar configurações do agente.');
    }
  }

  async sendMessage(
    agentId: string,
    content: string,
    attachments?: FileAttachment[],
    session?: Session,
    opts?: SendOptions
  ): Promise<AgentMessage> {
    if (!session?.accessToken) {
      throw new Error('Sessão necessária para comunicar com os agentes.');
    }

    const workflowId = agentId.includes(':') ? agentId.split(':')[0] : agentId;

    const userMessage: AgentMessage = {
      id: uid(),
      agentId,
      role: 'user',
      // Hidden interaction payloads are sent to the agent but never shown
      content: stripUiInstruction(content),
      createdAt: now(),
      status: 'sent',
      attachments: attachments?.map((a) => ({ name: a.name, mimeType: a.mimeType })),
    };

    await this.saveLocalMessage(userMessage);

    // Call live backend agent execution API
    let accepted = false;
    try {
      const filesPayload =
        attachments && attachments.length > 0
          ? attachments.map((a) => ({
              name: a.name,
              mimeType: a.mimeType,
              data: a.data,
            }))
          : undefined;

      const res = await this.authFetch(session, `${apiBaseUrl}/api/agents/runs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.accessToken}`,
          'x-workspace-id': session.workspaceId || 'ws_default',
        },
        body: JSON.stringify({
          workflowId,
          // Smart UI: format instruction travels with the message only (stripped from history)
          message: withUiInstruction(content),
          idempotencyKey: uid(),
          files: filesPayload,
        }),
      });

      if (res.ok) {
        accepted = true;
        opts?.onAccepted?.();
        const body = await res.json().catch(() => ({}));
        const runId = body?.run?.id;

        if (runId) {
          // Immediately trigger execution drain tick
          this.authFetch(session, `${apiBaseUrl}/api/agents/tick`, {
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
          let answerUi: AgentMessage['ui'];
          // Poll with backoff (1.5s -> max 6s) for up to ~90s
          const deadline = Date.now() + 90_000;
          for (let attempt = 0; Date.now() < deadline; attempt++) {
            await new Promise((r) => setTimeout(r, Math.min(1500 * 1.35 ** attempt, 6000)));

            const pollRes = await this.authFetch(session, `${apiBaseUrl}/api/agents/runs?id=${encodeURIComponent(runId)}`, {
              headers: {
                Authorization: `Bearer ${session.accessToken}`,
                'x-workspace-id': session.workspaceId || 'ws_default',
              },
            }).catch(() => null);

            if (pollRes && pollRes.ok) {
              const pollData = await pollRes.json().catch(() => ({}));
              const currentRun = pollData?.run;

              if (currentRun?.status === 'success') {
                const raw = currentRun.answer || currentRun.final_output || currentRun.output || currentRun.summary;
                const parsed = raw ? parseAgentOutput(raw) : { text: 'Resposta concluída.' };
                answerText = parsed.text || 'Resposta concluída.';
                answerUi = parsed.ui;
                break;
              } else if (currentRun?.status === 'failed') {
                answerText =
                  currentRun.last_error ||
                  currentRun.summary ||
                  'Ocorreu uma dificuldade ao gerar a resposta. Por favor tenta novamente.';
                break;
              } else if (currentRun?.status === 'waiting_approval') {
                answerText = `A aguardar autorização: ${currentRun.approval?.reason || 'Operação sensível'}`;
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
              ui: answerUi,
            };
            await this.saveLocalMessage(assistantMessage);
          } else {
            // Processing taking longer than usual
            const pendingNotice: AgentMessage = {
              id: uid(),
              agentId,
              role: 'assistant',
              content: `Ainda a terminar o processamento do teu pedido em segundo plano. Podes acompanhar o progresso no separador Atividade.`,
              createdAt: now(),
              status: 'sent',
            };
            await this.saveLocalMessage(pendingNotice);
          }
        }
      } else {
        const errorBody = await res.json().catch(() => ({}));
        throw new Error(errorBody.message || 'Não foi possível contactar o agente neste momento.');
      }
    } catch (e: any) {
      if (opts?.interaction && !accepted) {
        // Interaction not delivered: drop the user bubble and let the block offer a retry
        await this.removeLocalMessage(userMessage.id);
        throw e instanceof Error ? e : new Error('Não foi possível enviar a resposta.');
      }
      const errorMessage: AgentMessage = {
        id: uid(),
        agentId,
        role: 'assistant',
        content: `Não foi possível obter resposta: ${e?.message || 'Verifica a ligação à internet.'}`,
        createdAt: now(),
        status: 'failed',
      };
      await this.saveLocalMessage(errorMessage);
    }

    return userMessage;
  }

  async getMessages(agentId: string, session?: Session): Promise<AgentMessage[]> {
    const workflowId = agentId.includes(':') ? agentId.split(':')[0] : agentId;
    const local = await this.getLocalMessages();
    const forAgent = local.filter(
      (m) => m.agentId === agentId || (agentId.includes(':') && m.agentId === workflowId)
    );

    if (!session?.accessToken) {
      return forAgent;
    }

    try {
      const res = await this.authFetch(session, 
        `${apiBaseUrl}/api/agents/runs?workflowId=${encodeURIComponent(workflowId)}`,
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
                content: stripUiInstruction(String(r.message)),
                createdAt: r.createdAt || r.created_at || now(),
                status: 'sent',
              });
            }
            const out = r.answer || r.final_output || r.output || r.summary || r.last_error;
            if (out) {
              const parsed = parseAgentOutput(out);
              remoteMessages.push({
                id: `remote_a_${r.id}`,
                agentId,
                role: 'assistant',
                ui: parsed.ui,
                content: parsed.text,
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

    // 1. Try Cloudflare Pages /api/credentials
    try {
      const res = await this.authFetch(session, `${apiBaseUrl}/api/credentials`, {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          'x-workspace-id': session.workspaceId || 'ws_default',
        },
      });

      if (res.ok) {
        const data = await res.json().catch(() => []);
        if (Array.isArray(data) && data.length > 0) {
          return data.map((c: any) => ({
            id: String(c.id),
            name: String(c.name || c.provider || 'Credencial'),
            provider: String(c.provider || 'api_key'),
            maskedKey: c.maskedKey || (c.provider ? `${c.provider.toUpperCase()} (••••••)` : '••••••••'),
            created_at: c.created_at,
          }));
        }
      }
    } catch {}

    // 2. Direct Supabase fallback
    try {
      const sbRes = await this.authFetch(session, 
        `${supabaseUrl}/rest/v1/cells_credentials?select=id,name,provider,created_at&order=created_at.desc`,
        {
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${session.accessToken}`,
          },
        }
      );
      if (sbRes.ok) {
        const sbData = await sbRes.json().catch(() => []);
        if (Array.isArray(sbData) && sbData.length > 0) {
          return sbData
            .filter((c: any) => c.provider !== 'variable')
            .map((c: any) => ({
              id: String(c.id),
              name: String(c.name || c.provider || 'Credencial'),
              provider: String(c.provider || 'api_key'),
              maskedKey: `${String(c.provider || 'KEY').toUpperCase()} (••••••)`,
              created_at: c.created_at,
            }));
        }
      }
    } catch {}

    return [];
  }

  async getVariables(session?: Session): Promise<GlobalVariableItem[]> {
    if (!session?.accessToken) return [];

    // 1. Try Cloudflare Pages /api/variables
    try {
      const res = await this.authFetch(session, `${apiBaseUrl}/api/variables`, {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          'x-workspace-id': session.workspaceId || 'ws_default',
        },
      });

      if (res.ok) {
        const data = await res.json().catch(() => []);
        if (Array.isArray(data) && data.length > 0) {
          return data.map((v: any) => ({
            id: String(v.id || v.name),
            name: String(v.name || v.key),
            key: String(v.key || v.name),
            maskedValue: '••••••••',
            created_at: v.created_at,
          }));
        }
      }
    } catch {}

    // 2. Direct Supabase fallback
    try {
      const sbRes = await this.authFetch(session, 
        `${supabaseUrl}/rest/v1/cells_variables?select=id,key,value,is_secret,created_at&order=created_at.desc`,
        {
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${session.accessToken}`,
          },
        }
      );
      if (sbRes.ok) {
        const sbData = await sbRes.json().catch(() => []);
        if (Array.isArray(sbData) && sbData.length > 0) {
          return sbData.map((v: any) => ({
            id: String(v.id),
            name: String(v.key),
            key: String(v.key),
            // Never display secret values; RLS already hides secret rows.
            maskedValue: v.is_secret || v.value == null ? '••••••••' : String(v.value),
            created_at: v.created_at,
          }));
        }
      }
    } catch {}

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

    // 1. Try Cloudflare Pages /api/jobs
    try {
      const res = await this.authFetch(session, `${apiBaseUrl}/api/jobs`, {
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
    } catch {}

    // 2. Direct Supabase fallback via cells_executions
    try {
      const sbRes = await this.authFetch(session, 
        `${supabaseUrl}/rest/v1/cells_executions?select=id,workflow_id,status,trigger_type,started_at,error_message&order=started_at.desc.nullslast&limit=50`,
        {
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${session.accessToken}`,
          },
        }
      );
      if (sbRes.ok) {
        const executions = await sbRes.json().catch(() => []);
        if (Array.isArray(executions) && executions.length > 0) {
          return executions.map((ex: any) => {
            const isComplete = ex.status === 'success' || ex.status === 'completed';
            const isFailed = ex.status === 'failed';
            const isApproval = ex.status === 'paused' || ex.status === 'waiting_approval';
            const kind: ActivityItem['kind'] = isComplete
              ? 'complete'
              : isFailed
              ? 'failed'
              : isApproval
              ? 'approval'
              : 'running';

            return {
              id: String(ex.id),
              title: `Execução ${ex.workflow_id ? ex.workflow_id.slice(0, 14) : 'Manual'}`,
              subtitle: ex.error_message ? `Falha: ${ex.error_message}` : `Estado: ${ex.status}`,
              kind,
              createdAt: ex.started_at || now(),
              agentId: ex.workflow_id,
            };
          });
        }
      }
    } catch {}

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

  async uploadCaptureFile(item: CaptureItem, _session?: Session): Promise<string> {
    if (!item.base64 && !item.uri) {
      throw new Error('Ficheiro sem dados para carregar.');
    }
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
