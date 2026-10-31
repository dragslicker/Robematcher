// Claude som stylist och plaggigenkänning.
//
// Två vägar till Claude:
//  1. Öppnad via claude.ai (artefakt): sidan frågar Claude på tittarens eget
//     konto via `claude.use("sample")`. Ingen nyckel behövs.
//  2. Egen API-nyckel (t.ex. på GitHub Pages): anrop med Anthropics officiella
//     SDK direkt från webbläsaren. Nyckeln sparas bara i den här webbläsaren.

import { CATEGORIES, SUBTYPES, STYLES, PATTERNS } from './catalog.js';
import { imageForAI } from './image.js';

const KEY_STORAGE = 'robematcher:anthropic-key';
const SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.135.0/+esm';
const MODEL = 'claude-opus-5-5';

let backend = null; // { kind: 'claude' | 'api', json(prompt, {images, purpose}) }
const listeners = new Set();

export function onAIChange(fn) { listeners.add(fn); }
const notify = () => listeners.forEach((fn) => fn(backend));

export function aiKind() { return backend?.kind ?? null; }
export function aiAvailable() { return !!backend; }

export function getStoredKey() {
  try { return localStorage.getItem(KEY_STORAGE) || ''; } catch { return ''; }
}

export async function setApiKey(key) {
  try {
    if (key) localStorage.setItem(KEY_STORAGE, key);
    else localStorage.removeItem(KEY_STORAGE);
  } catch { /* privat läge */ }
  await initAI();
}

export async function initAI() {
  // claude.ai först – där behövs ingen nyckel.
  if (window.claude?.use) {
    try {
      const sample = await window.claude.use('sample');
      if (sample) {
        const limits = await sample.limits().catch(() => null);
        backend = claudeBackend(sample, limits);
        notify();
        return backend;
      }
    } catch { /* inte tillgängligt här */ }
  }
  const key = getStoredKey();
  backend = key ? apiBackend(key) : null;
  notify();
  return backend;
}

function claudeBackend(sample, limits) {
  const maxImages = Math.min(6, limits?.images?.maxCount ?? 0);
  return {
    kind: 'claude',
    maxImages,
    async json(prompt, { images = [], purpose = 'style', fresh = false } = {}) {
      try {
        return await sample.json(prompt, {
          images: images.length ? images : undefined,
          modelTier: purpose === 'tag' ? 'quick' : 'default',
          cache: fresh ? false : undefined,
        });
      } catch (e) {
        throw new AIError(e?.code, e?.message);
      }
    },
  };
}

let sdkPromise = null;
function apiBackend(apiKey) {
  return {
    kind: 'api',
    maxImages: 6,
    async json(prompt, { images = [], purpose = 'style' } = {}) {
      sdkPromise ??= import(SDK_URL);
      let Anthropic;
      try {
        Anthropic = (await sdkPromise).default;
      } catch {
        sdkPromise = null;
        throw new AIError('upstream_error', 'Kunde inte ladda Anthropic-SDK:n.');
      }
      const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
      const content = [];
      for (const img of images) {
        content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: await toBase64(img) } });
      }
      content.push({ type: 'text', text: `${prompt}\n\nSvara endast med JSON, ingen annan text.` });
      let res;
      try {
        res = await client.beta.messages.create({
          model: MODEL,
          max_tokens: purpose === 'tag' ? 4000 : 8000,
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          output_config: { effort: purpose === 'tag' ? 'low' : 'medium' },
          messages: [{ role: 'user', content }],
        });
      } catch (e) {
        if (e instanceof Anthropic.AuthenticationError) throw new AIError('bad_key', 'API-nyckeln godtogs inte.');
        if (e instanceof Anthropic.RateLimitError) throw new AIError('rate_limited', e.message);
        if (e instanceof Anthropic.APIError) throw new AIError('upstream_error', e.message);
        throw new AIError('upstream_error', String(e?.message ?? e));
      }
      if (res.stop_reason === 'refusal') throw new AIError('refused', 'Claude avböjde förfrågan.');
      const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
      return parseJson(text);
    },
  };
}

export class AIError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code || 'upstream_error';
  }
}

export function aiErrorText(e) {
  return {
    not_granted: 'Claude fick inte användas. Tillåt det i dialogen för att använda stylisten.',
    sampling_disabled: 'Claude är inte tillgängligt för ditt konto här.',
    rate_limited: 'För många förfrågningar just nu. Vänta en stund och försök igen.',
    bad_key: 'API-nyckeln godtogs inte. Kontrollera den under Stylist-inställningar.',
    refused: 'Claude avböjde. Prova att formulera tillfället annorlunda.',
    invalid_json: 'Svaret gick inte att läsa. Försök igen.',
    image_rejected: 'Bilden kunde inte skickas till Claude.',
    images_unavailable: 'Bilder kan inte skickas till Claude i den här vyn.',
  }[e?.code] ?? 'Claude svarade inte just nu. Försök igen om en stund.';
}

