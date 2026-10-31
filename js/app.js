import { CATEGORIES, SUBTYPES, STYLES, PATTERNS } from './catalog.js';
import { colorName, textColorFor, suggestMatches, paletteHarmony, colorFamily } from './color.js';
import { generateOutfits, scoreOutfit } from './outfits.js';
import { fetchWeather, geocode, describeCode, conditionsFrom, LEVEL_LABELS } from './weather.js';
import { load, save, uid, exportJson, importJson } from './storage.js';
import { loadImage, resizeToDataUrl, extractColors } from './image.js';
import { demoWardrobe } from './demo.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let state = load();
let conditions = null;
let weatherStatus = 'idle'; // idle | loading | ok | error | manual
let weatherError = '';
let outfits = [];
const locked = new Set();
let categoryFilter = '';

const persist = () => save(state);

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 2400);
}

// ---------- Ikoner ----------
const SHAPES = {
  top: 'M22 10l-12 6 4 11 6-2v29h24V25l6 2 4-11-12-6c-1 4-5 6-10 6s-9-2-10-6z',
  bottom: 'M18 8h28l3 48h-11l-6-32-6 32H15z',
  dress: 'M25 6h14l-2 10 9 40H18l9-40z',
  outerwear: 'M22 8l-12 6 3 38h11V24l8 10 8-10v28h11l3-38-12-6-10 14z',
  shoes: 'M8 34c0-6 4-10 8-10 3 0 5 3 9 5 6 3 14 4 22 5 6 1 9 4 9 8v4H8z',
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

function garmentSvg(item) {
  const id = `p${item.id}`;
  const shape = ACCESSORY_SHAPES[item.subtype] ?? SHAPES[item.category] ?? SHAPES.top;
  let fill = item.color;
  let defs = '';
  if (item.color2) {
    const bold = item.pattern === 'bold';
    defs = `<defs><pattern id="${id}" width="${bold ? 12 : 8}" height="${bold ? 12 : 8}" patternUnits="userSpaceOnUse">
      <rect width="12" height="12" fill="${item.color}"/>
      ${bold ? `<circle cx="6" cy="6" r="2.6" fill="${item.color2}"/>` : `<rect y="5" width="8" height="2" fill="${item.color2}"/>`}
    </pattern></defs>`;
    fill = `url(#${id})`;
  }
  const stroke = colorFamily(item.color) === 'neutral' && textColorFor(item.color) === '#1a1a1a' ? 'rgba(0,0,0,.25)' : 'rgba(0,0,0,.15)';
  return `<svg viewBox="0 0 64 64" class="garment" aria-hidden="true">${defs}<path d="${shape}" fill="${fill}" stroke="${stroke}" stroke-width="1.2" stroke-linejoin="round"/></svg>`;
}

function itemVisual(item) {
  return item.photo
    ? `<img src="${item.photo}" alt="" loading="lazy" />`
    : garmentSvg(item);
}

// ---------- Navigering ----------
function showView(name) {
  $$('.tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.view === name)));
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${name}`));
  if (name === 'wardrobe') renderWardrobe();
  if (name === 'favorites') renderFavorites();
  if (name === 'colors') renderColorLab();
  window.scrollTo({ top: 0 });
}
$$('.tabs button').forEach((b) => b.addEventListener('click', () => showView(b.dataset.view)));

// ---------- Väder ----------
async function refreshWeather() {
  const s = state.settings;
  if (s.manual) {
    conditions = conditionsFrom({ temp: s.manual.temp, feelsLike: s.manual.temp, code: s.manual.rain ? 63 : s.manual.sunny ? 0 : 2 });
    weatherStatus = 'manual';
    renderWeather();
    return;
  }
  if (!s.location) {
    weatherStatus = 'idle';
    conditions = null;
    renderWeather();
    return;
  }
  weatherStatus = 'loading';
  renderWeather();
  try {
    conditions = await fetchWeather(s.location.lat, s.location.lon, s.day ?? 0);
    weatherStatus = 'ok';
  } catch (e) {
    weatherStatus = 'error';
    weatherError = e.message;
    conditions = null;
  }
  renderWeather();
}

function renderWeather() {
  const el = $('#weather');
  const s = state.settings;
  const dayToggle = `<div class="seg" role="group" aria-label="Dag">
      <button data-day="0" aria-pressed="${!s.day}">Idag</button>
      <button data-day="1" aria-pressed="${s.day === 1}">Imorgon</button></div>`;
  const locForm = `<form class="loc-form" id="loc-form">
      <input type="search" name="q" placeholder="Sök stad, t.ex. Göteborg" aria-label="Stad" />
      <button class="btn small">Sök</button>
      <button type="button" class="btn small ghost" id="geo">📍 Min plats</button>
      <button type="button" class="btn small ghost" id="manual">Ställ in själv</button></form>`;

  if (weatherStatus === 'idle') {
    el.innerHTML = `<div class="w-empty"><h2>Vad blir det för väder?</h2><p>Välj plats så anpassas outfitsen efter temperatur, regn och vind.</p>${locForm}</div>`;
  } else if (weatherStatus === 'loading') {
    el.innerHTML = `<div class="w-empty"><p>Hämtar väder…</p></div>`;
  } else if (weatherStatus === 'error') {
    el.innerHTML = `<div class="w-empty"><p class="warn">${esc(weatherError)}</p>${locForm}</div>`;
  } else {
    const c = conditions;
    const [desc, icon] = describeCode(c.code);
    const manual = weatherStatus === 'manual';
    el.innerHTML = `
      <div class="w-main">
        <div class="w-icon" aria-hidden="true">${icon}</div>
        <div>
          <div class="w-temp">${c.temp}°<small> känns som ${c.feelsLike}°</small></div>
          <div class="w-desc">${esc(manual ? 'Manuellt väder' : desc)} · ${esc(manual ? '' : s.location?.name ?? '')}</div>
          <div class="w-tags">
            ${c.rain ? '<span class="tag">☔ Regn ' + (c.precipProb ? c.precipProb + '%' : '') + '</span>' : ''}
            ${c.snow ? '<span class="tag">❄️ Snö</span>' : ''}
            ${c.wind >= 8 ? `<span class="tag">💨 ${c.wind} m/s</span>` : ''}
            <span class="tag level l${c.level}">${LEVEL_LABELS[c.level]}</span>
          </div>
        </div>
      </div>
      <div class="w-side">
        ${manual ? `<div class="manual">
            <label>Temperatur <output>${s.manual.temp}°</output><input type="range" min="-20" max="35" value="${s.manual.temp}" id="m-temp" /></label>
            <label class="inline"><input type="checkbox" id="m-rain" ${s.manual.rain ? 'checked' : ''}/> Regn</label>
            <label class="inline"><input type="checkbox" id="m-sun" ${s.manual.sunny ? 'checked' : ''}/> Sol</label>
          </div>` : dayToggle}
        <button class="link" id="change-loc">Byt plats</button>
      </div>`;
  }
  bindWeatherEvents();
}

function bindWeatherEvents() {
  $('#loc-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = new FormData(e.target).get('q').trim();
    if (!q) return;
    try {
      state.settings.location = await geocode(q);
      state.settings.manual = null;
      persist();
      await refreshWeather();
      autoGenerate();
    } catch (err) {
      weatherStatus = 'error';
      weatherError = err.message;
      renderWeather();
    }
  });
  $('#geo')?.addEventListener('click', () => {
    if (!navigator.geolocation) return toast('Platstjänster stöds inte');
    navigator.geolocation.getCurrentPosition(async (pos) => {
      state.settings.location = { lat: pos.coords.latitude, lon: pos.coords.longitude, name: 'Min plats' };
      state.settings.manual = null;
      persist();
      await refreshWeather();
      autoGenerate();
    }, () => toast('Kunde inte hämta din plats'));
  });
  $('#manual')?.addEventListener('click', () => {
    state.settings.manual = { temp: 15, rain: false, sunny: false };
    persist();
    refreshWeather().then(autoGenerate);
  });
  $('#change-loc')?.addEventListener('click', () => {
    state.settings.location = null;
    state.settings.manual = null;
    persist();
    refreshWeather();
  });
  $$('#weather [data-day]').forEach((b) => b.addEventListener('click', async () => {
    state.settings.day = +b.dataset.day;
    persist();
    await refreshWeather();
    autoGenerate();
  }));
  const mt = $('#m-temp');
  if (mt) {
    mt.addEventListener('input', () => { mt.previousElementSibling.textContent = `${mt.value}°`; });
    mt.addEventListener('change', () => { state.settings.manual.temp = +mt.value; persist(); refreshWeather().then(autoGenerate); });
    $('#m-rain').addEventListener('change', (e) => { state.settings.manual.rain = e.target.checked; persist(); refreshWeather().then(autoGenerate); });
    $('#m-sun').addEventListener('change', (e) => { state.settings.manual.sunny = e.target.checked; persist(); refreshWeather().then(autoGenerate); });
  }
}

// ---------- Outfits ----------
function renderStyleChips() {
  const cur = state.settings.style || '';
  const chips = [['', 'Alla stilar'], ...Object.entries(STYLES).map(([k, v]) => [k, v.label])];
  $('#style-chips').innerHTML = chips
    .map(([k, l]) => `<button class="chip" data-style="${k}" aria-pressed="${cur === k}">${esc(l)}</button>`)
    .join('');
}
$('#style-chips').addEventListener('click', (e) => {
  const b = e.target.closest('[data-style]');
  if (!b) return;
  state.settings.style = b.dataset.style;
  persist();
  renderStyleChips();
  generate();
});

function generate() {
  const w = state.wardrobe;
  const hasBase = (w.some((i) => i.category === 'top') && w.some((i) => i.category === 'bottom')) || w.some((i) => i.category === 'dress');
  if (!hasBase) {
    outfits = [];
    $('#outfits').innerHTML = `<div class="empty card">
      <h3>Din garderob behöver lite fler plagg</h3>
      <p>Lägg till minst en överdel och en underdel (eller en klänning) – gärna skor och en jacka också.</p>
      <div class="row"><button class="btn primary" data-go="wardrobe">Lägg till plagg</button>
      <button class="btn ghost" data-demo>Testa med exempelgarderob</button></div></div>`;
    $('#lock-hint').hidden = true;
    return;
  }
  for (const id of [...locked]) if (!w.some((i) => i.id === id)) locked.delete(id);
  outfits = generateOutfits(w, { conditions, style: state.settings.style || null, count: 6, locked: [...locked] });
  renderOutfits();
}

function autoGenerate() {
  if (state.wardrobe.length) generate();
}

function outfitCard(o, { saved = false } = {}) {
  const pct = Math.round(o.total * 100);
  const palette = [...new Set(o.items.flatMap((i) => [i.color, i.color2].filter(Boolean)))];
  const isFav = state.favorites.some((f) => f.key === o.id);
  return `<article class="outfit card" data-id="${esc(o.id)}">
    <div class="outfit-top">
      <span class="badge">${esc(o.harmony)}</span>
      <span class="score" style="--p:${pct}" title="Matchningspoäng">${pct}</span>
    </div>
    <div class="flatlay n${o.items.length}">
      ${o.items.map((i) => `<button class="piece ${locked.has(i.id) ? 'locked' : ''}" data-item="${esc(i.id)}" title="${esc(i.name)}" ${saved ? 'disabled' : ''}>
        ${itemVisual(i)}<span class="piece-name">${esc(i.name)}</span>${locked.has(i.id) ? '<span class="lock">🔒</span>' : ''}</button>`).join('')}
    </div>
    <div class="palette">${palette.map((c) => `<span style="background:${c}" title="${esc(colorName(c))}"></span>`).join('')}</div>
    <ul class="notes">
      ${o.notes.slice(0, 3).map((n) => `<li>${esc(n)}</li>`).join('')}
      ${o.warnings.map((n) => `<li class="warn">${esc(n)}</li>`).join('')}
    </ul>
    <div class="meters">
      ${meter('Färg', o.parts.color)}${meter('Stil', o.parts.style)}${conditions ? meter('Väder', o.parts.weather) : ''}
    </div>
    <div class="outfit-actions">
      ${saved
        ? `<button class="btn small ghost" data-unfav="${esc(o.id)}">Ta bort</button>`
        : `<button class="btn small ghost" data-fav="${esc(o.id)}">${isFav ? '♥ Sparad' : '♡ Spara'}</button>`}
      <button class="btn small" data-wear="${esc(o.id)}">✓ Har på mig idag</button>
    </div>
  </article>`;
}

function meter(label, v) {
  return `<div class="meter"><span>${label}</span><i style="--v:${Math.round(v * 100)}%"></i></div>`;
}

function renderOutfits() {
  const el = $('#outfits');
  if (!outfits.length) {
    el.innerHTML = '<div class="empty card"><p>Hittade inga kombinationer. Prova en annan stil eller lås upp plagg.</p></div>';
    return;
  }
  el.innerHTML = outfits.map((o) => outfitCard(o)).join('');
  $('#lock-hint').hidden = false;
  $('#generate').textContent = 'Nya förslag';
}

$('#generate').addEventListener('click', generate);

document.addEventListener('click', (e) => {
  const go = e.target.closest('[data-go]');
  if (go) { showView(go.dataset.go); if (go.dataset.go === 'wardrobe') openEditor(); return; }
  if (e.target.closest('[data-demo]')) { loadDemo(); return; }

  const piece = e.target.closest('#outfits .piece');
  if (piece) {
    const id = piece.dataset.item;
    if (locked.has(id)) locked.delete(id); else locked.add(id);
    toast(locked.has(id) ? 'Låst – nya förslag byggs kring plagget' : 'Upplåst');
    generate();
    return;
  }
  const fav = e.target.closest('[data-fav]');
  if (fav) {
    const o = outfits.find((x) => x.id === fav.dataset.fav);
    if (!o) return;
    if (state.favorites.some((f) => f.key === o.id)) {
      state.favorites = state.favorites.filter((f) => f.key !== o.id);
      fav.textContent = '♡ Spara';
    } else {
      state.favorites.unshift({ key: o.id, itemIds: o.items.map((i) => i.id), savedAt: Date.now() });
      fav.textContent = '♥ Sparad';
      toast('Outfit sparad');
    }
    persist();
    return;
  }
  const unfav = e.target.closest('[data-unfav]');
  if (unfav) {
    state.favorites = state.favorites.filter((f) => f.key !== unfav.dataset.unfav);
    persist();
    renderFavorites();
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
    toast('Snyggt! Plaggen prioriteras ned några dagar för variation.');
  }
});

// ---------- Sparade ----------
function renderFavorites() {
  const el = $('#favorites');
  const list = state.favorites
    .map((f) => {
      const items = f.itemIds.map((id) => state.wardrobe.find((i) => i.id === id)).filter(Boolean);
      if (!items.length) return null;
      return { id: f.key, items, ...scoreOutfit(items, { conditions: null, style: null }) };
    })
    .filter(Boolean);
  el.innerHTML = list.length
    ? list.map((o) => outfitCard(o, { saved: true })).join('')
    : '<div class="empty card"><p>Inga sparade outfits ännu. Tryck ♡ på ett förslag du gillar.</p></div>';
}

// ---------- Garderob ----------
function renderCategoryChips() {
  const counts = {};
  for (const i of state.wardrobe) counts[i.category] = (counts[i.category] || 0) + 1;
  const chips = [['', 'Alla', state.wardrobe.length], ...Object.entries(CATEGORIES).map(([k, v]) => [k, v.label, counts[k] || 0])];
  $('#category-chips').innerHTML = chips
    .map(([k, l, n]) => `<button class="chip" data-cat="${k}" aria-pressed="${categoryFilter === k}">${esc(l)} <small>${n}</small></button>`)
    .join('');
}
$('#category-chips').addEventListener('click', (e) => {
  const b = e.target.closest('[data-cat]');
  if (!b) return;
  categoryFilter = b.dataset.cat;
  renderWardrobe();
});

function renderWardrobe() {
  renderCategoryChips();
  $('#wardrobe-count').textContent = `${state.wardrobe.length} plagg`;
  const items = state.wardrobe.filter((i) => !categoryFilter || i.category === categoryFilter);
  $('#wardrobe-grid').innerHTML = items.length
    ? items.map((i) => `<button class="item card" data-edit="${esc(i.id)}">
        <div class="item-visual">${itemVisual(i)}</div>
        <div class="item-info">
          <strong>${esc(i.name)}</strong>
          <span class="dots"><i style="background:${i.color}"></i>${i.color2 ? `<i style="background:${i.color2}"></i>` : ''} ${esc(colorName(i.color))}</span>
          <small>${esc(i.styles.map((s) => STYLES[s]?.label).filter(Boolean).join(' · '))}</small>
        </div></button>`).join('')
    : `<div class="empty card"><p>${state.wardrobe.length ? 'Inga plagg i den här kategorin.' : 'Garderoben är tom. Fota ditt första plagg!'}</p></div>`;
}
$('#wardrobe-grid').addEventListener('click', (e) => {
  const b = e.target.closest('[data-edit]');
  if (b) openEditor(state.wardrobe.find((i) => i.id === b.dataset.edit));
});

function loadDemo() {
  const existing = new Set(state.wardrobe.map((i) => i.id));
  const add = demoWardrobe().filter((i) => !existing.has(i.id));
  state.wardrobe.push(...add);
  persist();
  toast(`${add.length} exempelplagg tillagda`);
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
    persist();
    toast('Backup importerad');
    renderWardrobe();
    renderStyleChips();
    refreshWeather().then(autoGenerate);
  } catch (err) {
    toast(err.message);
  }
  e.target.value = '';
});

// ---------- Plagg-editor ----------
const dlg = $('#item-dialog');
const form = $('#item-form');
let editing = null;
let photoData = null;
let nameTouched = false;

$('#f-category').innerHTML = Object.entries(CATEGORIES).map(([k, v]) => `<option value="${k}">${v.icon} ${esc(v.label)}</option>`).join('');
$('#f-pattern').innerHTML = Object.entries(PATTERNS).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('');
$('#f-styles').innerHTML = Object.entries(STYLES).map(([k, v]) => `<label class="chip check"><input type="checkbox" value="${k}" /> ${esc(v.label)}</label>`).join('');

const WARMTH_TXT = ['–', 'Mycket tunn', 'Tunn', 'Medel', 'Varm', 'Mycket varm'];
const FORMAL_TXT = ['', 'Avslappnad', 'Vardag', 'Snygg vardag', 'Uppklädd', 'Formell'];

function fillSubtypes(cat, selected) {
  $('#f-subtype').innerHTML = SUBTYPES[cat].map(([n]) => `<option ${n === selected ? 'selected' : ''}>${esc(n)}</option>`).join('');
}

function applySubtypeDefaults() {
  const cat = $('#f-category').value;
  const st = SUBTYPES[cat].find(([n]) => n === $('#f-subtype').value);
  if (!st) return;
  $('#f-warmth').value = st[1];
  $('#f-formality').value = st[2];
  $('#f-waterproof').checked = ['Regnjacka', 'Gummistövlar', 'Parkas', 'Dunjacka', 'Trenchcoat'].includes(st[0]);
  updateOutputs();
  autoName();
}

function updateOutputs() {
  $('#o-warmth').textContent = WARMTH_TXT[$('#f-warmth').value];
  $('#o-formality').textContent = FORMAL_TXT[$('#f-formality').value];
  $('#f-color-name').textContent = colorName($('#f-color').value);
}

function autoName() {
  if (nameTouched) return;
  const st = $('#f-subtype').value;
  $('#f-name').value = `${colorName($('#f-color').value)} ${st.toLowerCase()}`;
}

$('#f-category').addEventListener('change', () => { fillSubtypes($('#f-category').value); applySubtypeDefaults(); });
$('#f-subtype').addEventListener('change', applySubtypeDefaults);
$('#f-warmth').addEventListener('input', updateOutputs);
$('#f-formality').addEventListener('input', updateOutputs);
$('#f-color').addEventListener('input', () => { updateOutputs(); autoName(); });
$('#f-color2').addEventListener('input', () => { $('#f-has-color2').checked = true; });
$('#f-name').addEventListener('input', () => { nameTouched = true; });
$$('[data-close]', dlg).forEach((b) => b.addEventListener('click', () => dlg.close()));

function setPhoto(dataUrl) {
  photoData = dataUrl;
  $('#photo-preview').src = dataUrl || '';
  $('#photo-preview').hidden = !dataUrl;
  $('#photo-placeholder').hidden = !!dataUrl;
}

$('#photo-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const img = await loadImage(file);
    setPhoto(resizeToDataUrl(img));
    const colors = extractColors(img, 4);
    const row = $('#extracted');
    row.innerHTML = colors.map((c, i) => `<button type="button" class="swatch" data-hex="${c.hex}" style="background:${c.hex};color:${textColorFor(c.hex)}" title="${esc(colorName(c.hex))}">
      ${esc(colorName(c.hex))}<small>${Math.round(c.share * 100)}%</small>${i === 0 ? '<b>huvud</b>' : ''}</button>`).join('');
    row.hidden = !colors.length;
    $('#extracted-hint').hidden = colors.length < 2;
    if (colors[0]) $('#f-color').value = colors[0].hex;
    // Om en andra färg tar stor plats är plagget troligen mönstrat/flerfärgat.
    if (colors[1] && colors[1].share > 0.15) {
      $('#f-color2').value = colors[1].hex;
      $('#f-has-color2').checked = true;
    } else {
      $('#f-has-color2').checked = false;
    }
    updateOutputs();
    autoName();
  } catch (err) {
    toast(err.message);
  }
});

$('#extracted').addEventListener('click', (e) => {
  const s = e.target.closest('[data-hex]');
  if (!s) return;
  $('#f-color').value = s.dataset.hex;
  updateOutputs();
  autoName();
});
$('#extracted').addEventListener('contextmenu', (e) => {
  const s = e.target.closest('[data-hex]');
  if (!s) return;
  e.preventDefault();
  $('#f-color2').value = s.dataset.hex;
  $('#f-has-color2').checked = true;
  toast(`Andrafärg: ${colorName(s.dataset.hex)}`);
});

function openEditor(item = null) {
  editing = item;
  nameTouched = !!item;
  form.reset();
  $('#extracted').hidden = true;
  $('#extracted-hint').hidden = true;
  $('#item-dialog-title').textContent = item ? 'Redigera plagg' : 'Nytt plagg';
  $('#delete-item').hidden = !item;
  const cat = item?.category ?? (categoryFilter || 'top');
  $('#f-category').value = cat;
  fillSubtypes(cat, item?.subtype);
  if (item) {
    $('#f-name').value = item.name;
    $('#f-color').value = item.color;
    $('#f-has-color2').checked = !!item.color2;
    $('#f-color2').value = item.color2 || '#ffffff';
    $('#f-pattern').value = item.pattern || 'solid';
    $$('#f-styles input').forEach((c) => { c.checked = item.styles.includes(c.value); });
    $('#f-warmth').value = item.warmth;
    $('#f-formality').value = item.formality;
    $('#f-waterproof').checked = !!item.waterproof;
    setPhoto(item.photo);
    updateOutputs();
  } else {
    setPhoto(null);
    applySubtypeDefaults();
  }
  dlg.showModal();
}
$('#add-item').addEventListener('click', () => openEditor());

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const styles = $$('#f-styles input:checked').map((c) => c.value);
  const data = {
    name: $('#f-name').value.trim() || `${colorName($('#f-color').value)} ${$('#f-subtype').value.toLowerCase()}`,
    category: $('#f-category').value,
    subtype: $('#f-subtype').value,
    color: $('#f-color').value,
    color2: $('#f-has-color2').checked ? $('#f-color2').value : null,
    pattern: $('#f-pattern').value,
    styles: styles.length ? styles : ['casual'],
    warmth: +$('#f-warmth').value,
    formality: +$('#f-formality').value,
    waterproof: $('#f-waterproof').checked,
    photo: photoData,
  };
  if (editing) Object.assign(editing, data);
  else state.wardrobe.push({ id: uid(), addedAt: Date.now(), ...data });
  if (persist()) {
    dlg.close();
    toast(editing ? 'Plagget uppdaterat' : 'Plagget tillagt');
    renderWardrobe();
  }
});

$('#delete-item').addEventListener('click', () => {
  if (!editing || !confirm(`Ta bort "${editing.name}"?`)) return;
  state.wardrobe = state.wardrobe.filter((i) => i !== editing);
  locked.delete(editing.id);
  persist();
  dlg.close();
  renderWardrobe();
});

// ---------- Färglära ----------
function renderColorLab() {
  const hex = $('#lab-color').value;
  const fam = colorFamily(hex);
  const famTxt = { neutral: 'neutral – passar med nästan allt', earth: 'jordton – fungerar som neutral', navy: 'marinblå – en klassisk neutral', denim: 'denim – en vardagsneutral', chromatic: 'kulör – använd som accent eller huvudfärg' }[fam];
  $('#lab-name').innerHTML = `<strong>${esc(colorName(hex))}</strong> · ${esc(famTxt)}`;
  $('#lab-suggest').innerHTML = suggestMatches(hex)
    .map((s) => `<span class="swatch" style="background:${s.hex};color:${textColorFor(s.hex)}">${esc(s.label)}<small>${esc(colorName(s.hex))}</small></span>`)
    .join('');
  const matches = state.wardrobe
    .map((i) => ({ i, h: paletteHarmony([{ hex, weight: 0.5 }, { hex: i.color, weight: 0.5 }]) }))
    .filter((x) => x.h.score >= 0.8)
    .sort((a, b) => b.h.score - a.h.score)
    .slice(0, 12);
  $('#lab-matches').innerHTML = matches.length
    ? matches.map(({ i, h }) => `<div class="mini" title="${esc(h.label)}">${itemVisual(i)}<span>${esc(i.name)}</span></div>`).join('')
    : '<p class="hint">Lägg till plagg för att se matchningar.</p>';
}
$('#lab-color').addEventListener('input', renderColorLab);

// ---------- Start ----------
renderStyleChips();
renderWeather();
refreshWeather().then(generate); // visar tomt läge med instruktioner om garderoben är tom
