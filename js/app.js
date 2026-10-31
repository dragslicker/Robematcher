import { CATEGORIES, SUBTYPES, STYLES, PATTERNS, defaultStyles } from './catalog.js';
import { colorName, textColorFor, suggestMatches, paletteHarmony, colorFamily } from './color.js';
import { generateOutfits, scoreOutfit } from './outfits.js';
import {
  fetchWeather, geocode, describeCode, conditionsFrom, LEVEL_LABELS, getPosition, reverseGeocode,
} from './weather.js';
import { init, save, uid, exportJson, importJson, photoUrl, putPhoto, deletePhoto } from './storage.js';
import { processPhoto } from './image.js';
import { demoWardrobe } from './demo.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

let state;
let outfits = [];
const locked = new Set();
let categoryFilter = '';
const wx = { status: 'idle', error: '', note: '', cond: null, panel: false, lastFetch: 0 };

const persist = () => save(state);

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 2600);
}

// ---------- Grafik ----------
const ICONS = {
  sun: '<circle cx="24" cy="24" r="8"/><path d="M24 6v5M24 37v5M6 24h5M37 24h5M11.3 11.3l3.5 3.5M33.2 33.2l3.5 3.5M11.3 36.7l3.5-3.5M33.2 14.8l3.5-3.5"/>',
  partly: '<circle cx="18" cy="17" r="6"/><path d="M18 5v3M6 17h3M9.5 8.5l2 2M26.5 8.5l-2 2"/><path d="M16 38h20a7 7 0 0 0 0-14 10 10 0 0 0-19 3 5.5 5.5 0 0 0-1 11z"/>',
  cloud: '<path d="M13 36h23a8 8 0 0 0 0-16 11 11 0 0 0-21 3 6.5 6.5 0 0 0-2 13z"/>',
  rain: '<path d="M13 30h23a8 8 0 0 0 0-16 11 11 0 0 0-21 3 6.5 6.5 0 0 0-2 13z"/><path d="M17 35l-2 5M25 35l-2 5M33 35l-2 5"/>',
  snow: '<path d="M13 30h23a8 8 0 0 0 0-16 11 11 0 0 0-21 3 6.5 6.5 0 0 0-2 13z"/><path d="M17 36v4M15 38h4M25 36v4M23 38h4M33 36v4M31 38h4"/>',
  fog: '<path d="M8 18h32M12 24h28M8 30h28M14 36h22"/>',
  storm: '<path d="M13 30h23a8 8 0 0 0 0-16 11 11 0 0 0-21 3 6.5 6.5 0 0 0-2 13z"/><path d="M25 32l-4 6h6l-4 6"/>',
};
const weatherIcon = (kind) => `<svg class="fc-icon" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[kind] ?? ICONS.cloud}</svg>`;
const PIN = '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><path d="M6 11s4-3.6 4-6.5a4 4 0 0 0-8 0C2 7.4 6 11 6 11z"/><circle cx="6" cy="4.6" r="1.3"/></svg>';

// Silhuetter för plagg utan foto (t.ex. exempelgarderoben).
const SHAPES = {
  top: 'M22 10l-12 6 4 11 6-2v29h24V25l6 2 4-11-12-6c-1 4-5 6-10 6s-9-2-10-6z',
  bottom: 'M18 6h28l3 52h-12l-5-34-5 34H15z',
  dress: 'M25 4h14l-2 10 10 46H17l10-46z',
  outerwear: 'M22 6l-13 6 2 46h13V22l8 10 8-10v36h13l2-46-13-6-10 16z',
  shoes: 'M6 34c0-6 4-10 8-10 3 0 5 3 9 5 6 3 14 4 22 5 7 1 11 4 11 8v4H6z',
  accessory: 'M14 26a18 18 0 0 1 36 0v4H14z M10 30h44v6H10z',
};
const ACCESSORY_SHAPES = {
  Skärp: 'M4 27h40v10H4z M44 24h12v16H44z M48 28h4v8h-4z',
  Väska: 'M12 24h40l-3 30H15z M22 24c0-12 20-12 20 0h-4c0-7-12-7-12 0z',
  Halsduk: 'M14 10h36v12c0 4-6 6-12 6v28h-10V28c-8 0-14-2-14-6z',
  Solglasögon: 'M4 26h56v4h-3l-3 10c-1 4-4 6-8 6h-4c-4 0-7-3-8-7l-1-5h-2l-1 5c-1 4-4 7-8 7h-4c-4 0-7-2-8-6L7 30H4z',
  Klocka: 'M26 4h12v12H26z M26 48h12v12H26z M32 14a18 18 0 1 1 0 36a18 18 0 1 1 0-36z',
  Smycke: 'M32 6c14 0 22 12 22 20S42 46 32 58C22 46 10 34 10 26S18 6 32 6z',
  Slips: 'M26 6h12l-2 8 6 34-10 10-10-10 6-34z',
};

