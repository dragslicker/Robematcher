// Väder via Open-Meteo (gratis, ingen API-nyckel), position via webbläsarens
// platstjänst och ortnamn via BigDataCloud (gratis klient-API).

const WMO = {
  0: ['Klart', 'sun'], 1: ['Mestadels klart', 'sun'], 2: ['Halvklart', 'partly'], 3: ['Mulet', 'cloud'],
  45: ['Dimma', 'fog'], 48: ['Dimma', 'fog'],
  51: ['Lätt duggregn', 'rain'], 53: ['Duggregn', 'rain'], 55: ['Duggregn', 'rain'],
  56: ['Underkylt duggregn', 'rain'], 57: ['Underkylt duggregn', 'rain'],
  61: ['Lätt regn', 'rain'], 63: ['Regn', 'rain'], 65: ['Kraftigt regn', 'rain'],
  66: ['Underkylt regn', 'rain'], 67: ['Underkylt regn', 'rain'],
  71: ['Lätt snöfall', 'snow'], 73: ['Snöfall', 'snow'], 75: ['Kraftigt snöfall', 'snow'], 77: ['Snökorn', 'snow'],
  80: ['Regnskurar', 'rain'], 81: ['Regnskurar', 'rain'], 82: ['Kraftiga skurar', 'rain'],
  85: ['Snöbyar', 'snow'], 86: ['Snöbyar', 'snow'],
  95: ['Åska', 'storm'], 96: ['Åska med hagel', 'storm'], 99: ['Åska med hagel', 'storm'],
};

export function describeCode(code) {
  return WMO[code] ?? ['Växlande', 'cloud'];
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
  1: 'Varmt. Lätta, luftiga plagg.',
  2: 'Skönt. Ett tunt lager räcker.',
  3: 'Svalt. Ta med en jacka.',
  4: 'Kyligt. Varm jacka och lager.',
  5: 'Kallt. Klä dig för vinter.',
};

export function conditionsFrom({ temp, feelsLike, precipProb = 0, precip = 0, wind = 0, code = 0, snow = false, ...rest }) {
  const isSnow = snow || [71, 73, 75, 77, 85, 86].includes(code);
  const rain = !isSnow && (precipProb >= 50 || precip >= 0.3 || (code >= 51 && code <= 82) || code >= 95);
  const sunny = [0, 1].includes(code);
  const level = warmthLevel(feelsLike ?? temp, wind);
  return { ...rest, temp, feelsLike: feelsLike ?? temp, precipProb, wind, code, rain, snow: isSnow, sunny, level };
}

// ---------- Plats ----------

export function getPosition({ timeout = 12000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('Din webbläsare stöder inte platstjänster.'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: +p.coords.latitude.toFixed(3), lon: +p.coords.longitude.toFixed(3) }),
      (err) => reject(new Error(
        err.code === 1 ? 'Platsåtkomst nekad. Tillåt plats för sidan i webbläsarens inställningar, eller sök efter en ort.'
          : 'Kunde inte hitta din position just nu.',
      )),
      { enableHighAccuracy: false, timeout, maximumAge: 15 * 60 * 1000 },
    );
  });
}

export async function locationPermission() {
  try {
    const s = await navigator.permissions?.query({ name: 'geolocation' });
    return s?.state ?? 'prompt';
  } catch {
    return 'prompt';
  }
}

export async function reverseGeocode(lat, lon) {
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=sv`;
    const res = await fetch(url);
    if (!res.ok) throw new Error();
    const d = await res.json();
    return d.city || d.locality || d.principalSubdivision || 'Din position';
  } catch {
    return 'Din position';
  }
}

export async function geocode(name) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=sv&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Kunde inte söka plats.');
  const data = await res.json();
  const r = data.results?.[0];
  if (!r) throw new Error(`Hittade ingen ort som heter "${name}".`);
  return { lat: r.latitude, lon: r.longitude, name: r.name };
}

// ---------- Prognos ----------

export async function fetchWeather(lat, lon, dayOffset = 0) {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: 'temperature_2m,apparent_temperature,weather_code',
    hourly: 'temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m',
    wind_speed_unit: 'ms',
    timezone: 'auto',
    forecast_days: '3',
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) throw new Error('Kunde inte hämta väder.');
  return summarizeForecast(await res.json(), dayOffset);
}

// Sammanfattar timprognosen till det man behöver för att klä sig.
// Exporteras separat så att den kan testas utan nätverk.
export function summarizeForecast(d, dayOffset = 0) {
  const h = d.hourly;
  const nowLocal = d.current?.time ?? h.time[0]; // lokal tid på platsen, "YYYY-MM-DDTHH:MM"
  const today = nowLocal.slice(0, 10);
  const days = [...new Set(h.time.map((t) => t.slice(0, 10)))];
  const targetDay = days[days.indexOf(today) + dayOffset] ?? days[dayOffset];
  const nowHour = +nowLocal.slice(11, 13);

  // Idag: från nu och resten av dagen. Imorgon: 08–20.
  const from = dayOffset === 0 ? Math.min(Math.max(8, nowHour), 21) : 8;
  const to = dayOffset === 0 ? Math.max(20, Math.min(23, nowHour + 3)) : 20;
  const idx = [];
  h.time.forEach((t, i) => {
    const hr = +t.slice(11, 13);
    if (t.startsWith(targetDay) && hr >= from && hr <= to) idx.push(i);
  });
  if (!idx.length) throw new Error('Ingen prognos för vald dag.');

  const avg = (k) => idx.reduce((a, i) => a + h[k][i], 0) / idx.length;
  const max = (k) => Math.max(...idx.map((i) => h[k][i] ?? 0));
  const codes = idx.map((i) => h.weather_code[i]);
  const counts = {};
  for (const c of codes) counts[c] = (counts[c] || 0) + 1;
  const wet = codes.filter((c) => c >= 51);
  const code = wet.length >= 3 ? Math.max(...wet) : +Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];

  const at = (hr) => {
    const i = h.time.findIndex((t) => t === `${targetDay}T${String(hr).padStart(2, '0')}:00`);
    return i >= 0 ? Math.round(h.temperature_2m[i]) : null;
  };
  const parts = [
    { label: 'Morgon', temp: at(8) },
    { label: 'Lunch', temp: at(13) },
    { label: 'Kväll', temp: at(19) },
  ].filter((p) => p.temp !== null);

  const isToday = dayOffset === 0;
  return conditionsFrom({
    date: targetDay,
    temp: Math.round(isToday && d.current ? d.current.temperature_2m : avg('temperature_2m')),
    feelsLike: Math.round(Math.min(avg('apparent_temperature'), isToday && d.current ? d.current.apparent_temperature : Infinity)),
    precipProb: Math.round(max('precipitation_probability')),
    precip: max('precipitation'),
    wind: Math.round(avg('wind_speed_10m')),
    code,
    parts,
  });
}
