// Lagring i webbläsarens IndexedDB. Allt stannar på din enhet.
// Garderobsdata sparas som ett dokument, foton som separata bilder (Blob).

const DB_NAME = 'robematcher';
const LEGACY_KEY = 'robematcher:v1';

const DEFAULT_STATE = {
  wardrobe: [],
  favorites: [],
  history: [],
  settings: { location: null, style: '', day: 0, lastCategory: 'top' },
};

let dbp = null;
const photoUrls = new Map();

function db() {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore('kv');
        req.result.createObjectStore('photos');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbp;
}

async function tx(store, mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(store, mode);
    const r = fn(t.objectStore(store));
    t.oncomplete = () => resolve(r?.result);
    t.onerror = () => reject(t.error);
  });
}

const withDefaults = (data) => ({
  ...structuredClone(DEFAULT_STATE),
  ...data,
  settings: { ...DEFAULT_STATE.settings, ...data?.settings },
});

export async function init() {
  let state = await tx('kv', 'readonly', (s) => s.get('state'));
  if (!state) {
    state = withDefaults(await migrateLegacy());
    await save(state);
  }
  state = withDefaults(state);
  // Förladda fotons URL:er så att rendering kan ske synkront.
  const keys = await tx('photos', 'readonly', (s) => s.getAllKeys());
  const blobs = await tx('photos', 'readonly', (s) => s.getAll());
  keys.forEach((k, i) => photoUrls.set(k, URL.createObjectURL(blobs[i])));
  return state;
}

async function migrateLegacy() {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw);
    for (const item of data.wardrobe ?? []) {
      if (typeof item.photo === 'string' && item.photo.startsWith('data:')) {
        await putPhoto(item.id, await (await fetch(item.photo)).blob());
        item.hasPhoto = true;
      }
      delete item.photo;
    }
    localStorage.removeItem(LEGACY_KEY);
    return data;
  } catch (e) {
    console.warn('Kunde inte migrera gammal data', e);
    return {};
  }
}

let saveTimer = null;
export function save(state) {
  clearTimeout(saveTimer);
  return new Promise((resolve) => {
    saveTimer = setTimeout(async () => {
      try {
        await tx('kv', 'readwrite', (s) => s.put(JSON.parse(JSON.stringify(state)), 'state'));
        resolve(true);
      } catch (e) {
        console.error(e);
        resolve(false);
      }
    }, 120);
  });
}

export function photoUrl(id) {
  return photoUrls.get(id) ?? null;
}

export async function putPhoto(id, blob) {
  await tx('photos', 'readwrite', (s) => s.put(blob, id));
  if (photoUrls.has(id)) URL.revokeObjectURL(photoUrls.get(id));
  photoUrls.set(id, URL.createObjectURL(blob));
}

export async function deletePhoto(id) {
  await tx('photos', 'readwrite', (s) => s.delete(id));
  if (photoUrls.has(id)) URL.revokeObjectURL(photoUrls.get(id));
  photoUrls.delete(id);
}

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

const blobToDataUrl = (blob) => new Promise((resolve) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.readAsDataURL(blob);
});

export async function exportJson(state) {
  const photos = {};
  const keys = await tx('photos', 'readonly', (s) => s.getAllKeys());
  const blobs = await tx('photos', 'readonly', (s) => s.getAll());
  for (let i = 0; i < keys.length; i++) photos[keys[i]] = await blobToDataUrl(blobs[i]);
  const blob = new Blob([JSON.stringify({ ...state, photos })], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `robematcher-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export async function importJson(file) {
  const data = JSON.parse(await file.text());
  if (!Array.isArray(data.wardrobe)) throw new Error('Filen ser inte ut som en Robematcher-backup.');
  const { photos = {}, ...rest } = data;
  for (const [id, url] of Object.entries(photos)) await putPhoto(id, await (await fetch(url)).blob());
  const state = withDefaults(rest);
  await save(state);
  return state;
}
