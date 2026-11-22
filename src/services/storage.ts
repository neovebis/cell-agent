import { openDatabaseAsync } from 'expo-sqlite';
import type { KeyValueStore } from './contracts';

let opened: ReturnType<typeof openDatabaseAsync> | undefined;
function database() {
  opened ||= openDatabaseAsync('cell-agent-cache.db')
    .then(async (db) => {
      await db.execAsync(
        'PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS mobile_cache (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);',
      );
      return db;
    })
    .catch((error) => {
      opened = undefined;
      throw error;
    });
  return opened;
}
export const localStore: KeyValueStore = {
  async get<T>(key: string) {
    const row = await (
      await database()
    ).getFirstAsync<{ value: string }>(
      'SELECT value FROM mobile_cache WHERE key = ?',
      key,
    );
    return row ? (JSON.parse(row.value) as T) : null;
  },
  async set(key, value) {
    await (
      await database()
    ).runAsync(
      'INSERT INTO mobile_cache(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
      key,
      JSON.stringify(value),
    );
  },
  async remove(key) {
    await (
      await database()
    ).runAsync('DELETE FROM mobile_cache WHERE key = ?', key);
  },
  async removePrefix(prefix) {
    await (
      await database()
    ).runAsync(
      'DELETE FROM mobile_cache WHERE substr(key, 1, ?) = ?',
      prefix.length,
      prefix,
    );
  },
};
