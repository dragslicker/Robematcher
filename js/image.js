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

  let bgCount = 0;
  let minX = W, minY = H, maxX = 0, maxY = 0;
  for (let p = 0; p < W * H; p++) {
    if (mask[p]) { bgCount++; continue; }
    const x = p % W, y = (p / W) | 0;
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  const fgShare = 1 - bgCount / (W * H);
  if (fgShare < 0.04 || fgShare > 0.95) return null;

  // Mjuka kanter: alfa = andel förgrund i 3×3-grannskapet.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let fg = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          n++;
          if (!mask[yy * W + xx]) fg++;
        }
      }
      d[(y * W + x) * 4 + 3] = Math.round((fg / n) ** 1.5 * 255);
    }
  }
  ctx.putImageData(img, 0, 0);

  // Beskär till plagget med lite luft runt.
  const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.05);
  const cx = Math.max(0, minX - pad), cy = Math.max(0, minY - pad);
  const cw = Math.min(W, maxX + pad + 1) - cx, ch = Math.min(H, maxY + pad + 1) - cy;
  const out = document.createElement('canvas');
  out.width = cw;
  out.height = ch;
  out.getContext('2d').drawImage(src, cx, cy, cw, ch, 0, 0, cw, ch);
  return out;
}

const toBlob = (canvas, type, q) => new Promise((resolve) => canvas.toBlob(resolve, type, q));

// Hela kedjan för ett nytt foto.
export async function processPhoto(file, { cutout = true } = {}) {
  const img = await loadImage(file);
  const base = canvasFrom(img, 720);
  let canvas = base;
  let cutoutDone = false;
  if (cutout) {
    const work = canvasFrom(img, 720);
    const cut = removeBackground(work);
    if (cut) { canvas = cut; cutoutDone = true; }
  }
  let blob;
  if (cutoutDone) {
    blob = await toBlob(canvas, 'image/webp', 0.86);
    if (!blob || blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/png');
  } else {
    blob = await toBlob(canvas, 'image/jpeg', 0.84);
  }
  return { blob, cutout: cutoutDone, colors: extractColors(canvas, 4), image: img };
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
