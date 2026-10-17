// IndexedDB: everything the tool keeps lives here, on this device.
//   books      book documents (JSON)
//   assets     photos, logos and font files as Blobs, with their previews
//   templates  the layout template library
//   meta       settings such as the open book and the backup folder handle

const DB_NAME = 'photobook';
const DB_VERSION = 1;
const STORES = ['books', 'assets', 'templates', 'meta'];

let dbp;
function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = () => {
      for (const s of STORES) if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s, { keyPath: s === 'meta' ? 'key' : 'id' });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  return dbp;
}

function req(r) {
  return new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
}

async function tx(store, mode, fn) {
  const db = await open();
  const t = db.transaction(store, mode);
  const res = await fn(t.objectStore(store));
  await new Promise((resolve, reject) => { t.oncomplete = resolve; t.onerror = () => reject(t.error); t.onabort = () => reject(t.error); });
  return res;
}

export const db = {
  get: (store, id) => tx(store, 'readonly', (s) => req(s.get(id))),
  all: (store) => tx(store, 'readonly', (s) => req(s.getAll())),
  keys: (store) => tx(store, 'readonly', (s) => req(s.getAllKeys())),
  put: (store, value) => tx(store, 'readwrite', (s) => req(s.put(value))),
  putMany: (store, values) => tx(store, 'readwrite', (s) => Promise.all(values.map((v) => req(s.put(v))))),
  del: (store, id) => tx(store, 'readwrite', (s) => req(s.delete(id))),
  clear: (store) => tx(store, 'readwrite', (s) => req(s.clear())),
  async meta(key, value) {
    if (value === undefined) return (await db.get('meta', key))?.value;
    return db.put('meta', { key, value });
  },
};

export async function requestPersistence() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) return await navigator.storage.persist();
    return true;
  } catch { return false; }
}

export async function storageEstimate() {
  try { return await navigator.storage.estimate(); } catch { return null; }
}
