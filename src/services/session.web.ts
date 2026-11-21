import type { Session } from '../types';
const KEY = 'cell_agent_session_v3';
export async function loadSession(): Promise<Session | null> {
  try {
    const value = sessionStorage.getItem(KEY);
    const session = value ? (JSON.parse(value) as Session) : null;
    return session?.userId && session.refreshToken ? session : null;
  } catch {
    return null;
  }
}
export async function saveSession(session: Session): Promise<void> {
  sessionStorage.setItem(KEY, JSON.stringify(session));
}
export async function forgetSession(): Promise<void> {
  sessionStorage.removeItem(KEY);
}
