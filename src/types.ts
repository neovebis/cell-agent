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

export interface AgentAvatarChoice {
  shape: 'circle' | 'heart' | 'diamond' | 'spade' | 'club';
  color: 'black' | 'turquoise' | 'cyan' | 'neonBlue' | 'lilac' | 'lightPurple';
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  status?: 'idle' | 'running' | 'paused';
  icon?: string;
  avatar?: AgentAvatarChoice;
  config?: AgentConfig;
  grants?: AgentGrants;
  workflowId?: string;
  workspaceId?: string;
  createdAt?: string;
  updatedAt?: string;
  nodes?: AgentCell[];
}

export interface AgentMessage {
  id: string;
  agentId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  status?: 'sending' | 'sent' | 'failed';
  attachments?: { name: string; mimeType: string }[];
  runId?: string;
  pendingId?: string;
  error?: string;
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
  mimeType?: string;
  size?: number;
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
  refreshToken?: string;
  expiresAt?: number;
}

export interface CellCatalogEntry {
  id: string;
  canonicalType: string;
  label: string;
  category: string;
  badge?: string;
  accentColor?: string;
  description: string;
  icon: string;
  aliases?: string[];
  community?: boolean;
  workspaceId?: string;
}

export interface AgentCell {
  id: string;
  type: string;
  name: string;
  credentialId?: string;
  kind: 'Cells' | 'Skills' | 'Conectores';
  provider?: string;
}

export type RunStatus =
  | 'queued'
  | 'running'
  | 'paused'
  | 'waiting_approval'
  | 'success'
  | 'failed'
  | 'cancelled'
  | 'expired';
export type RunOperation = 'pause' | 'resume' | 'cancel' | 'approve';
export interface AgentFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  sha256?: string;
}
export interface AgentRun {
  id: string;
  workflowId: string;
  status: RunStatus;
  message: string;
  answer?: string;
  summary?: string;
  createdAt: string;
  updatedAt: string;
  retryAt?: string;
  modelCalls?: number;
  maxModelCalls?: number;
  toolCalls?: number;
  maxToolCalls?: number;
  approvalHash?: string;
  approval?: { reason: string; action?: unknown } | null;
  observations?: {
    tool?: string;
    success?: boolean;
    error?: string;
    result?: unknown;
  }[];
  events?: { event?: string; summary?: string; createdAt?: string }[];
  files?: AgentFile[];
  generatedFiles?: AgentFile[];
}

export interface PendingMessage {
  id: string;
  workflowId: string;
  content: string;
  createdAt: string;
  files: FileAttachment[];
  runId?: string;
  status: 'sending' | 'failed' | 'sent';
  error?: string;
}
export interface AgentDraft {
  text: string;
  attachment: FileAttachment | null;
}
