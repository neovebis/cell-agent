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
    session?: Session
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
}
