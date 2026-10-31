// Färglära: konvertering, namngivning, neutralklassning och harmonibedömning.
// Rena funktioner utan DOM-beroenden så att de kan testas i Node.

export function hexToRgb(hex) {
  let h = String(hex).trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }) {
  const to = (v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

export function rgbToHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return { h, s, l };
}

export function hexToHsl(hex) {
  return rgbToHsl(hexToRgb(hex));
}

export function hueDistance(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

// Namngivna modefärger (svenska namn). Används för att beskriva plagg och outfits.
export const NAMED_COLORS = [
  ['Svart', '#111111'], ['Kolgrå', '#36454f'], ['Grå', '#8a8a8a'], ['Ljusgrå', '#cfcfcf'],
  ['Vit', '#fafafa'], ['Offwhite', '#f3efe4'], ['Krämvit', '#fffdd0'], ['Beige', '#d9c5a0'],
  ['Sand', '#c2b280'], ['Kamel', '#c19a6b'], ['Cognac', '#9a4e1c'], ['Brun', '#6b4226'],
  ['Choklad', '#3f2a1d'], ['Khaki', '#a39264'], ['Oliv', '#6b6b2a'], ['Militärgrön', '#4b5320'],
  ['Skogsgrön', '#228b22'], ['Flaskgrön', '#0b4d34'], ['Salvia', '#9caf88'], ['Mint', '#98d8b4'],
  ['Smaragd', '#009b77'], ['Petrol', '#005f6a'], ['Turkos', '#30c5c0'], ['Himmelsblå', '#87ceeb'],
  ['Ljusblå', '#add8e6'], ['Denim', '#4f6d8f'], ['Mörk denim', '#2b3f5c'], ['Koboltblå', '#0047ab'],
  ['Kungsblå', '#4169e1'], ['Marinblå', '#1f2a44'], ['Lavendel', '#b6a6d9'], ['Lila', '#7b3fa0'],
  ['Plommon', '#5e2750'], ['Aubergine', '#3b1f2b'], ['Vinröd', '#6d1a2a'], ['Bordeaux', '#5c0f1f'],
  ['Röd', '#c8102e'], ['Tegel', '#b5533c'], ['Rost', '#a0461f'], ['Korall', '#ff7f50'],
  ['Orange', '#f28c28'], ['Senap', '#d4a017'], ['Gul', '#f5d327'], ['Citron', '#fff44f'],
  ['Persika', '#ffcba4'], ['Puderrosa', '#e8c4c4'], ['Rosa', '#f4a7b9'], ['Cerise', '#de3163'],
  ['Fuchsia', '#c71585'], ['Terrakotta', '#c8664a'], ['Taupe', '#8b7d6b'], ['Silver', '#c0c0c0'],
  ['Guld', '#c9a54a'],
];

function labDistanceApprox(a, b) {
  // Viktat RGB-avstånd ("redmean") – tillräckligt bra för namngivning.
  const rm = (a.r + b.r) / 2;
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
}

export function colorName(hex) {
  const rgb = hexToRgb(hex);
  let best = NAMED_COLORS[0][0];
  let bestD = Infinity;
  for (const [name, h] of NAMED_COLORS) {
    const d = labDistanceApprox(rgb, hexToRgb(h));
    if (d < bestD) { bestD = d; best = name; }
  }
  return best;
}

// Klassar en färg: 'neutral' (svart/vit/grå), 'earth' (beige/kamel/brun/khaki),
// 'navy' (marinblå), 'denim' eller 'chromatic' (en riktig kulör).
export function colorFamily(hex) {
  const { h, s, l } = hexToHsl(hex);
  if (l < 0.13 || l > 0.93 || s < 0.12) return 'neutral';
  if (s < 0.16 || (s < 0.25 && l < 0.32)) return 'neutral'; // grå med lätt ton, t.ex. kolgrå
  if (l > 0.86 && h >= 30 && h <= 70) return 'neutral'; // offwhite, kräm, ecru
  if (h >= 18 && h <= 55 && s < 0.55 && l > 0.2 && l < 0.85) return 'earth';
  if (h >= 20 && h <= 40 && l <= 0.42 && s < 0.8) return 'earth'; // mörkbrun/choklad/cognac
  if (h >= 50 && h <= 75 && s < 0.5 && l < 0.6) return 'earth'; // khaki/oliv/militärgrön
  if (h >= 205 && h <= 250 && l < 0.3) return 'navy';
  if (h >= 195 && h <= 230 && s < 0.45 && l >= 0.25 && l <= 0.65) return 'denim';
  return 'chromatic';
}

export function isNeutral(hex) {
  return colorFamily(hex) !== 'chromatic';
}

export function isVivid(hex) {
  const { s, l } = hexToHsl(hex);
  return s > 0.65 && l > 0.3 && l < 0.7;
}

export function isWarmHue(h) {
  return h < 75 || h > 330;
}

// Klassificerar relationen mellan två kulörta färger.
export function pairHarmony(hexA, hexB) {
  const a = hexToHsl(hexA);
  const b = hexToHsl(hexB);
  const d = hueDistance(a.h, b.h);
  const bothVivid = isVivid(hexA) && isVivid(hexB);
  if (d <= 18) {
    const dl = Math.abs(a.l - b.l);
    return { type: 'monochrome', score: dl >= 0.12 ? 0.94 : 0.8, d };
  }
  if (d <= 45) return { type: 'analogous', score: 0.9, d };
  if (d >= 155) return { type: 'complementary', score: bothVivid ? 0.72 : 0.88, d };
  if (d >= 135) return { type: 'split', score: bothVivid ? 0.68 : 0.82, d };
  if (d >= 105) return { type: 'triadic', score: bothVivid ? 0.6 : 0.74, d };
  // 45–105°: varken analogt eller kontrast – ofta "nästan men inte riktigt".
  const muted = !isVivid(hexA) || !isVivid(hexB);
  return { type: 'clash', score: muted ? 0.5 : 0.28, d };
}

export const HARMONY_LABELS = {
  neutral: 'Neutral bas',
  accent: 'Neutral bas + accentfärg',
  monochrome: 'Ton-i-ton',
  analogous: 'Analoga färger',
  complementary: 'Komplementfärger',
  split: 'Delad komplementharmoni',
  triadic: 'Triad',
  clash: 'Krockande nyanser',
  busy: 'För många kulörer',
};

// Bedömer en hel palett. `colors` är en lista med { hex, weight, role } där
// weight anger hur stor yta färgen tar (huvudplagg > accessoar).
export function paletteHarmony(colors) {
  const entries = colors.filter((c) => c && c.hex);
  const chromatic = [];
  for (const c of entries) {
    if (colorFamily(c.hex) !== 'chromatic') continue;
    // Slå ihop nästan identiska kulörer till en.
    const hsl = hexToHsl(c.hex);
    const same = chromatic.find((x) => hueDistance(x.hsl.h, hsl.h) <= 12);
    if (same) same.weight += c.weight ?? 1;
    else chromatic.push({ ...c, hsl, weight: c.weight ?? 1 });
  }

  const notes = [];
  let score;
  let type;

  if (chromatic.length === 0) {
    type = 'neutral';
    score = 0.76;
    const families = new Set(entries.map((c) => colorFamily(c.hex)));
    if (families.has('earth') && families.has('navy')) {
      score += 0.08;
      notes.push('Marinblått och jordtoner är en tidlös kombination.');
    } else if (families.has('earth') || families.has('denim')) {
      notes.push('Neutral palett – lätt att bära och alltid stilren.');
    } else {
      notes.push('Klassisk neutral palett i svart, vitt och grått.');
    }
  } else if (chromatic.length === 1) {
    type = 'accent';
    score = 0.86;
    notes.push(`${colorName(chromatic[0].hex)} får stå ut mot en neutral bas.`);
  } else if (chromatic.length === 2) {
    const ph = pairHarmony(chromatic[0].hex, chromatic[1].hex);
    type = ph.type;
    score = ph.score;
    const [n1, n2] = chromatic.map((c) => colorName(c.hex).toLowerCase());
    if (ph.type === 'complementary' || ph.type === 'split') {
      notes.push(`${cap(n1)} och ${n2} ligger mitt emot varandra på färghjulet och ger energi.`);
    } else if (ph.type === 'analogous') {
      notes.push(`${cap(n1)} och ${n2} är grannar på färghjulet – harmoniskt och mjukt.`);
    } else if (ph.type === 'monochrome') {
      notes.push(`Ton-i-ton i ${n1} – sofistikerat när ljushetsgraden varierar.`);
    } else if (ph.type === 'triadic') {
      notes.push(`${cap(n1)} och ${n2} bildar en triad – modigt, funkar bäst med neutral bas.`);
    } else {
      notes.push(`${cap(n1)} och ${n2} kan kännas oroliga ihop.`);
    }
    // 60-30-10: en färg bör dominera.
    const [w1, w2] = chromatic.map((c) => c.weight);
    if (Math.abs(w1 - w2) < 0.2 && ph.type !== 'monochrome' && ph.type !== 'analogous') score -= 0.04;
  } else if (chromatic.length === 3) {
    const pairs = [
      pairHarmony(chromatic[0].hex, chromatic[1].hex),
      pairHarmony(chromatic[0].hex, chromatic[2].hex),
      pairHarmony(chromatic[1].hex, chromatic[2].hex),
    ];
    const maxD = Math.max(...pairs.map((p) => p.d));
    const triad = pairs.every((p) => p.d >= 100 && p.d <= 140);
    if (maxD <= 70) {
      type = 'analogous';
      score = 0.85;
      notes.push('Tre närliggande nyanser ger en rik men lugn palett.');
    } else if (triad) {
      type = 'triadic';
      score = 0.66;
      notes.push('Triadisk palett – djärvt och lekfullt.');
    } else if (pairs.some((p) => p.type === 'clash' && p.score < 0.4)) {
      type = 'clash';
      score = 0.3;
      notes.push('Tre kulörer som drar åt olika håll.');
    } else {
      type = 'split';
      score = pairs.reduce((a, p) => a + p.score, 0) / 3 - 0.1;
      notes.push('Tre kulörer – välj gärna en som huvudfärg.');
    }
  } else {
    type = 'busy';
    score = 0.2;
    notes.push('Många kulörer samtidigt – låt en eller två få ta plats.');
  }

  const vivid = entries.filter((c) => isVivid(c.hex)).length;
  if (vivid >= 3) {
    score -= 0.15;
    notes.push('Flera starka färger konkurrerar – dämpa med en neutral.');
  }

  return { score: clamp01(score), type, label: HARMONY_LABELS[type], notes };
}

// Ljushetskontrast mellan över- och underdel.
export function lightnessContrast(hexA, hexB) {
  return Math.abs(hexToHsl(hexA).l - hexToHsl(hexB).l);
}

export function textColorFor(hex) {
  return hexToHsl(hex).l > 0.6 ? '#1a1a1a' : '#ffffff';
}

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Föreslår färger som passar till en given färg (för "vad ska jag köpa?"-tips).
export function suggestMatches(hex) {
  const { h, s, l } = hexToHsl(hex);
  const mk = (hue, sat = s, lig = l) => hslToHex((hue + 360) % 360, sat, lig);
  const fam = colorFamily(hex);
  if (fam !== 'chromatic') {
    // Beprövade partners till neutraler.
    const pairs = {
      navy: [['Neutral', '#c19a6b'], ['Neutral', '#f3efe4'], ['Accent', '#a0461f'], ['Accent', '#9caf88'], ['Ton-i-ton', '#add8e6']],
      earth: [['Neutral', '#1f2a44'], ['Neutral', '#f3efe4'], ['Accent', '#6b6b2a'], ['Accent', '#5c0f1f'], ['Ton-i-ton', '#6b4226']],
      denim: [['Neutral', '#ffffff'], ['Neutral', '#c19a6b'], ['Accent', '#c8664a'], ['Accent', '#f5d327'], ['Neutral', '#151515']],
    };
    const dark = l < 0.4;
    const fallback = [
      ['Kontrast', dark ? '#f3efe4' : '#151515'], ['Neutral', '#1f2a44'], ['Neutral', '#c19a6b'],
      ['Accent', '#c8664a'], ['Accent', '#005f6a'],
    ];
    return (pairs[fam] ?? fallback).map(([label, h2]) => ({ label, hex: h2 }));
  }
  return [
    { label: 'Komplement', hex: mk(h + 180, Math.min(s, 0.55)) },
    { label: 'Analog', hex: mk(h + 30) },
    { label: 'Analog', hex: mk(h - 30) },
    { label: 'Ton-i-ton', hex: mk(h, s, l > 0.5 ? l - 0.25 : l + 0.25) },
  ];
}

export function hslToHex(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return rgbToHex({ r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 });
}
