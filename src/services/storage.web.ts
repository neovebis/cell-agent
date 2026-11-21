import type { KeyValueStore } from './contracts';

let opened: Promise<IDBDatabase> | undefined;
function database() {
  opened ||= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('cell-agent-cache', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('cache');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(new Error('Não foi possível abrir o armazenamento local.'));
  }).catch((error) => {
    opened = undefined;
    throw error;
  });
  return opened;
}
async function transaction<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore, done: (value: T) => void) => void,
): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('cache', mode);
    let value: T;
    tx.oncomplete = () => resolve(value);
    tx.onerror = () =>
      reject(new Error('Não foi possível guardar os dados neste dispositivo.'));
    tx.onabort = tx.onerror;
    work(tx.objectStore('cache'), (result) => {
      value = result;
    });
  });
}
export const localStore: KeyValueStore = {
  get<T>(key: string) {
    return transaction<T | null>('readonly', (store, done) => {
      const request = store.get(key);
      request.onsuccess = () => done(request.result ?? null);
    });
  },
  async set(key, value) {
    await transaction<void>('readwrite', (store) => {
      store.put(value, key);
    });
  },
  async remove(key) {
    await transaction<void>('readwrite', (store) => {
      store.delete(key);
    });
  },
  async removePrefix(prefix) {
    await transaction<void>('readwrite', (store) => {
      const request = store.openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          if (String(cursor.key).startsWith(prefix)) cursor.delete();
          cursor.continue();
        }
      };
    });
  },
};
