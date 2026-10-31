// Enkel lagring i webbläsaren (localStorage). Allt stannar på din enhet.

const KEY = 'robematcher:v1';

const DEFAULT_STATE = {
  wardrobe: [],
  favorites: [],
  history: [],
  settings: { location: null, style: '', day: 0 },
};

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const data = JSON.parse(raw);
    return { ...structuredClone(DEFAULT_STATE), ...data, settings: { ...DEFAULT_STATE.settings, ...data.settings } };
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    console.error(e);
    alert('Lagringen är full. Exportera en backup och ta bort några bilder eller plagg.');
    return false;
  }
}

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function exportJson(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `robematcher-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export async function importJson(file) {
  const text = await file.text();
  const data = JSON.parse(text);
  if (!Array.isArray(data.wardrobe)) throw new Error('Filen ser inte ut som en Robematcher-backup.');
  return { ...structuredClone(DEFAULT_STATE), ...data };
}
