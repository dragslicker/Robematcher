// Fotobehandling: frilägger plagget från en enfärgad bakgrund, beskär,
// komprimerar och läser av plaggets dominerande färger.

import { rgbToHex, rgbToHsl, hueDistance } from './color.js';

export function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Kunde inte läsa bilden.')); };
    img.src = url;
  });
}

function canvasFrom(img, max) {
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.width * scale));
  c.height = Math.max(1, Math.round(img.height * scale));
  c.getContext('2d', { willReadFrequently: true }).drawImage(img, 0, 0, c.width, c.height);
  return c;
}

const dist = (r1, g1, b1, r2, g2, b2) => Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);

function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  return s[s.length >> 1];
}

// Försöker ta bort bakgrunden genom flood fill från bildens kanter.
// Fungerar bäst när plagget ligger på/hänger mot en jämn yta (säng, golv, vägg).
// Returnerar null om bakgrunden inte är tillräckligt enhetlig.
export function removeBackground(src) {
  const W = src.width;
  const H = src.height;
  const ctx = src.getContext('2d', { willReadFrequently: true });
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;

  // Bakgrundsfärg = median av kantpixlarna.
  const br = [], bg = [], bb = [];
  const pushBorder = (x, y) => { const i = (y * W + x) * 4; br.push(d[i]); bg.push(d[i + 1]); bb.push(d[i + 2]); };
  for (let x = 0; x < W; x += 2) { pushBorder(x, 0); pushBorder(x, H - 1); }
  for (let y = 0; y < H; y += 2) { pushBorder(0, y); pushBorder(W - 1, y); }
  const R = median(br), G = median(bg), B = median(bb);
  let near = 0;
  for (let k = 0; k < br.length; k++) if (dist(br[k], bg[k], bb[k], R, G, B) < 50) near++;
  if (near / br.length < 0.6) return null;

  const bgSum = R + G + B + 1;
  const isBg = (i) => {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    if (dist(r, g, b, R, G, B) < 46) return true;
    // Skuggor: samma kulör som bakgrunden men mörkare.
    const s = r + g + b + 1;
    const chroma = Math.abs(r / s - R / bgSum) + Math.abs(g / s - G / bgSum) + Math.abs(b / s - B / bgSum);
    return chroma < 0.035 && s / bgSum > 0.6 && s / bgSum < 1.08;
  };

  const mask = new Uint8Array(W * H); // 1 = bakgrund
  const stack = [];
  const seed = (x, y) => { const p = y * W + x; if (!mask[p] && isBg(p * 4)) { mask[p] = 1; stack.push(p); } };
  for (let x = 0; x < W; x++) { seed(x, 0); seed(x, H - 1); }
  for (let y = 0; y < H; y++) { seed(0, y); seed(W - 1, y); }
  while (stack.length) {
    const p = stack.pop();
    const x = p % W;
    const y = (p / W) | 0;
    if (x > 0) seed(x - 1, y);
    if (x < W - 1) seed(x + 1, y);
    if (y > 0) seed(x, y - 1);
    if (y < H - 1) seed(x, y + 1);
  }

  // Hitta sammanhängande plagg (komponenter) i förgrunden.
  const labels = new Int32Array(W * H).fill(-1);
  const comps = [];
  const q = new Int32Array(W * H);
  for (let p0 = 0; p0 < W * H; p0++) {
    if (mask[p0] || labels[p0] !== -1) continue;
    const id = comps.length;
    const c = { id, area: 0, minX: W, minY: H, maxX: 0, maxY: 0, r: 0, g: 0, b: 0 };
    let head = 0, tail = 0;
    q[tail++] = p0;
    labels[p0] = id;
    while (head < tail) {
      const p = q[head++];
      const x = p % W, y = (p / W) | 0;
      c.area++;
      c.r += d[p * 4]; c.g += d[p * 4 + 1]; c.b += d[p * 4 + 2];
      if (x < c.minX) c.minX = x; if (x > c.maxX) c.maxX = x;
      if (y < c.minY) c.minY = y; if (y > c.maxY) c.maxY = y;
      const nb = [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1];
      for (const n of nb) if (n >= 0 && !mask[n] && labels[n] === -1) { labels[n] = id; q[tail++] = n; }
    }
    c.r /= c.area; c.g /= c.area; c.b /= c.area;
    comps.push(c);
  }
  const total = comps.reduce((a, c) => a + c.area, 0);
  const fgShare = total / (W * H);
  if (fgShare < 0.04 || fgShare > 0.95) return null;

  // Släng småfläckar (smulor, ludd, skuggkanter).
  const largest = Math.max(...comps.map((c) => c.area));
  let kept = comps.filter((c) => c.area >= Math.max(W * H * 0.012, largest * 0.12));

  // Slå ihop delar som hör ihop: t.ex. två skor i ett par (lika stora,
  // samma färg, nära varandra).
  const parent = kept.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const gapLimit = Math.max(W, H) * 0.08;
  for (let i = 0; i < kept.length; i++) {
    for (let j = i + 1; j < kept.length; j++) {
      const a = kept[i], b = kept[j];
      const gx = Math.max(0, Math.max(a.minX, b.minX) - Math.min(a.maxX, b.maxX));
      const gy = Math.max(0, Math.max(a.minY, b.minY) - Math.min(a.maxY, b.maxY));
      const ratio = a.area / b.area;
      if (Math.hypot(gx, gy) < gapLimit && ratio > 0.45 && ratio < 2.2 && dist(a.r, a.g, a.b, b.r, b.g, b.b) < 45) {
        parent[find(i)] = find(j);
      }
    }
  }
  const groups = new Map();
  kept.forEach((c, i) => {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(c.id);
  });
  return [...groups.values()].map((ids) => cutPart(src, d, W, H, labels, new Set(ids), comps));
}

