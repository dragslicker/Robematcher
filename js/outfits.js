// Outfitmotorn: bygger kombinationer och poängsätter dem på färg, stil, väder och mönster.

import { paletteHarmony, colorFamily, colorName, hexToHsl, hueDistance, lightnessContrast } from './color.js';
import { STYLES, COLD_ACCESSORIES, SUN_ACCESSORIES } from './catalog.js';

// Ideal värmeintervall per kategori och värmenivå (1 = hett … 5 = kallt).
const WARMTH_RANGES = {
  top: { 1: [1, 1], 2: [1, 2], 3: [2, 3], 4: [2, 4], 5: [3, 4] },
  bottom: { 1: [1, 2], 2: [1, 3], 3: [2, 3], 4: [3, 4], 5: [3, 4] },
  dress: { 1: [1, 2], 2: [1, 2], 3: [2, 3], 4: [2, 3], 5: [3, 3] },
  shoes: { 1: [1, 2], 2: [1, 2], 3: [2, 3], 4: [2, 4], 5: [3, 5] },
  outerwear: { 1: [0, 0], 2: [1, 2], 3: [2, 3], 4: [3, 4], 5: [4, 5] },
};

const COLOR_WEIGHTS = { top: 0.35, bottom: 0.3, dress: 0.65, outerwear: 0.35, shoes: 0.12, accessory: 0.06 };

export function weatherFit(item, cond) {
  if (!cond) return 1;
  const L = cond.level;
  if (item.category === 'accessory') {
    if (COLD_ACCESSORIES.has(item.subtype)) {
      if (item.subtype === 'Mössa') return L >= 4 ? 1 : L === 3 ? 0.5 : 0.1;
      return L >= 3 ? 1 : L === 2 ? 0.4 : 0.1;
    }
    if (item.subtype === 'Solglasögon') return cond.sunny ? 1 : 0.4;
    return 0.8;
  }
  const range = WARMTH_RANGES[item.category]?.[L];
  if (!range) return 1;
  const w = item.warmth ?? 2;
  const dist = w < range[0] ? range[0] - w : w > range[1] ? w - range[1] : 0;
  let fit = 1 - 0.4 * dist;

  if (cond.rain || cond.snow) {
    if (item.category === 'shoes') {
      if (item.waterproof) fit += 0.15;
      else if (w <= 1) fit *= 0.25; // sandaler i regn
      else fit -= 0.12;
    }
    if (item.category === 'outerwear') fit += item.waterproof ? 0.2 : -0.1;
  }
  if (cond.snow && item.category === 'shoes' && w < 3) fit -= 0.3;
  return Math.max(0, Math.min(1, fit));
}

export function styleFit(item, style) {
  if (!style) return 1;
  if (item.category === 'accessory' && !item.styles?.length) return 0.8;
  if (item.styles?.includes(style)) return 1;
  const [lo, hi] = STYLES[style]?.formality ?? [1, 5];
  const f = item.formality ?? 3;
  const d = f < lo ? lo - f : f > hi ? f - hi : 0;
  return d === 0 ? 0.62 : Math.max(0, 0.6 - 0.3 * d);
}

function needsOuterwear(cond) {
  if (!cond) return 'optional';
  if (cond.level >= 3) return 'required';
  if (cond.level === 2 || cond.rain) return 'optional';
  return 'none';
}

function colorsOf(items) {
  const hasOuter = items.some((i) => i.category === 'outerwear');
  const out = [];
  for (const i of items) {
    let w = COLOR_WEIGHTS[i.category] ?? 0.1;
    if (hasOuter && (i.category === 'top' || i.category === 'dress')) w *= 0.6;
    out.push({ hex: i.color, weight: w, role: i.category });
    if (i.color2) out.push({ hex: i.color2, weight: w * 0.35, role: i.category });
  }
  return out;
}

