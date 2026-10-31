// Bildhantering: förminskning för lagring och utvinning av dominerande färger.

import { rgbToHex, rgbToHsl, hueDistance } from './color.js';

export function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Kunde inte läsa bilden')); };
    img.src = url;
  });
}

export function resizeToDataUrl(img, max = 480, quality = 0.78) {
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', quality);
}

// Hittar plaggets dominerande färger. Bakgrunden uppskattas från bildens kanter
// och filtreras bort, och mitten av bilden viktas högre.
export function extractColors(img, k = 3) {
  const N = 72;
  const c = document.createElement('canvas');
  c.width = N;
  c.height = N;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, N, N);
  const { data } = ctx.getImageData(0, 0, N, N);
  const px = (x, y) => {
    const i = (y * N + x) * 4;
    return [data[i], data[i + 1], data[i + 2], data[i + 3]];
  };

  // Bakgrund: medel av kantpixlar.
  const border = [];
  for (let i = 0; i < N; i++) border.push(px(i, 0), px(i, N - 1), px(0, i), px(N - 1, i));
  const bg = border.reduce((a, p) => [a[0] + p[0], a[1] + p[1], a[2] + p[2]], [0, 0, 0]).map((v) => v / border.length);
  const borderVar = border.reduce((a, p) => a + dist(p, bg), 0) / border.length;
  const bgIsUniform = borderVar < 40;

  const bins = new Map();
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const p = px(x, y);
      if (p[3] < 128) continue;
      if (bgIsUniform && dist(p, bg) < 42) continue;
      const dx = (x - N / 2) / (N / 2);
      const dy = (y - N / 2) / (N / 2);
      const w = 1.4 - Math.min(1, Math.sqrt(dx * dx + dy * dy));
      const key = (p[0] >> 4) << 8 | (p[1] >> 4) << 4 | (p[2] >> 4);
      const b = bins.get(key) || { r: 0, g: 0, b: 0, w: 0 };
      b.r += p[0] * w; b.g += p[1] * w; b.b += p[2] * w; b.w += w;
      bins.set(key, b);
    }
  }
  let clusters = [...bins.values()].map((b) => ({ r: b.r / b.w, g: b.g / b.w, b: b.b / b.w, w: b.w }));
  if (!clusters.length) return [];
  clusters.sort((a, b) => b.w - a.w);

  // Slå ihop närliggande färger.
  const merged = [];
  for (const cl of clusters) {
    const hsl = rgbToHsl(cl);
    const m = merged.find((x) => {
      const xh = rgbToHsl(x);
      const lowSat = hsl.s < 0.15 && xh.s < 0.15;
      return dist([cl.r, cl.g, cl.b], [x.r, x.g, x.b]) < 55
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
  return merged.slice(0, k).map((m) => ({ hex: rgbToHex(m), share: m.w / total }));
}

function dist(a, b) {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}
