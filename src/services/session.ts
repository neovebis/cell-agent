import * as SecureStore from 'expo-secure-store';
import type { Session } from '../types';
const KEY = 'cell_agent_session_v3';
let writes: Promise<unknown> = Promise.resolve();
export async function loadSession(): Promise<Session | null> {
  try {
    const value = await SecureStore.getItemAsync(KEY);
    const session = value ? (JSON.parse(value) as Session) : null;
    return session?.userId && session.refreshToken ? session : null;
  } catch {
    return null;
  }
}
export async function saveSession(session: Session): Promise<void> {
  const value = JSON.stringify(session);
  const next = writes
    .catch(() => {})
    .then(() => SecureStore.setItemAsync(KEY, value));
  writes = next;
  await next;
}
export async function forgetSession(): Promise<void> {
  const next = writes
    .catch(() => {})
    .then(async () => {
      await SecureStore.deleteItemAsync(KEY);
      await SecureStore.deleteItemAsync('cell_agent_existing_backend_session');
    });
  writes = next;
  await next;
}