// Skapar en frilagd, beskuren bild av de komponenter som ingår i `ids`.
function cutPart(src, d, W, H, labels, ids, comps) {
  let minX = W, minY = H, maxX = 0, maxY = 0;
  for (const id of ids) {
    const c = comps[id];
    minX = Math.min(minX, c.minX); minY = Math.min(minY, c.minY);
    maxX = Math.max(maxX, c.maxX); maxY = Math.max(maxY, c.maxY);
  }
  const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.05) + 2;
  const cx = Math.max(0, minX - pad), cy = Math.max(0, minY - pad);
  const cw = Math.min(W, maxX + pad + 1) - cx, ch = Math.min(H, maxY + pad + 1) - cy;
  const out = document.createElement('canvas');
  out.width = cw;
  out.height = ch;
  const octx = out.getContext('2d');
  const od = octx.createImageData(cw, ch);
  const inPart = (x, y) => x >= 0 && y >= 0 && x < W && y < H && ids.has(labels[y * W + x]);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const sx = x + cx, sy = y + cy;
      const si = (sy * W + sx) * 4, oi = (y * cw + x) * 4;
      // Mjuka kanter: alfa = andel av 3×3-grannskapet som hör till plagget.
      let fg = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (inPart(sx + dx, sy + dy)) fg++;
      od.data[oi] = d[si]; od.data[oi + 1] = d[si + 1]; od.data[oi + 2] = d[si + 2];
      od.data[oi + 3] = Math.round((fg / 9) ** 1.5 * 255);
    }
  }
  octx.putImageData(od, 0, 0);
  return out;
}

const toBlob = (canvas, type, q) => new Promise((resolve) => canvas.toBlob(resolve, type, q));

async function encode(canvas, cutout) {
  if (!cutout) return toBlob(canvas, 'image/jpeg', 0.84);
  let blob = await toBlob(canvas, 'image/webp', 0.86);
  if (!blob || blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/png');
  return blob;
}

// Hela kedjan för ett nytt foto. Med `split` blir varje separat plagg på
// bilden ett eget resultat (lägg plaggen med lite mellanrum).
export async function processPhoto(file, { cutout = true, split = false } = {}) {
  const img = await loadImage(file);
  let parts = null;
  if (cutout) {
    parts = removeBackground(canvasFrom(img, 720));
    if (parts && !split && parts.length > 1) {
      // Utan uppdelning: behåll det största plagget.
      parts = [parts.sort((a, b) => b.width * b.height - a.width * a.height)[0]];
    }
  }
  if (!parts) {
    const canvas = canvasFrom(img, 720);
    const blob = await encode(canvas, false);
    const out = [{ blob, cutout: false, colors: extractColors(canvas, 4), width: canvas.width, height: canvas.height }];
    return split ? out : out[0];
  }
  const out = [];
  for (const canvas of parts) {
    out.push({ blob: await encode(canvas, true), cutout: true, colors: extractColors(canvas, 4), width: canvas.width, height: canvas.height });
  }
  return split ? out : out[0];
}

// Gör en liten JPEG på neutral bakgrund att skicka till Claude.
export async function imageForAI(blob, max = 640) {
  const img = await loadImage(blob);
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.width * scale));
  c.height = Math.max(1, Math.round(img.height * scale));
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ece8e1';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return toBlob(c, 'image/jpeg', 0.85);
}

