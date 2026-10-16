/**
 * Post drafts, kept on this device (IndexedDB, so attached photos are kept too). Each member only
 * sees their own. A draft is { id, userId, savedAt, type, form, images: File[] }.
 */
const DB = 'tectum-drafts';
const STORE = 'drafts';

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' }).createIndex('userId', 'userId');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => {
      db.close();
      resolve(req?.result);
    };
    tx.onerror = tx.onabort = () => {
      db.close();
      reject(tx.error);
    };
  });
}

/** This member's drafts, newest first. Returns [] if the browser won't store them (e.g. private mode). */
export async function listDrafts(userId) {
  try {
    const all = await run('readonly', (s) => s.index('userId').getAll(String(userId)));
    return (all ?? []).sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

/** Saves (or overwrites) a draft and returns its id. */
export async function saveDraft({ id, userId, type, form, images = [] }) {
  const draft = { id: id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, userId: String(userId), savedAt: Date.now(), type, form, images };
  await run('readwrite', (s) => s.put(draft));
  return draft.id;
}

export async function deleteDraft(id) {
  try {
    await run('readwrite', (s) => s.delete(id));
  } catch {
    /* already gone */
  }
}
