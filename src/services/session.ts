import * as SecureStore from 'expo-secure-store';
import type { Session } from '../types';
const KEY = 'cell_agent_existing_backend_session';
export async function loadSession(): Promise<Session | null> {
  try { const value = await SecureStore.getItemAsync(KEY); return value ? JSON.parse(value) as Session : null; }
  catch { return null; }
}
export async function saveSession(session: Session): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(session));
}
export async function forgetSession(): Promise<void> { await SecureStore.deleteItemAsync(KEY); }