function sameColor(a, b) {
  const fa = colorFamily(a);
  const fb = colorFamily(b);
  const ha = hexToHsl(a);
  const hb = hexToHsl(b);
  if (fa === 'neutral' && fb === 'neutral') return Math.abs(ha.l - hb.l) < 0.12;
  return hueDistance(ha.h, hb.h) <= 15 && Math.abs(ha.l - hb.l) < 0.2;
}

// Poängsätter en (del)outfit. Returnerar total 0–1 samt delresultat och förklaringar.
export function scoreOutfit(items, { conditions, style } = {}) {
  const notes = [];
  const warnings = [];
  const main = items.filter((i) => i.category !== 'accessory');

  // --- Färg ---
  const harmony = paletteHarmony(colorsOf(items));
  let color = harmony.score;
  notes.push(...harmony.notes);

  const top = items.find((i) => i.category === 'top');
  const bottom = items.find((i) => i.category === 'bottom');
  if (top && bottom) {
    const dl = lightnessContrast(top.color, bottom.color);
    const bothDark = hexToHsl(top.color).l < 0.2 && hexToHsl(bottom.color).l < 0.2;
    if (dl >= 0.3) {
      color += 0.06;
      if (dl >= 0.45) notes.push('Tydlig ljuskontrast mellan över- och underdel ger en skarp silhuett.');
    } else if (dl >= 0.18) {
      color += 0.03;
    } else if (dl < 0.07 && !bothDark && !sameColor(top.color, bottom.color)) {
      color -= 0.08;
      warnings.push('Över- och underdel är nästan lika ljusa men inte samma färg – kan se ut som en miss.');
    } else if (bothDark && colorFamily(top.color) === 'neutral' && colorFamily(bottom.color) === 'neutral') {
      notes.push('All black – enkelt och stilsäkert.');
    }
  }

  const shoes = items.find((i) => i.category === 'shoes');
  const belt = items.find((i) => i.category === 'accessory' && i.subtype === 'Skärp');
  if (shoes && belt && sameColor(shoes.color, belt.color)) {
    color += 0.04;
    notes.push('Skärpet matchar skorna – en klassisk detalj.');
  }

  // --- Mönster ---
  let pattern = 0;
  const bold = items.filter((i) => i.pattern === 'bold');
  const subtle = items.filter((i) => i.pattern === 'subtle');
  if (bold.length >= 2) {
    pattern -= 0.3;
    warnings.push('Två tydliga mönster samtidigt – låt ett av dem vila.');
  } else if (bold.length === 1) {
    if (subtle.length >= 1) pattern -= 0.06;
    const p = bold[0];
    const picks = [p.color, p.color2].filter(Boolean);
    const echoed = items.some((o) => o !== p && picks.some((c) => sameColor(c, o.color) && colorFamily(o.color) === 'chromatic'))
      || (p.color2 && items.some((o) => o !== p && sameColor(p.color2, o.color)));
    if (echoed) {
      pattern += 0.06;
      notes.push(`Mönstret på ${lc(p.name)} plockas upp av ett annat plagg.`);
    }
  }

  // --- Stil & formalitet ---
  const sFits = items.map((i) => styleFit(i, style));
  // Utan vald stil: utgå från 0.85 och belöna en gemensam stilriktning.
  let styleScore = style ? sFits.reduce((a, b) => a + b, 0) / sFits.length : 0.85;
  const forms = main.map((i) => i.formality ?? 3);
  const spread = forms.length ? Math.max(...forms) - Math.min(...forms) : 0;
  if (spread >= 3) {
    styleScore -= 0.25;
    warnings.push('Stor skillnad i formalitet mellan plaggen.');
  } else if (spread === 2) {
    styleScore -= 0.07;
  }
  if (!style && main.length >= 2) {
    const common = main.reduce((acc, i) => acc.filter((s) => i.styles?.includes(s)), main[0].styles ?? []);
    if (common.length) {
      styleScore += 0.1;
      notes.push(`Enhetlig stil: ${STYLES[common[0]]?.label.toLowerCase() ?? common[0]}.`);
    }
  }

  // --- Väder ---
  let weather = 1;
  if (conditions) {
    // Ytterplagg och skor avgör mest om man fryser/blir blöt – de väger tyngre.
    const W = { outerwear: 2.5, shoes: 1.5, accessory: 0.4 };
    let sum = 0;
    let wsum = 0;
    for (const i of items) {
      const w = W[i.category] ?? 1;
      sum += weatherFit(i, conditions) * w;
      wsum += w;
    }
    const worst = Math.min(...items.filter((i) => i.category !== 'accessory').map((i) => weatherFit(i, conditions)));
    weather = 0.5 * (sum / wsum) + 0.5 * worst;
    const outer = items.find((i) => i.category === 'outerwear');
    if (outer && conditions.level >= 4 && weatherFit(outer, conditions) < 0.95) {
      warnings.push(`${outer.name} kan bli för tunn idag – klä dig i lager.`);
    }
    if (conditions.rain && outer?.waterproof) notes.push(`${outer.name} håller dig torr i regnet.`);
    if ((conditions.rain || conditions.snow) && shoes?.waterproof) notes.push('Vattentäta skor – bra val idag.');
    if (conditions.rain && shoes && !shoes.waterproof && (shoes.warmth ?? 2) <= 1) warnings.push('Öppna skor i regn – ta med ett par extra.');
    if (needsOuterwear(conditions) === 'required' && !outer) {
      weather -= 0.3;
      warnings.push('Det är för kallt utan ytterplagg.');
    }
    if (conditions.level === 1 && outer) weather -= 0.25;
  }

  // --- Variation ---
  let variety = 0;
  const now = Date.now();
  for (const i of main) {
    if (i.lastWorn && now - i.lastWorn < 2 * 864e5) variety -= 0.04;
  }

  const total = 0.38 * clamp(color) + 0.32 * clamp(weather) + 0.3 * clamp(styleScore) + pattern + variety;
  return {
    total: clamp(total),
    parts: { color: clamp(color), weather: clamp(weather), style: clamp(styleScore) },
    harmony: harmony.label,
    harmonyType: harmony.type,
    notes: dedupe(notes),
    warnings: dedupe(warnings),
  };
}

