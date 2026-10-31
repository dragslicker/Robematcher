// Väder via Open-Meteo (gratis, ingen API-nyckel) + översättning till klädbehov.

const WMO = {
  0: ['Klart', '☀️'], 1: ['Mestadels klart', '🌤️'], 2: ['Halvklart', '⛅'], 3: ['Mulet', '☁️'],
  45: ['Dimma', '🌫️'], 48: ['Rimfrost-dimma', '🌫️'],
  51: ['Lätt duggregn', '🌦️'], 53: ['Duggregn', '🌦️'], 55: ['Kraftigt duggregn', '🌧️'],
  56: ['Underkylt duggregn', '🌧️'], 57: ['Underkylt duggregn', '🌧️'],
  61: ['Lätt regn', '🌦️'], 63: ['Regn', '🌧️'], 65: ['Kraftigt regn', '🌧️'],
  66: ['Underkylt regn', '🌧️'], 67: ['Underkylt regn', '🌧️'],
  71: ['Lätt snöfall', '🌨️'], 73: ['Snöfall', '🌨️'], 75: ['Kraftigt snöfall', '❄️'], 77: ['Snökorn', '🌨️'],
  80: ['Regnskurar', '🌦️'], 81: ['Regnskurar', '🌧️'], 82: ['Kraftiga skurar', '⛈️'],
  85: ['Snöbyar', '🌨️'], 86: ['Snöbyar', '❄️'],
  95: ['Åska', '⛈️'], 96: ['Åska med hagel', '⛈️'], 99: ['Åska med hagel', '⛈️'],
};

export function describeCode(code) {
  return WMO[code] ?? ['Okänt', '🌡️'];
}

// Värmenivå 1 (hett) – 5 (kallt) utifrån upplevd temperatur och vind.
export function warmthLevel(feelsLike, windMs = 0) {
  let t = feelsLike;
  if (windMs > 10) t -= 3;
  if (t >= 23) return 1;
  if (t >= 17) return 2;
  if (t >= 11) return 3;
  if (t >= 4) return 4;
  return 5;
}

export const LEVEL_LABELS = {
  1: 'Varmt – lätta, luftiga plagg',
  2: 'Skönt – lätt lager räcker',
  3: 'Svalt – ta med en jacka',
  4: 'Kyligt – varm jacka och lager',
  5: 'Kallt – vinterkläder',
};

export function conditionsFrom({ temp, feelsLike, precipProb = 0, precip = 0, wind = 0, code = 0, snow = false }) {
  const isSnow = snow || [71, 73, 75, 77, 85, 86].includes(code);
  const rain = !isSnow && (precipProb >= 50 || precip >= 0.3 || (code >= 51 && code <= 82) || code >= 95);
  const sunny = [0, 1].includes(code);
  const level = warmthLevel(feelsLike ?? temp, wind);
  return { temp, feelsLike: feelsLike ?? temp, precipProb, wind, code, rain, snow: isSnow, sunny, level };
}

export async function geocode(name) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=sv&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Kunde inte söka plats');
  const data = await res.json();
  const r = data.results?.[0];
  if (!r) throw new Error(`Hittade ingen plats som heter "${name}"`);
  return { lat: r.latitude, lon: r.longitude, name: [r.name, r.country].filter(Boolean).join(', ') };
}

// Hämtar väder för idag (dagtid 08–18) eller imorgon.
export async function fetchWeather(lat, lon, dayOffset = 0) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    hourly: 'temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m',
    wind_speed_unit: 'ms',
    timezone: 'auto',
    forecast_days: '3',
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) throw new Error('Kunde inte hämta väder');
  const d = await res.json();
  const h = d.hourly;
  const day = h.time[0].slice(0, 10);
  const target = new Date(`${day}T12:00`);
  target.setDate(target.getDate() + dayOffset);
  const targetDay = target.toISOString().slice(0, 10);

  const idx = h.time
    .map((t, i) => [t, i])
    .filter(([t]) => t.startsWith(targetDay) && +t.slice(11, 13) >= 8 && +t.slice(11, 13) <= 18)
    .map(([, i]) => i);
  if (!idx.length) throw new Error('Ingen prognos för vald dag');

  const avg = (k) => idx.reduce((a, i) => a + h[k][i], 0) / idx.length;
  const max = (k) => Math.max(...idx.map((i) => h[k][i] ?? 0));
  // Vanligaste vädersymbolen, men nederbörd vinner om den förekommer ofta.
  const codes = idx.map((i) => h.weather_code[i]);
  const counts = {};
  for (const c of codes) counts[c] = (counts[c] || 0) + 1;
  const wet = codes.filter((c) => c >= 51);
  const code = wet.length >= 3
    ? Math.max(...wet)
    : +Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];

  return conditionsFrom({
    temp: Math.round(avg('temperature_2m')),
    feelsLike: Math.round(avg('apparent_temperature')),
    precipProb: Math.round(max('precipitation_probability')),
    precip: max('precipitation'),
    wind: Math.round(avg('wind_speed_10m')),
    code,
  });
}