let svgSeq = 0;
function garmentSvg(item) {
  const id = `g${++svgSeq}`;
  const shape = ACCESSORY_SHAPES[item.subtype] ?? SHAPES[item.category] ?? SHAPES.top;
  let fill = item.color;
  let defs = '';
  if (item.color2) {
    const bold = item.pattern === 'bold';
    defs = `<defs><pattern id="${id}" width="${bold ? 12 : 8}" height="${bold ? 12 : 8}" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="${item.color}"/>${bold ? `<circle cx="6" cy="6" r="2.4" fill="${item.color2}"/>` : `<rect y="5" width="8" height="1.6" fill="${item.color2}"/>`}</pattern></defs>`;
    fill = `url(#${id})`;
  }
  return `<svg viewBox="0 0 64 64" aria-hidden="true">${defs}<path d="${shape}" fill="${fill}" stroke="rgba(0,0,0,.18)" stroke-width=".8" stroke-linejoin="round"/></svg>`;
}

function visual(item) {
  const url = item.hasPhoto ? photoUrl(item.id) : null;
  return url ? `<img class="${item.cutout ? 'cut' : 'photo'}" src="${url}" alt="" loading="lazy" />` : garmentSvg(item);
}

// ---------- Navigering ----------
function showView(name) {
  $$('.nav button').forEach((b) => (b.dataset.view === name ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current')));
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${name}`));
  if (name === 'wardrobe') renderWardrobe();
  if (name === 'saved') renderSaved();
  if (name === 'color') renderColorLab();
  window.scrollTo({ top: 0 });
}
$$('.nav button').forEach((b) => b.addEventListener('click', () => showView(b.dataset.view)));

// ---------- Väder & plats ----------
async function startWeather({ forceLocate = false } = {}) {
  const s = state.settings;
  if (s.manual && !s.manual.auto && !forceLocate) {
    wx.cond = conditionsFrom({ temp: s.manual.temp, feelsLike: s.manual.temp, code: s.manual.rain ? 63 : s.manual.sunny ? 0 : 2 });
    wx.status = 'ok';
    if (!s.manual.auto) wx.note = '';
    renderWeather();
    generate();
    return;
  }
  if (forceLocate || s.manual?.auto || !s.location || s.location.source === 'gps') return locate();
  return loadForecast(s.location);
}

async function locate() {
  const s = state.settings;
  wx.note = '';
  if (!wx.cond) { wx.status = 'locating'; renderWeather(); }
  try {
    const pos = await getPosition();
    const prev = s.location;
    const moved = !prev || prev.source !== 'gps' || Math.abs(prev.lat - pos.lat) > 0.05 || Math.abs(prev.lon - pos.lon) > 0.05;
    const name = moved ? await reverseGeocode(pos.lat, pos.lon) : prev.name;
    s.location = { ...pos, name, source: 'gps' };
    s.manual = null;
    persist();
    await loadForecast(s.location);
  } catch (e) {
    if (s.location) {
      wx.note = e.message;
      await loadForecast(s.location);
    } else {
      fallbackToManual(e.message);
    }
  }
}

// Utan position och prognos (t.ex. nekad plats eller inget nät): visa förslag
// för ett inställbart väder i stället för en tom sida. Nästa gång försöker
// appen hämta riktig position igen.
function fallbackToManual(message) {
  state.settings.manual = { temp: 12, rain: false, sunny: false, auto: true };
  wx.note = `${message} Ställ in vädret nedan så länge.`;
  wx.panel = true;
  wx.cond = conditionsFrom({ temp: 12, feelsLike: 12, code: 2 });
  wx.status = 'ok';
  renderWeather();
  generate();
}

async function loadForecast(loc) {
  if (!wx.cond) { wx.status = 'locating'; renderWeather(); }
  try {
    wx.cond = await fetchWeather(loc.lat, loc.lon, state.settings.day ?? 0);
    wx.status = 'ok';
    wx.lastFetch = Date.now();
  } catch (e) {
    if (!wx.cond) { fallbackToManual('Kunde inte hämta vädret.'); return; }
    wx.note = e.message;
  }
  renderWeather();
  generate();
}

function formatDay(date) {
  const d = date ? new Date(`${date}T12:00`) : new Date();
  return d.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' });
}

function placePanel() {
  const s = state.settings;
  const manual = !!s.manual;
  return `<div class="place-panel">
    ${wx.status === 'error' && wx.error ? `<p>${esc(wx.error)}</p>` : ''}
    <div><button class="btn" data-act="gps">Använd min position</button></div>
    <form class="search" id="search"><input name="q" type="search" placeholder="Eller sök en ort" aria-label="Ort" /><button>Sök</button></form>
    ${manual ? `<div class="manual-row">
        <label class="range">Temperatur <output id="m-out">${s.manual.temp}°</output><input type="range" min="-20" max="35" value="${s.manual.temp}" id="m-temp" /></label>
        <label class="switch"><input type="checkbox" id="m-rain" ${s.manual.rain ? 'checked' : ''} /> <span>Regn</span></label>
        <label class="switch"><input type="checkbox" id="m-sun" ${s.manual.sunny ? 'checked' : ''} /> <span>Sol</span></label>
      </div>` : '<div><button class="textbtn" data-act="manual">Ställ in vädret själv</button></div>'}
  </div>`;
}

function renderWeather() {
  const el = $('#forecast');
  const s = state.settings;
  if (wx.status === 'locating' || wx.status === 'idle') {
    el.innerHTML = '<div class="locating"><span class="pulse"></span> Hämtar vädret där du är…</div>';
    return;
  }
  if (!wx.cond) {
    el.innerHTML = `<div class="fc-top"><span class="eyebrow">${esc(cap(formatDay()))}</span></div>
      <p class="fc-desc">Var är du idag?</p>${placePanel()}`;
    bindWeather();
    return;
  }
  const c = wx.cond;
  const [desc, kind] = describeCode(c.code);
  const manual = !!s.manual;
  const place = manual ? 'Eget väder' : s.location?.name ?? 'Okänd plats';
  const parts = [
    ...(manual ? [] : (c.parts ?? []).map((p) => [p.label, `${p.temp}°`])),
    ['Känns som', `${c.feelsLike}°`],
    ...(manual ? [] : [['Regn', `${c.precipProb}%`]]),
    ...(c.wind >= 6 ? [['Vind', `${c.wind} m/s`]] : []),
  ];
  el.innerHTML = `
    <div class="fc-top">
      <span class="eyebrow">${esc(cap(formatDay(c.date)))}</span>
      ${manual ? '' : `<div class="seg" role="group" aria-label="Dag">
        <button data-day="0" aria-pressed="${!s.day}">Idag</button>
        <button data-day="1" aria-pressed="${s.day === 1}">Imorgon</button></div>`}
    </div>
    <div class="fc-main">
      <span class="fc-temp">${c.temp}°</span>
      <div>
        <div class="fc-desc">${esc(manual ? (c.rain ? 'Regn' : c.sunny ? 'Sol' : 'Uppehåll') : desc)}</div>
        <button class="fc-place" data-act="place">${PIN} ${esc(place)}</button>
      </div>
      <span class="spacer"></span>
      ${weatherIcon(manual ? (c.rain ? 'rain' : c.sunny ? 'sun' : 'partly') : kind)}
    </div>
    <dl class="fc-parts">${parts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
    <p class="fc-advice">${esc(LEVEL_LABELS[c.level])}${c.rain ? ' Välj något som tål regn.' : ''}${c.snow ? ' Halkfria skor.' : ''}</p>
    ${wx.note ? `<p class="fc-note">${esc(wx.note)}</p>` : ''}
    ${wx.panel ? placePanel() : ''}`;
  bindWeather();
}

function bindWeather() {
  const el = $('#forecast');
  el.onclick = async (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    const day = e.target.closest('[data-day]')?.dataset.day;
    if (act === 'place') { wx.panel = !wx.panel; renderWeather(); }
    if (act === 'gps') {
      wx.panel = false;
      state.settings.manual = null;
      wx.cond = null;
      await startWeather({ forceLocate: true });
    }
    if (act === 'manual') {
      state.settings.manual = { temp: wx.cond?.temp ?? 15, rain: !!wx.cond?.rain, sunny: !!wx.cond?.sunny };
      persist();
      await startWeather();
    }
    if (day !== undefined) {
      state.settings.day = +day;
      persist();
      await loadForecast(state.settings.location);
    }
  };
  $('#search')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = new FormData(e.target).get('q').trim();
    if (!q) return;
    try {
      state.settings.location = { ...(await geocode(q)), source: 'search' };
      state.settings.manual = null;
      wx.panel = false;
      wx.note = '';
      persist();
      await loadForecast(state.settings.location);
    } catch (err) {
      toast(err.message);
    }
  });
  const mt = $('#m-temp');
  if (mt) {
    const upd = () => {
      persist();
      const m = state.settings.manual;
      wx.cond = conditionsFrom({ temp: m.temp, feelsLike: m.temp, code: m.rain ? 63 : m.sunny ? 0 : 2 });
      renderWeather();
      generate();
    };
    mt.addEventListener('input', () => { $('#m-out').textContent = `${mt.value}°`; });
    mt.addEventListener('change', () => { state.settings.manual.temp = +mt.value; upd(); });
    $('#m-rain').addEventListener('change', (e) => { state.settings.manual.rain = e.target.checked; upd(); });
    $('#m-sun').addEventListener('change', (e) => { state.settings.manual.sunny = e.target.checked; upd(); });
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state && !state.settings.manual && Date.now() - wx.lastFetch > 30 * 60 * 1000) {
    startWeather();
  }
});

// ---------- Looks ----------
function renderStyleTabs() {
  const cur = state.settings.style || '';
  const tabs = [['', 'Alla'], ...Object.entries(STYLES).map(([k, v]) => [k, v.label])];
  $('#style-tabs').innerHTML = tabs
    .map(([k, l]) => `<button role="tab" data-style="${k}" aria-selected="${cur === k}">${esc(l)}</button>`)
    .join('');
}
$('#style-tabs').addEventListener('click', (e) => {
  const b = e.target.closest('[data-style]');
  if (!b) return;
  state.settings.style = b.dataset.style;
  persist();
  renderStyleTabs();
  generate();
});

function generate() {
  const w = state.wardrobe;
  const hasBase = (w.some((i) => i.category === 'top') && w.some((i) => i.category === 'bottom')) || w.some((i) => i.category === 'dress');
  $('#looks-head').hidden = !hasBase;
  $('#lock-hint').hidden = !hasBase;
  if (!hasBase) {
    outfits = [];
    $('#looks').innerHTML = `<div class="empty">
      <h2>${w.length ? 'Nästan där.' : 'Börja med garderoben.'}</h2>
      <p>${w.length
        ? 'Fota minst en överdel och en underdel, eller en klänning. Skor och en jacka gör förslagen bättre.'
        : 'Fota dina kläder, ett plagg i taget eller många på en gång. Appen frilägger plaggen, läser av färgerna och sätter ihop outfits efter vädret där du är.'}</p>
      <div class="row"><button class="btn" data-act="camera">Fota plagg</button>
      ${w.length ? '' : '<button class="btn quiet" data-act="demo">Visa ett exempel</button>'}</div></div>`;
    return;
  }
  for (const id of [...locked]) if (!w.some((i) => i.id === id)) locked.delete(id);
  outfits = generateOutfits(w, { conditions: wx.cond, style: state.settings.style || null, count: 6, locked: [...locked] });
  renderLooks();
}

function boardColumns(items) {
  const of = (c) => items.filter((i) => i.category === c);
  const [outer] = of('outerwear');
  const [top] = of('top');
  const [dress] = of('dress');
  const [bottom] = of('bottom');
  const [shoes] = of('shoes');
  const acc = of('accessory');
  const [left, right] = dress ? [[dress], [outer, shoes, ...acc]] : [[outer, top], [bottom, shoes, ...acc]];
  return [left.filter(Boolean), right.filter(Boolean)];
}

function lookCard(o, n, { saved = false } = {}) {
  const pct = Math.round(o.total * 100);
  const palette = [...new Set(o.items.filter((i) => i.category !== 'accessory').flatMap((i) => [i.color, i.color2].filter(Boolean)))];
  const isFav = state.favorites.some((f) => f.key === o.id);
  const piece = (i) => `<button class="piece w-${i.category} ${locked.has(i.id) && !saved ? 'locked' : ''}" data-item="${esc(i.id)}" ${saved ? 'disabled' : ''} aria-label="${esc(i.name)}">${visual(i)}</button>`;
  const text = o.notes.slice(0, 2).join(' ');
  return `<article class="look" data-id="${esc(o.id)}">
    <div class="board">
      <span class="eyebrow look-no">Look ${String(n).padStart(2, '0')}</span>
      <span class="eyebrow look-score" title="Hur väl plaggen matchar, 0–100">${pct}</span>
      ${boardColumns(o.items).map((c) => `<div class="col">${c.map(piece).join('')}</div>`).join('')}
    </div>
    <div class="look-meta">
      <div class="look-title"><h3>${esc(o.harmony)}</h3><span class="chips">${palette.map((c) => `<i style="background:${c}" title="${esc(colorName(c))}"></i>`).join('')}</span></div>
      ${text ? `<p class="look-text">${esc(text)}</p>` : ''}
      <p class="look-items">${o.items.map((i) => esc(i.name)).join(' · ')}</p>
      ${o.warnings.map((w) => `<p class="look-warn">${esc(w)}</p>`).join('')}
      <div class="look-actions">
        ${saved
          ? `<button class="textbtn" data-unfav="${esc(o.id)}">Ta bort</button>`
          : `<button class="textbtn" data-fav="${esc(o.id)}">${isFav ? 'Sparad' : 'Spara'}</button>`}
        <button class="textbtn" data-wear="${esc(o.id)}">Bär idag</button>
      </div>
    </div>
  </article>`;
}

function renderLooks() {
  const el = $('#looks');
  if (!outfits.length) {
    el.innerHTML = '<div class="empty"><p>Inga kombinationer hittades. Prova en annan stil eller släpp ett låst plagg.</p></div>';
    return;
  }
  const when = state.settings.manual || !wx.cond ? '' : state.settings.day === 1 ? ' för imorgon' : ' för idag';
  $('#looks-count').textContent = `${outfits.length} förslag${when}`;
  el.innerHTML = outfits.map((o, i) => lookCard(o, i + 1)).join('');
  el.scrollLeft = 0;
}

$('#shuffle').addEventListener('click', generate);

document.addEventListener('click', (e) => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'camera') { pickInto = 'queue'; $('#cam-input').click(); return; }
  if (act === 'demo') { loadDemo(); return; }

  const piece = e.target.closest('#looks .piece');
  if (piece) {
    const id = piece.dataset.item;
    if (locked.has(id)) locked.delete(id); else locked.add(id);
    toast(locked.has(id) ? 'Plagget behålls i nästa omgång.' : 'Plagget släppt.');
    generate();
    return;
  }
  const fav = e.target.closest('[data-fav]');
  if (fav) {
    const o = outfits.find((x) => x.id === fav.dataset.fav);
    if (!o) return;
    if (state.favorites.some((f) => f.key === o.id)) {
      state.favorites = state.favorites.filter((f) => f.key !== o.id);
      fav.textContent = 'Spara';
    } else {
      state.favorites.unshift({ key: o.id, itemIds: o.items.map((i) => i.id), savedAt: Date.now() });
      fav.textContent = 'Sparad';
      toast('Sparad.');
    }
    persist();
    return;
  }
  const unfav = e.target.closest('[data-unfav]');
  if (unfav) {
    state.favorites = state.favorites.filter((f) => f.key !== unfav.dataset.unfav);
    persist();
    renderSaved();
    return;
  }
  const wear = e.target.closest('[data-wear]');
  if (wear) {
    const ids = wear.dataset.wear.split('+');
    const now = Date.now();
    for (const i of state.wardrobe) if (ids.includes(i.id)) i.lastWorn = now;
    state.history.unshift({ itemIds: ids, at: now });
    state.history = state.history.slice(0, 100);
    persist();
    toast('Noterat. Plaggen vilar några dagar så att det blir variation.');
  }
});

// ---------- Sparat ----------
function renderSaved() {
  const list = state.favorites
    .map((f) => {
      const items = f.itemIds.map((id) => state.wardrobe.find((i) => i.id === id)).filter(Boolean);
      return items.length ? { id: f.key, items, ...scoreOutfit(items, { conditions: null, style: null }) } : null;
    })
    .filter(Boolean);
  $('#saved').innerHTML = list.length
    ? list.map((o, i) => lookCard(o, i + 1, { saved: true })).join('')
    : '<div class="empty"><h2>Inget sparat än.</h2><p>Tryck på Spara under en look du gillar så hamnar den här.</p></div>';
}

// ---------- Garderob ----------
function renderCategoryTabs() {
  const counts = {};
  for (const i of state.wardrobe) counts[i.category] = (counts[i.category] || 0) + 1;
  const tabs = [['', 'Allt', state.wardrobe.length], ...Object.entries(CATEGORIES).map(([k, v]) => [k, v.plural, counts[k] || 0])];
  $('#category-tabs').innerHTML = tabs
    .map(([k, l, n]) => `<button role="tab" data-cat="${k}" aria-selected="${categoryFilter === k}">${esc(l)}<small>${n}</small></button>`)
    .join('');
}
$('#category-tabs').addEventListener('click', (e) => {
  const b = e.target.closest('[data-cat]');
  if (!b) return;
  categoryFilter = b.dataset.cat;
  renderWardrobe();
});

function renderWardrobe() {
  renderCategoryTabs();
  const n = state.wardrobe.length;
  $('#wardrobe-count').textContent = `${n} plagg`;
  const items = state.wardrobe.filter((i) => !categoryFilter || i.category === categoryFilter);
  $('#wardrobe-grid').innerHTML = items.length
    ? items.map((i) => `<button class="tile" data-edit="${esc(i.id)}">
        <div class="tile-img">${visual(i)}</div>
        <div class="tile-name">${esc(i.name)}</div>
        <div class="tile-sub"><i style="background:${i.color}"></i>${i.color2 ? `<i style="background:${i.color2}"></i>` : ''}${esc(i.subtype)}</div>
      </button>`).join('')
    : `<div class="empty" style="grid-column:1/-1">
        <h2>${n ? 'Inget här än.' : 'Fota din garderob.'}</h2>
        <p>Lägg plagget plant på sängen eller golvet, eller häng det mot en ljus vägg, och fota rakt framifrån. Du kan välja många bilder på en gång och gå igenom dem en i taget.</p>
      </div>`;
}
$('#wardrobe-grid').addEventListener('click', (e) => {
  const b = e.target.closest('[data-edit]');
  if (b) openSheet(state.wardrobe.find((i) => i.id === b.dataset.edit));
});

function loadDemo() {
  const existing = new Set(state.wardrobe.map((i) => i.id));
  const add = demoWardrobe().filter((i) => !existing.has(i.id));
  state.wardrobe.push(...add);
  persist();
  toast(`${add.length} exempelplagg tillagda.`);
  renderWardrobe();
  generate();
}
$('#load-demo').addEventListener('click', loadDemo);
$('#export').addEventListener('click', () => exportJson(state));
$('#import').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    state = await importJson(f);
    toast('Backup importerad.');
    renderWardrobe();
    renderStyleTabs();
    startWeather();
  } catch (err) {
    toast(err.message);
  }
  e.target.value = '';
});

// ---------- Plaggark (foto → plagg) ----------
const sheet = $('#sheet');
let draft = null;
let queue = [];
let queueIndex = 0;
let pickInto = 'queue';

const BASIC_COLORS = ['#151515', '#f7f7f5', '#8a8a8a', '#1f2a44', '#4f6d8f', '#d9c5a0', '#6b4226', '#6b6b2a'];
const WARMTH_TXT = ['Ingen', 'Mycket tunn', 'Tunn', 'Medel', 'Varm', 'Mycket varm'];
const FORMAL_TXT = ['', 'Avslappnad', 'Vardag', 'Snygg vardag', 'Uppklädd', 'Formell'];

$('#f-category').innerHTML = Object.entries(CATEGORIES).map(([k, v]) => `<button type="button" data-cat="${k}">${esc(v.label)}</button>`).join('');
$('#f-pattern').innerHTML = Object.entries(PATTERNS).map(([k, v]) => `<button type="button" data-pattern="${k}">${esc(v)}</button>`).join('');
$('#f-styles').innerHTML = Object.entries(STYLES).map(([k, v]) => `<label><input type="checkbox" value="${k}" />${esc(v.label)}</label>`).join('');

function newDraft(category) {
  const cat = category ?? state.settings.lastCategory ?? 'top';
  const [sub, warmth, formality] = SUBTYPES[cat][0];
  const d = {
    id: null, category: cat, subtype: sub, warmth, formality, color: '#1f2a44', color2: null, pattern: 'solid',
    styles: defaultStyles(formality), waterproof: false, name: '', nameTouched: false, stylesTouched: false,
    photo: null, file: null, colors: [], busy: false,
  };
  d.name = `${colorName(d.color)} ${sub.toLowerCase()}`;
  return d;
}

function openSheet(item = null) {
  $('#delete-item').dataset.armed = '';
  $('#delete-item').textContent = 'Ta bort';
  if (item) {
    draft = {
      ...newDraft(item.category), ...structuredClone(item), nameTouched: true, stylesTouched: true,
      photo: item.hasPhoto && photoUrl(item.id) ? { url: photoUrl(item.id), cutout: !!item.cutout, blob: null } : null,
      file: null, colors: [], busy: false,
    };
  } else {
    draft = newDraft();
  }
  renderSheet();
  if (!sheet.open) sheet.showModal();
  sheet.scrollTop = 0;
}

function autoName() {
  if (draft.nameTouched) return;
  draft.name = `${colorName(draft.color)} ${draft.subtype.toLowerCase()}`;
}

function applySubtype(name) {
  const st = SUBTYPES[draft.category].find(([n]) => n === name) ?? SUBTYPES[draft.category][0];
  [draft.subtype, draft.warmth, draft.formality] = st;
  draft.waterproof = ['Regnjacka', 'Gummistövlar', 'Parkas', 'Dunjacka', 'Trenchcoat', 'Vinterkängor'].includes(st[0]);
  if (!draft.stylesTouched) draft.styles = defaultStyles(draft.formality);
  autoName();
}

function renderSheet() {
  const d = draft;
  if (!d) return;
  const total = queue.length;
  $('#sheet-title').textContent = d.id ? 'Redigera plagg' : total > 1 ? `Plagg ${queueIndex + 1} av ${total}` : 'Nytt plagg';
  $('#delete-item').hidden = !d.id;
  if (!d.id) { $('#delete-item').dataset.armed = ''; $('#delete-item').textContent = 'Ta bort'; }
  $('#save-item').textContent = !d.id && queueIndex < total - 1 ? 'Spara · nästa' : 'Spara';

  // Foto
  const ph = $('#ph');
  ph.hidden = !d.photo || d.busy;
  if (d.photo) {
    if (ph.getAttribute('src') !== d.photo.url) ph.src = d.photo.url;
    ph.className = d.photo.cutout ? 'cut' : 'photo';
  }
  $('#stage-empty').hidden = !!d.photo || d.busy;
  $('#stage-status').hidden = !d.busy;
  $('#stage-status').innerHTML = '<span class="pulse"></span> Frilägger och läser av färger';
  $('#stage-tools').hidden = !d.photo || d.busy;
  $('#f-cutout').closest('.switch').hidden = !d.file;
  $('#f-cutout').checked = !!d.photo?.cutout;

  // Färger
  const options = d.colors.length ? d.colors.map((c) => c.hex) : BASIC_COLORS;
  const opts = [...new Set([...options, d.color].filter(Boolean))];
  const sw = (hex, role, pressed) => `<button type="button" class="sw" data-${role}="${hex}" style="background:${hex}" aria-pressed="${pressed}" title="${esc(colorName(hex))}"></button>`;
  $('#sw-main').innerHTML = opts.map((h) => sw(h, 'main', h === d.color)).join('')
    + `<label class="sw-custom" title="Egen färg">+<input type="color" data-custom="main" value="${d.color}" /></label>`
    + `<span class="sw-name">${esc(colorName(d.color))}</span>`;
  const opts2 = [...new Set([...options, d.color2].filter((h) => h && h !== d.color))];
  $('#sw-second').innerHTML = `<button type="button" class="sw none" data-second="" aria-pressed="${!d.color2}" title="Ingen"></button>`
    + opts2.map((h) => sw(h, 'second', h === d.color2)).join('')
    + `<label class="sw-custom" title="Egen färg">+<input type="color" data-custom="second" value="${d.color2 ?? '#ffffff'}" /></label>`
    + `<span class="sw-name">${d.color2 ? esc(colorName(d.color2)) : 'Ingen'}</span>`;

  // Kategori & typ
  $$('#f-category button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.cat === d.category)));
  $('#f-subtype').innerHTML = SUBTYPES[d.category].map(([n]) => `<option ${n === d.subtype ? 'selected' : ''}>${esc(n)}</option>`).join('');
  $('#f-name').value = d.name;

  // Detaljer
  $$('#f-pattern button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.pattern === d.pattern)));
  $$('#f-styles input').forEach((c) => { c.checked = d.styles.includes(c.value); });
  $('#f-warmth').value = d.warmth;
  $('#f-formality').value = d.formality;
  $('#o-warmth').textContent = WARMTH_TXT[d.warmth];
  $('#o-formality').textContent = FORMAL_TXT[d.formality];
  $('#f-waterproof').checked = !!d.waterproof;
}

async function loadPhoto(file) {
  draft.file = file;
  await processInto(draft, file, true);
}

async function processInto(d, file, cutout) {
  d.busy = true;
  renderSheet();
  try {
    const res = await processPhoto(file, { cutout });
    if (d !== draft) return;
    if (d.photo?.blob) URL.revokeObjectURL(d.photo.url);
    d.photo = { blob: res.blob, url: URL.createObjectURL(res.blob), cutout: res.cutout };
    d.colors = res.colors;
    if (res.colors[0]) d.color = res.colors[0].hex;
    d.color2 = res.colors[1] && res.colors[1].share > 0.15 ? res.colors[1].hex : null;
    if (d.color2 && d.pattern === 'solid') d.pattern = 'subtle';
    if (cutout && !res.cutout) toast('Bakgrunden var för rörig för att frilägga. Fotot sparas som det är.');
    autoName();
  } catch (err) {
    toast(err.message);
  }
  d.busy = false;
  renderSheet();
}

$('#add-camera').addEventListener('click', () => { pickInto = 'queue'; $('#cam-input').click(); });
$('#add-library').addEventListener('click', () => { pickInto = 'queue'; $('#lib-input').click(); });
$$('[data-pick]').forEach((b) => b.addEventListener('click', () => {
  pickInto = 'draft';
  $(b.dataset.pick === 'cam' ? '#cam-input' : '#lib-input').click();
}));

async function onFiles(e) {
  const files = [...e.target.files];
  e.target.value = '';
  if (!files.length) return;
  if (pickInto === 'draft' && sheet.open && draft) {
    await loadPhoto(files[0]);
    return;
  }
  queue = files;
  queueIndex = 0;
  openSheet();
  await loadPhoto(queue[0]);
}
$('#cam-input').addEventListener('change', onFiles);
$('#lib-input').addEventListener('change', onFiles);

$('#f-cutout').addEventListener('change', (e) => {
  if (draft?.file) processInto(draft, draft.file, e.target.checked);
});

$('#item-form').addEventListener('click', (e) => {
  const t = e.target.closest('[data-main],[data-second],[data-cat],[data-pattern]');
  if (!t || !draft) return;
  if (t.dataset.main !== undefined) { draft.color = t.dataset.main; if (draft.color2 === draft.color) draft.color2 = null; autoName(); }
  if (t.dataset.second !== undefined) draft.color2 = t.dataset.second || null;
  if (t.dataset.cat) { draft.category = t.dataset.cat; applySubtype(SUBTYPES[draft.category][0][0]); }
  if (t.dataset.pattern) draft.pattern = t.dataset.pattern;
  renderSheet();
});
$('#item-form').addEventListener('input', (e) => {
  const c = e.target.dataset.custom;
  if (!c || !draft) return;
  if (c === 'main') { draft.color = e.target.value; autoName(); }
  else draft.color2 = e.target.value;
  $$('.sw-name')[c === 'main' ? 0 : 1].textContent = colorName(e.target.value);
});
$('#item-form').addEventListener('change', (e) => {
  if (e.target.dataset.custom) renderSheet();
});
$('#f-subtype').addEventListener('change', (e) => { applySubtype(e.target.value); renderSheet(); });
$('#f-name').addEventListener('input', (e) => { draft.name = e.target.value; draft.nameTouched = true; });
$('#f-styles').addEventListener('change', () => {
  draft.styles = $$('#f-styles input:checked').map((c) => c.value);
  draft.stylesTouched = true;
});
$('#f-warmth').addEventListener('input', (e) => { draft.warmth = +e.target.value; $('#o-warmth').textContent = WARMTH_TXT[draft.warmth]; });
$('#f-formality').addEventListener('input', (e) => { draft.formality = +e.target.value; $('#o-formality').textContent = FORMAL_TXT[draft.formality]; });
$('#f-waterproof').addEventListener('change', (e) => { draft.waterproof = e.target.checked; });
$$('[data-close]', sheet).forEach((b) => b.addEventListener('click', () => sheet.close()));
sheet.addEventListener('close', () => { queue = []; queueIndex = 0; draft = null; });

$('#item-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const d = draft;
  if (!d || d.busy) return;
  const isNew = !d.id;
  const id = d.id ?? uid();
  const item = {
    id,
    name: d.name.trim() || `${colorName(d.color)} ${d.subtype.toLowerCase()}`,
    category: d.category,
    subtype: d.subtype,
    color: d.color,
    color2: d.color2,
    pattern: d.pattern,
    styles: d.styles.length ? d.styles : defaultStyles(d.formality),
    warmth: d.warmth,
    formality: d.formality,
    waterproof: d.waterproof,
    hasPhoto: !!d.photo,
    cutout: !!d.photo?.cutout,
    addedAt: d.addedAt ?? Date.now(),
    lastWorn: d.lastWorn ?? null,
  };
  if (d.photo?.blob) await putPhoto(id, d.photo.blob);
  if (isNew) state.wardrobe.unshift(item);
  else Object.assign(state.wardrobe.find((i) => i.id === id), item);
  state.settings.lastCategory = d.category;
  persist();
  renderWardrobe();
  generate();

  if (isNew && queueIndex < queue.length - 1) {
    queueIndex++;
    draft = newDraft(d.category);
    sheet.scrollTop = 0;
    await loadPhoto(queue[queueIndex]);
  } else {
    sheet.close();
    toast(isNew ? `${item.name} är tillagd.` : 'Sparat.');
  }
});

$('#delete-item').addEventListener('click', async (e) => {
  if (!draft?.id) return;
  const btn = e.currentTarget;
  if (btn.dataset.armed !== '1') {
    btn.dataset.armed = '1';
    btn.textContent = 'Tryck igen för att ta bort';
    clearTimeout(btn.timer);
    btn.timer = setTimeout(() => { btn.dataset.armed = ''; btn.textContent = 'Ta bort'; }, 4000);
    return;
  }
  btn.dataset.armed = '';
  btn.textContent = 'Ta bort';
  const id = draft.id;
  state.wardrobe = state.wardrobe.filter((i) => i.id !== id);
  state.favorites = state.favorites.filter((f) => !f.itemIds.includes(id));
  locked.delete(id);
  await deletePhoto(id);
  persist();
  sheet.close();
  renderWardrobe();
  generate();
});

// ---------- Färg ----------
function renderColorLab() {
  const hex = $('#lab-color').value;
  const fam = colorFamily(hex);
  $('#lab-name').textContent = colorName(hex);
  $('#lab-kind').textContent = {
    neutral: 'En neutral. Den bär nästan vad som helst.',
    earth: 'En jordton som fungerar som neutral.',
    navy: 'Marinblått, en klassisk neutral.',
    denim: 'Denim, vardagens neutral.',
    chromatic: 'En kulör. Använd den som accent, eller låt den bära outfiten mot neutraler.',
  }[fam];
  $('#lab-suggest').innerHTML = suggestMatches(hex)
    .map((s) => `<div style="background:${s.hex};color:${textColorFor(s.hex)}"><small>${esc(s.label)}</small>${esc(colorName(s.hex))}</div>`)
    .join('');
  const matches = state.wardrobe
    .map((i) => ({ i, h: paletteHarmony([{ hex, weight: 0.5 }, { hex: i.color, weight: 0.5 }]) }))
    .filter((x) => x.h.score >= 0.8)
    .sort((a, b) => b.h.score - a.h.score)
    .slice(0, 12);
  $('#lab-matches').innerHTML = matches.length
    ? matches.map(({ i }) => `<div class="tile"><div class="tile-img">${visual(i)}</div><div class="tile-name">${esc(i.name)}</div></div>`).join('')
    : '<p class="lab-kind">Fota några plagg så visas de som passar här.</p>';
}
$('#lab-color').addEventListener('input', renderColorLab);

// ---------- Start ----------
(async () => {
  state = await init();
  renderStyleTabs();
  renderWardrobe();
  generate();
  await startWeather();
})();
