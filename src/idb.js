// Minimal IndexedDB wrapper (works in Chrome, Edge, Safari/iOS)
const DB = 'oikonomika', VER = 1;
let dbp = null;
function open() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB, VER);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      if (!db.objectStoreNames.contains('base')) db.createObjectStore('base');
      if (!db.objectStoreNames.contains('ops')) db.createObjectStore('ops', { keyPath: 'k' });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}
const tx = async (store, mode, fn) => {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction(store, mode); const s = t.objectStore(store);
    const out = fn(s);
    t.oncomplete = () => res(out && 'result' in out ? out.result : out);
    t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
  });
};
export const kvGet = (k) => tx('kv', 'readonly', (s) => s.get(k));
export const kvSet = (k, v) => tx('kv', 'readwrite', (s) => s.put(v, k));
export const baseGet = (k) => tx('base', 'readonly', (s) => s.get(k));
export const baseSet = (k, v) => tx('base', 'readwrite', (s) => s.put(v, k));
export const opsAll = () => tx('ops', 'readonly', (s) => s.getAll());
export const opsPut = (list) => tx('ops', 'readwrite', (s) => { for (const o of list) s.put(o); });
export const wipe = async () => { const db = await open(); for (const st of ['kv', 'base', 'ops']) await tx(st, 'readwrite', (s) => s.clear()); return db; };
