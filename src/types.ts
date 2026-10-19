export type Tab = 'Chat' | 'Capture' | 'Conectores' | 'Atividade' | 'Perfil';
export type Agent = { id: string; name: string; description: string; status?: 'idle' | 'running' | 'paused'; icon?: string };
export type AgentMessage = { id: string; agentId: string; role: 'user'|'assistant'|'system'; content: string; createdAt: string; status?: 'sending'|'sent'|'failed' };
export type CaptureItem = { id: string; title: string; source: string; type: 'image'|'video'|'document'|'text'; createdAt: string; uri?: string; note?: string; synced?: boolean };
export type Connection = { id: string; name: string; kind: 'Conectores'|'Plugins'|'MCP'|'Skills'|'Cells'; description: string; connected: boolean };
export type ActivityItem = { id: string; title: string; subtitle: string; kind: 'complete'|'approval'|'failed'|'running'; createdAt: string; agentId?: string };
export type Session = { accessToken: string; displayName: string; email?: string; workspaceId?: string; userId?: string };
export type Notice = { title: string; message: string; type?: 'error'|'success'|'info' };
export interface CellGateway {
  readonly demo: boolean;
  signIn(email: string, password: string): Promise<Session>;
  getAgents(session?: Session): Promise<Agent[]>;
  createAgent(name: string, description: string, session?: Session): Promise<Agent>;
  getMessages(agentId: string, session?: Session): Promise<AgentMessage[]>;
  sendMessage(agentId: string, content: string, session?: Session): Promise<AgentMessage>;
  getCaptures(session?: Session): Promise<CaptureItem[]>;
  saveCapture(item: Omit<CaptureItem, 'id'|'createdAt'|'synced'>, session?: Session): Promise<CaptureItem>;
  getConnections(session?: Session): Promise<Connection[]>;
  getActivity(session?: Session): Promise<ActivityItem[]>;
  registerPush(token: string, session?: Session): Promise<void>;
}
