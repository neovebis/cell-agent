export type Tab = 'Chat' | 'Capture' | 'Conectores' | 'Atividade' | 'Perfil';

export interface AgentConfig {
  provider: string; // 'openai' | 'anthropic' | 'google' | 'groq' | 'mistral' | 'deepseek'
  model: string;
  role?: string;
  systemPrompt?: string;
  maxModelCalls?: number;
  maxToolCalls?: number;
  maxOutputTokens?: number;
  maxDurationSeconds?: number;
  temperature?: number;
  concurrency?: number;
  credentialId?: string;
}

export interface AgentGrants {
  editGraph: boolean;
  executeCode: boolean;
  webSearch?: boolean;
  teams: boolean;
  externalEffects: boolean;
  verificationRequired?: boolean;
  executeNodes?: string[];
  credentialIds?: string[];
  variableNames?: string[];
}

export interface AgentProfile {
  workflowId: string;
  config: AgentConfig;
  grants: AgentGrants;
  revision?: number;
}

export interface FileAttachment {
  name: string;
  mimeType: string;
  data: string; // base64
  uri?: string;
  size?: number;
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  status?: 'idle' | 'running' | 'paused';
  icon?: string;
  config?: AgentConfig;
  grants?: AgentGrants;
  workflowId?: string;
  workspaceId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AgentMessage {
  id: string;
  agentId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  status?: 'sending' | 'sent' | 'failed';
  attachments?: { name: string; mimeType: string }[];
  /** Optional structured "smart UI" rendered below the text. */
  ui?: SmartUi;
}

export type UiTone = 'up' | 'down' | 'flat';
export interface UiFormField {
  name: string;
  label: string;
  kind: 'text' | 'number' | 'select' | 'toggle';
  options?: string[];
  required?: boolean;
  placeholder?: string;
}
export interface SendOptions {
  /** Called as soon as the backend accepts the run (POST succeeded). */
  onAccepted?: () => void;
  /**
   * Smart-UI interaction: if the POST fails, the local user message is removed and the
   * error is thrown (no error bubble) so the block can offer "Tentar novamente".
   */
  interaction?: boolean;
}

/** A submitted answer to an interactive block (persisted locally so the block stays locked). */
export interface UiAnswer {
  action: string;
  values: Record<string, unknown>;
  summary: string;
}
export type UiBlock =
  | { type: 'prose'; text: string }
  | { type: 'callout'; title?: string; text: string }
  | { type: 'kpis'; items: { label: string; value: string; delta?: string; hint?: string; tone?: UiTone }[] }
  | {
      type: 'table';
      title?: string;
      columns: { key: string; label: string; align?: 'left' | 'right' }[];
      rows: Record<string, string>[];
    }
  | { type: 'bars'; title?: string; unit?: string; items: { label: string; value: number; note?: string }[] }
  | { type: 'steps'; title?: string; items: { title: string; detail?: string }[] }
  | { type: 'checklist'; title?: string; items: { label: string; done?: boolean }[] }
  | { type: 'chart'; title?: string; kind: 'bar' | 'line' | 'area' | 'pie'; xKey: string; series: { key: string; label: string }[]; data: Record<string, string | number>[] }
  | { type: 'choices'; id: string; title?: string; multi?: boolean; submit?: string; options: { id: string; label: string }[] }
  | { type: 'confirm'; id: string; title?: string; text: string; approve?: string; reject?: string; tone?: 'danger' }
  | { type: 'form'; id: string; title?: string; submit?: string; fields: UiFormField[] }
  | {
      type: 'timeline';
      title?: string;
      events: { when: string; title: string; detail?: string; state?: 'done' | 'now' | 'next' }[];
    };

export interface SmartUi {
  v: 1;
  title?: string;
  kicker?: string;
  summary?: string;
  blocks: UiBlock[];
}

export interface CaptureItem {
  id: string;
  title: string;
  source: string;
  type: 'image' | 'video' | 'document' | 'text';
  createdAt: string;
  uri?: string;
  note?: string;
  base64?: string;
  synced?: boolean;
}

export interface Connection {
  id: string;
  name: string;
  kind: 'Conectores' | 'Plugins' | 'MCP' | 'Skills' | 'Cells';
  description: string;
  connected: boolean;
}

export interface ActivityItem {
  id: string;
  title: string;
  subtitle: string;
  kind: 'complete' | 'approval' | 'failed' | 'running';
  createdAt: string;
  agentId?: string;
}

export interface WorkspaceInfo {
  id: string;
  name: string;
  plan?: string;
  owner_id?: string;
  createdAt?: string;
}

export interface CredentialVaultItem {
  id: string;
  name: string;
  provider: string;
  maskedKey?: string;
  created_at?: string;
}

export interface GlobalVariableItem {
  id: string;
  name: string;
  key: string;
  maskedValue?: string;
  created_at?: string;
}

export interface Session {
  accessToken: string;
  refreshToken?: string;
  /** Epoch ms when accessToken expires. */
  expiresAt?: number;
  displayName: string;
  email?: string;
  workspaceId?: string;
  userId?: string;
}

export interface Notice {
  title: string;
  message: string;
  type?: 'error' | 'success' | 'info';
}

export interface CellGateway {
  readonly demo: boolean;
  signIn(email: string, password: string): Promise<Session>;
  getAgents(session?: Session): Promise<Agent[]>;
  createAgent(name: string, description: string, session?: Session): Promise<Agent>;
  getAgentProfile(workflowId: string, session?: Session): Promise<AgentProfile | null>;
  saveAgentProfile(workflowId: string, profile: Partial<AgentProfile>, session?: Session): Promise<void>;
  getMessages(agentId: string, session?: Session): Promise<AgentMessage[]>;
  sendMessage(
    agentId: string,
    content: string,
    attachments?: FileAttachment[],
    session?: Session,
    opts?: SendOptions
  ): Promise<AgentMessage>;
  clearMessages(agentId: string): Promise<void>;
  getCaptures(session?: Session): Promise<CaptureItem[]>;
  saveCapture(
    item: Omit<CaptureItem, 'id' | 'createdAt' | 'synced'>,
    session?: Session
  ): Promise<CaptureItem>;
  uploadCaptureFile(item: CaptureItem, session?: Session): Promise<string>;
  getConnections(session?: Session): Promise<Connection[]>;
  getActivity(session?: Session): Promise<ActivityItem[]>;
  getWorkspaces(session?: Session): Promise<WorkspaceInfo[]>;
  getCredentials(session?: Session): Promise<CredentialVaultItem[]>;
  getVariables(session?: Session): Promise<GlobalVariableItem[]>;
  registerPush(token: string, session?: Session): Promise<void>;
  /** Optional hook fired when the session expired and could not be refreshed. */
  onSessionExpired?: () => void;
}
