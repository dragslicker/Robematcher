import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateOutfits, scoreOutfit, weatherFit } from '../js/outfits.js';
import { conditionsFrom, warmthLevel } from '../js/weather.js';
import { demoWardrobe } from '../js/demo.js';

const fixed = () => 0.5; // deterministisk slump
const find = (w, name) => w.find((i) => i.name === name);

test('värmenivåer', () => {
  assert.equal(warmthLevel(28), 1);
  assert.equal(warmthLevel(15), 3);
  assert.equal(warmthLevel(-5), 5);
  assert.equal(warmthLevel(12), 3);
  assert.equal(warmthLevel(12, 14), 4); // hård vind gör det kallare
});

test('varmt väder: inga ytterplagg, inga vinterkängor', () => {
  const cond = conditionsFrom({ temp: 27, code: 0 });
  const res = generateOutfits(demoWardrobe(), { conditions: cond, rng: fixed });
  assert.ok(res.length >= 4);
  for (const o of res) {
    assert.ok(!o.items.some((i) => i.category === 'outerwear'), o.items.map((i) => i.name).join());
    assert.ok(!o.items.some((i) => i.subtype === 'Kängor'));
  }
});

test('kallt väder: alltid ytterplagg', () => {
  const cond = conditionsFrom({ temp: -4, feelsLike: -8, code: 3 });
  const res = generateOutfits(demoWardrobe(), { conditions: cond, rng: fixed });
  for (const o of res) {
    const outer = o.items.find((i) => i.category === 'outerwear');
    assert.ok(outer && outer.warmth >= 4, o.items.map((i) => i.name).join());
    assert.ok(!o.items.some((i) => i.subtype === 'Shorts' || i.subtype === 'Sandaler'));
  }
});

test('regn: inga sandaler och oftast vattentätt', () => {
  const cond = conditionsFrom({ temp: 14, code: 63, precipProb: 90 });
  const res = generateOutfits(demoWardrobe(), { conditions: cond, rng: fixed });
  assert.ok(res.every((o) => !o.items.some((i) => i.subtype === 'Sandaler')));
  const wp = res.filter((o) => o.items.some((i) => i.waterproof)).length;
  assert.ok(wp >= res.length / 2);
});

test('business-stil ger formella plagg', () => {
  const cond = conditionsFrom({ temp: 15, code: 2 });
  const res = generateOutfits(demoWardrobe(), { conditions: cond, style: 'business', rng: fixed });
  for (const o of res) {
    assert.ok(!o.items.some((i) => ['Hoodie', 'Mjukisbyxor', 'Shorts'].includes(i.subtype)));
  }
});

test('låsta plagg finns med i alla förslag', () => {
  const w = demoWardrobe();
  const polo = find(w, 'Rostfärgad polo');
  const res = generateOutfits(w, { conditions: conditionsFrom({ temp: 12, code: 2 }), locked: [polo.id], rng: fixed });
  assert.ok(res.length > 0);
  assert.ok(res.every((o) => o.items.some((i) => i.id === polo.id)));
});

test('förslagen skiljer sig åt', () => {
  const res = generateOutfits(demoWardrobe(), { conditions: conditionsFrom({ temp: 18, code: 1 }), rng: fixed });
  const keys = new Set(res.map((o) => o.id));
  assert.equal(keys.size, res.length);
});

test('två tydliga mönster straffas', () => {
  const base = { formality: 2, warmth: 2, styles: ['casual'] };
  const a = { ...base, id: 'a', name: 'Rutig skjorta', category: 'top', color: '#c8102e', color2: '#1f2a44', pattern: 'bold' };
  const b = { ...base, id: 'b', name: 'Blommig kjol', category: 'bottom', color: '#f4a7b9', color2: '#228b22', pattern: 'bold' };
  const c = { ...b, id: 'c', name: 'Svart kjol', color: '#151515', color2: null, pattern: 'solid' };
  assert.ok(scoreOutfit([a, c]).total > scoreOutfit([a, b]).total + 0.2);
  assert.ok(scoreOutfit([a, b]).warnings.some((w) => w.includes('mönster')));
});

test('sandaler passar dåligt i regn', () => {
  const sandal = { category: 'shoes', subtype: 'Sandaler', warmth: 1 };
  const rain = conditionsFrom({ temp: 20, code: 63 });
  assert.ok(weatherFit(sandal, rain) < 0.3);
});

test('tom garderob ger inga förslag', () => {
  assert.deepEqual(generateOutfits([], {}), []);
});

test('prognosen sammanfattas för rätt dag och tid', async () => {
  const { summarizeForecast } = await import('../js/weather.js');
  const time = [];
  const temps = [];
  for (const day of ['2026-10-31', '2026-11-01']) {
    for (let h = 0; h < 24; h++) {
      time.push(`${day}T${String(h).padStart(2, '0')}:00`);
      temps.push(day === '2026-10-31' ? 5 + (h >= 12 ? 4 : 0) : -2);
    }
  }
  const n = time.length;
  const d = {
    current: { time: '2026-10-31T13:15', temperature_2m: 9.4, apparent_temperature: 7.1, weather_code: 3 },
    hourly: {
      time, temperature_2m: temps, apparent_temperature: temps.map((t) => t - 2),
      precipitation_probability: Array(n).fill(10), precipitation: Array(n).fill(0),
      weather_code: time.map((t) => (t.startsWith('2026-11-01') ? 73 : 3)), wind_speed_10m: Array(n).fill(3),
    },
  };
  const today = summarizeForecast(d, 0);
  assert.equal(today.temp, 9);
  assert.deepEqual(today.parts.map((p) => p.temp), [5, 9, 9]);
  assert.equal(today.snow, false);
  const tomorrow = summarizeForecast(d, 1);
  assert.equal(tomorrow.date, '2026-11-01');
  assert.equal(tomorrow.snow, true);
  assert.equal(tomorrow.level, 5);
});