// Hittar dominerande färger. Genomskinliga pixlar ignoreras; finns ingen
// frilägning uppskattas bakgrunden från kanterna och mitten viktas högre.
export function extractColors(source, k = 3) {
  const N = 72;
  const c = document.createElement('canvas');
  c.width = N;
  c.height = N;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, N, N);
  const { data } = ctx.getImageData(0, 0, N, N);
  const px = (x, y) => {
    const i = (y * N + x) * 4;
    return [data[i], data[i + 1], data[i + 2], data[i + 3]];
  };

  const border = [];
  for (let i = 0; i < N; i++) border.push(px(i, 0), px(i, N - 1), px(0, i), px(N - 1, i));
  const opaqueBorder = border.filter((p) => p[3] > 200);
  let bg = null;
  if (opaqueBorder.length > border.length * 0.5) {
    const m = opaqueBorder.reduce((a, p) => [a[0] + p[0], a[1] + p[1], a[2] + p[2]], [0, 0, 0]).map((v) => v / opaqueBorder.length);
    const spread = opaqueBorder.reduce((a, p) => a + dist(p[0], p[1], p[2], m[0], m[1], m[2]), 0) / opaqueBorder.length;
    if (spread < 40) bg = m;
  }

  const bins = new Map();
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const p = px(x, y);
      if (p[3] < 160) continue;
      if (bg && dist(p[0], p[1], p[2], bg[0], bg[1], bg[2]) < 42) continue;
      const dx = (x - N / 2) / (N / 2);
      const dy = (y - N / 2) / (N / 2);
      const w = 1.4 - Math.min(1, Math.sqrt(dx * dx + dy * dy));
      const key = ((p[0] >> 4) << 8) | ((p[1] >> 4) << 4) | (p[2] >> 4);
      const b = bins.get(key) || { r: 0, g: 0, b: 0, w: 0 };
      b.r += p[0] * w; b.g += p[1] * w; b.b += p[2] * w; b.w += w;
      bins.set(key, b);
    }
  }
  const clusters = [...bins.values()].map((b) => ({ r: b.r / b.w, g: b.g / b.w, b: b.b / b.w, w: b.w }));
  if (!clusters.length) return [];
  clusters.sort((a, b) => b.w - a.w);

  const merged = [];
  for (const cl of clusters) {
    const hsl = rgbToHsl(cl);
    const m = merged.find((x) => {
      const xh = rgbToHsl(x);
      const lowSat = hsl.s < 0.15 && xh.s < 0.15;
      return dist(cl.r, cl.g, cl.b, x.r, x.g, x.b) < 55
        || (lowSat ? Math.abs(hsl.l - xh.l) < 0.12 : hueDistance(hsl.h, xh.h) < 14 && Math.abs(hsl.l - xh.l) < 0.18);
    });
    if (m) {
      const tw = m.w + cl.w;
      m.r = (m.r * m.w + cl.r * cl.w) / tw;
      m.g = (m.g * m.w + cl.g * cl.w) / tw;
      m.b = (m.b * m.w + cl.b * cl.w) / tw;
      m.w = tw;
    } else {
      merged.push({ ...cl });
    }
  }
  merged.sort((a, b) => b.w - a.w);
  const total = merged.reduce((a, m) => a + m.w, 0);
  return merged
    .map((m) => ({ hex: rgbToHex(m), share: m.w / total }))
    .filter((m, i) => i === 0 || m.share >= 0.06) // småfläckar = skuggor/kanter
    .slice(0, k);
}