// Huvudfunktion: genererar de bästa, sinsemellan olika outfitsen.
export function generateOutfits(wardrobe, opts = {}) {
  const { conditions = null, style = null, count = 6, locked = [], rng = Math.random, jitter = 0.035 } = opts;
  const ctx = { conditions, style };
  const lockedSet = new Set(locked);
  const by = (cat) => wardrobe.filter((i) => i.category === cat);

  // Förfilter: släng plagg som absolut inte funkar i vädret/stilen, men behåll alltid något.
  const viable = (cat) => {
    const all = by(cat);
    const locks = all.filter((i) => lockedSet.has(i.id));
    if (locks.length) return locks;
    const minFit = cat === 'outerwear' ? 0.7 : 0.3;
    const ok = all.filter((i) => weatherFit(i, conditions) >= minFit && styleFit(i, style) >= 0.2);
    return ok.length ? ok : all;
  };

  const tops = viable('top');
  const bottoms = viable('bottom');
  const dresses = viable('dress');
  const shoesList = viable('shoes');
  const outerList = viable('outerwear');
  const accList = by('accessory').filter((i) => weatherFit(i, conditions) >= 0.5 && styleFit(i, style) >= 0.4);

  const lockedCats = new Set(wardrobe.filter((i) => lockedSet.has(i.id)).map((i) => i.category));
  const noise = () => (rng() - 0.5) * 2 * jitter;
  const rank = (cands) => cands
    .map((items) => ({ items, s: scoreOutfit(items, ctx).total + noise() }))
    .sort((a, b) => b.s - a.s);

  // 1. Baser: överdel + underdel eller klänning.
  let bases = [];
  const wantDress = !lockedCats.has('top') && !lockedCats.has('bottom');
  const wantSeparates = !lockedCats.has('dress');
  if (wantSeparates) for (const t of tops) for (const b of bottoms) bases.push([t, b]);
  if (wantDress) for (const d of dresses) bases.push([d]);
  if (!bases.length) return [];
  bases = rank(bases).slice(0, 50).map((x) => x.items);

  // 2. Skor.
  let withShoes = [];
  for (const base of bases) {
    if (!shoesList.length) withShoes.push(base);
    else for (const s of shoesList) withShoes.push([...base, s]);
  }
  withShoes = rank(withShoes).slice(0, 90).map((x) => x.items);

  // 3. Ytterplagg.
  const need = needsOuterwear(conditions);
  let withOuter = [];
  for (const o of withShoes) {
    const outerLocked = lockedCats.has('outerwear');
    const allowWithout = !outerLocked && (need !== 'required' || !outerList.length);
    const allowWith = outerLocked || need !== 'none';
    if (allowWithout) withOuter.push(o);
    if (allowWith) for (const j of outerList) withOuter.push([...o, j]);
  }
  if (!withOuter.length) withOuter = withShoes;
  withOuter = rank(withOuter).slice(0, 70);

  // 4. Accessoarer (max två, bara om de förbättrar helheten).
  const finals = withOuter.map(({ items }) => {
    let cur = items;
    let curScore = scoreOutfit(cur, ctx).total;
    const lockedAcc = accList.filter((a) => lockedSet.has(a.id));
    if (lockedAcc.length) {
      cur = [...cur, ...lockedAcc];
      curScore = scoreOutfit(cur, ctx).total;
    }
    for (let k = cur.filter((i) => i.category === 'accessory').length; k < 2; k++) {
      let best = null;
      for (const a of accList) {
        if (cur.includes(a) || cur.some((c) => c.subtype === a.subtype)) continue;
        const bonus = weatherBonusAccessory(a, conditions);
        const s = scoreOutfit([...cur, a], ctx).total + bonus;
        if (s >= curScore + 0.004 && (!best || s > best.s)) best = { a, s };
      }
      if (!best) break;
      cur = [...cur, best.a];
      curScore = best.s;
    }
    return cur;
  });

  // Säkerställ att låsta plagg finns med.
  const valid = finals.filter((items) => [...lockedSet].every((id) => items.some((i) => i.id === id) || !wardrobe.some((w) => w.id === id)));

  const scored = valid
    .map((items) => ({ items: sortItems(items), ...scoreOutfit(items, ctx) }))
    .map((o) => ({ ...o, sortKey: o.total + noise() }))
    .sort((a, b) => b.sortKey - a.sortKey);

  // Mångfald: varje ny outfit ska skilja sig med minst två plagg från de redan valda.
  const picked = [];
  for (const o of scored) {
    const ids = new Set(o.items.filter((i) => i.category !== 'accessory').map((i) => i.id));
    const tooSimilar = picked.some((p) => {
      const pids = p.items.filter((i) => i.category !== 'accessory').map((i) => i.id);
      const shared = pids.filter((id) => ids.has(id)).length;
      return Math.max(pids.length, ids.size) - shared < 2;
    });
    if (!tooSimilar) picked.push(o);
    if (picked.length >= count) break;
  }
  return picked.map(({ sortKey, ...o }) => ({ ...o, id: o.items.map((i) => i.id).join('+') }));
}

function weatherBonusAccessory(a, cond) {
  if (!cond) return 0;
  if (COLD_ACCESSORIES.has(a.subtype) && cond.level >= 4) return 0.02;
  if (SUN_ACCESSORIES.has(a.subtype) && cond.sunny && cond.level <= 2) return 0.015;
  return 0;
}

const ORDER = ['outerwear', 'top', 'dress', 'bottom', 'shoes', 'accessory'];
function sortItems(items) {
  return [...items].sort((a, b) => ORDER.indexOf(a.category) - ORDER.indexOf(b.category));
}

export function describePalette(items) {
  return items.map((i) => colorName(i.color)).filter((v, idx, arr) => arr.indexOf(v) === idx);
}

function clamp(x) {
  return Math.max(0, Math.min(1, x));
}

function dedupe(arr) {
  return [...new Set(arr)];
}

function lc(s) {
  return String(s).toLowerCase();
}