function parseJson(text) {
  try { return JSON.parse(text); } catch { /* fortsätt */ }
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) { try { return JSON.parse(fence[1]); } catch { /* fortsätt */ } }
  const start = text.search(/[[{]/);
  const end = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));
  if (start >= 0 && end > start) { try { return JSON.parse(text.slice(start, end + 1)); } catch { /* fortsätt */ } }
  throw new AIError('invalid_json', 'Ogiltigt JSON-svar');
}

function toBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

// ---------- Plaggigenkänning ----------

const HEX = /^#[0-9a-f]{6}$/i;
const clampInt = (v, lo, hi, fb) => (Number.isFinite(+v) ? Math.max(lo, Math.min(hi, Math.round(+v))) : fb);

export function tagPrompt(n) {
  const subtypes = Object.entries(SUBTYPES).map(([c, list]) => `${c}: ${list.map(([s]) => s).join(', ')}`).join('\n');
  return `Du är en erfaren stylist som katalogiserar en garderob. Här är ${n} foton av klädesplagg, frilagda mot neutral bakgrund, i ordning (bild 1 = index 0).

För varje bild, bestäm:
- category: en av ${Object.keys(CATEGORIES).join(', ')}
- subtype: exakt ett namn ur listan för den kategorin:
${subtypes}
- name: kort svenskt namn som en modebutik skulle skriva, med färg först, t.ex. "Marinblå stickad tröja", "Ljusa raka jeans", "Bruna mockaloafers"
- color: huvudfärgen på tyget som hex (#rrggbb), korrigera för skuggor och färgstick från ljuset
- color2: tydlig andrafärg (rand, mönster, detalj) som hex, annars null
- pattern: solid, subtle (melerat, tunn rand, diskret) eller bold (rutor, blommor, print, breda ränder)
- styles: 1–4 av ${Object.keys(STYLES).join(', ')}
- warmth: 0–5 (0 = accessoar utan värme, 1 = linne/sandal, 3 = jeans/stickat, 5 = dunjacka/vinterkänga)
- formality: 1–5 (1 = mjukis/träning, 3 = snygg vardag, 5 = kostym/frack)
- waterproof: true om plagget tål regn (regnjacka, gummistövlar, vaxad jacka), annars false
- isGarment: false om bilden inte visar ett klädesplagg eller en accessoar

Svara med JSON: {"items":[{"index":0,"isGarment":true,"category":"top","subtype":"Stickad tröja","name":"Marinblå stickad tröja","color":"#1f2a44","color2":null,"pattern":"solid","styles":["smart","classic"],"warmth":3,"formality":3,"waterproof":false}]}`;
}

export function normalizeTag(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const category = CATEGORIES[raw.category] ? raw.category : null;
  if (!category) return null;
  const subtype = SUBTYPES[category].find(([s]) => s.toLowerCase() === String(raw.subtype ?? '').toLowerCase())?.[0]
    ?? SUBTYPES[category][0][0];
  return {
    isGarment: raw.isGarment !== false,
    category,
    subtype,
    name: String(raw.name ?? '').trim().slice(0, 60),
    color: HEX.test(raw.color) ? raw.color.toLowerCase() : null,
    color2: HEX.test(raw.color2) ? raw.color2.toLowerCase() : null,
    pattern: PATTERNS[raw.pattern] ? raw.pattern : 'solid',
    styles: Array.isArray(raw.styles) ? raw.styles.filter((s) => STYLES[s]).slice(0, 4) : [],
    warmth: clampInt(raw.warmth, 0, 5, 2),
    formality: clampInt(raw.formality, 1, 5, 3),
    waterproof: raw.waterproof === true,
  };
}

// Analyserar en lista bild-blobs. Returnerar normaliserade taggar i samma ordning (null = okänd).
export async function tagGarments(blobs) {
  if (!backend) throw new AIError('unavailable');
  const images = await Promise.all(blobs.map((b) => imageForAI(b)));
  const res = await backend.json(tagPrompt(images.length), { images, purpose: 'tag' });
  const items = Array.isArray(res) ? res : res?.items;
  const out = blobs.map(() => null);
  if (Array.isArray(items)) {
    items.forEach((it, i) => {
      const idx = Number.isInteger(it?.index) ? it.index : i;
      if (idx >= 0 && idx < out.length) out[idx] = normalizeTag(it);
    });
  }
  return out;
}

export function maxImagesPerCall() {
  return Math.max(1, backend?.maxImages ?? 1);
}

// ---------- Stylisten ----------

const LEVEL_TXT = { 1: 'varmt', 2: 'skönt', 3: 'svalt, jacka behövs', 4: 'kyligt, varm jacka', 5: 'kallt, vinterkläder' };

export function stylistPrompt({ wardrobe, conditions, style, occasion, candidates, count = 3 }) {
  const day = 864e5;
  const lines = wardrobe.map((i) => [
    i.id, i.name, i.category, i.subtype, i.color + (i.color2 ? `+${i.color2}` : ''), i.pattern,
    `värme ${i.warmth}`, `formalitet ${i.formality}`, i.waterproof ? 'vattentät' : '',
    (i.styles ?? []).join('/'), i.lastWorn ? `buren för ${Math.round((Date.now() - i.lastWorn) / day)} d sedan` : '',
  ].filter(Boolean).join(' | '));
  const weather = conditions
    ? `${conditions.temp}°C (känns som ${conditions.feelsLike}°), ${LEVEL_TXT[conditions.level]}${conditions.rain ? ', regn' : ''}${conditions.snow ? ', snö' : ''}${conditions.wind >= 8 ? `, blåsigt ${conditions.wind} m/s` : ''}${conditions.sunny ? ', sol' : ''}`
    : 'okänt';
  const cand = (candidates ?? []).slice(0, 10).map((o, k) => `${k + 1}. ${o.items.map((i) => i.id).join(', ')} (regelpoäng ${Math.round(o.total * 100)})`).join('\n');
  return `Du är en erfaren personlig stylist med öga för färgteori, proportioner och väder. Sätt ihop ${count} outfits ur personens egen garderob.

Tillfälle: ${occasion?.trim() || 'vardag, inget särskilt'}
Önskad stil: ${style ? STYLES[style]?.label : 'valfri'}
Väder: ${weather}

Garderob (id | namn | kategori | typ | färg | mönster | värme | formalitet | ... ):
${lines.join('\n')}

En regelmotor har föreslagit dessa kombinationer (använd, förbättra eller ignorera):
${cand || '–'}

Regler:
- Varje outfit har antingen en överdel (top) och en underdel (bottom), eller en klänning (dress). Lägg till skor om det finns. Ytterplagg när det är svalt eller kallare, eller regnar. Högst två accessoarer.
- Använd bara id:n ur listan, och varje plagg högst en gång per outfit.
- Matcha tillfället och vädret. Tänk på färgharmoni (neutral bas, ton-i-ton, analoga eller dämpade komplementfärger), kontrast, ett tydligt mönster åt gången och jämn formalitet.
- Undvik plagg som burits de senaste dagarna om det går. Låt outfitsen skilja sig från varandra.

Svara med JSON: {"looks":[{"title":"kort rubrik, 2–4 ord","itemIds":["id1","id2"],"why":"1–2 meningar om varför det fungerar (färg, stil, väder, tillfälle)","tip":"ett konkret stylingtips, t.ex. hur något bärs"}]}`;
}

export function validateLooks(raw, wardrobe) {
  const byId = new Map(wardrobe.map((i) => [i.id, i]));
  const looks = Array.isArray(raw) ? raw : raw?.looks;
  if (!Array.isArray(looks)) return [];
  const out = [];
  for (const l of looks) {
    const ids = [...new Set((l?.itemIds ?? []).map(String))].filter((id) => byId.has(id));
    const items = ids.map((id) => byId.get(id));
    // Högst ett plagg per huvudkategori, högst två accessoarer.
    const seen = {};
    const clean = items.filter((i) => {
      seen[i.category] = (seen[i.category] ?? 0) + 1;
      return i.category === 'accessory' ? seen[i.category] <= 2 : seen[i.category] === 1;
    });
    const hasBase = clean.some((i) => i.category === 'dress') || (clean.some((i) => i.category === 'top') && clean.some((i) => i.category === 'bottom'));
    if (!hasBase) continue;
    const final = clean.some((i) => i.category === 'dress') ? clean.filter((i) => i.category !== 'top' && i.category !== 'bottom') : clean;
    out.push({
      items: final,
      title: String(l.title ?? '').slice(0, 60),
      why: String(l.why ?? '').slice(0, 400),
      tip: String(l.tip ?? '').slice(0, 300),
    });
  }
  return out;
}

export async function askStylist(opts, { fresh = true } = {}) {
  if (!backend) throw new AIError('unavailable');
  const raw = await backend.json(stylistPrompt(opts), { purpose: 'style', fresh });
  return validateLooks(raw, opts.wardrobe);
}
