import { rpc, onChanged } from './rpc.js';
import { INTERVALS } from '../lib/constants.js';
import { formatPrice, stockLabel, timeAgo, timeUntil, changeText, displayName } from '../lib/format.js';
import { RANGES, DAY, seriesInRange, stats, priceChange, sinceAdded, changesOnly, extremes, assess, targetProgress } from '../lib/series.js';
import { sparkline, priceChart } from '../lib/chart.js';
import { setupAddForm } from './add.js';
import { setupSettings, renderSettings } from './settings.js';

const $ = (id) => document.getElementById(id);
const fmtDate = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtFull = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const fmtShort = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });

const state = {
  products: [],
  histories: new Map(),
  range: loadPref('range', '30'),
  sort: loadPref('sort', 'new'),
  filter: loadPref('filter', 'all'),
  view: loadPref('view', 'cards'),
  search: '',
  detailId: null,
  settingsOpen: false,
  unread: new Set(),
};

function loadPref(k, def) {
  try { return localStorage.getItem('pw-' + k) || def; } catch { return def; }
}
function savePref(k, v) {
  try { localStorage.setItem('pw-' + k, v); } catch { /* egal */ }
}

function h(tag, props, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children) if (c != null) e.append(c);
  return e;
}

function thumb(url, cls) {
  const placeholder = () => h('div', { class: `${cls} placeholder`, 'aria-hidden': 'true' });
  if (!url) return placeholder();
  const img = h('img', { class: cls, alt: '', loading: 'lazy', src: url });
  img.addEventListener('error', () => img.replaceWith(placeholder()));
  return img;
}

// ---------- Daten ----------

async function load() {
  state.products = await rpc.listProducts();
  state.unread = new Set(await rpc.getUnread());
  const hists = await Promise.all(state.products.map((p) => rpc.getHistory(p.id)));
  state.histories = new Map(state.products.map((p, i) => [p.id, hists[i]]));
}

function rangeFrom(key) {
  const r = RANGES.find(([k]) => k === key) || RANGES[1];
  return r[2] === Infinity ? -Infinity : Date.now() - r[2];
}

// ---------- Liste ----------

function sortProducts(list) {
  const arr = [...list];
  switch (state.sort) {
    case 'name': return arr.sort((a, b) => displayName(a).localeCompare(displayName(b), 'de'));
    case 'checked': return arr.sort((a, b) => (b.lastChecked || 0) - (a.lastChecked || 0));
    // Letzte Preisänderung zuerst; nie geänderte ans Ende (stabil: dort zuletzt hinzugefügt zuerst)
    case 'changed': return arr.sort((a, b) => (b.lastChange || 0) - (a.lastChange || 0));
    case 'drop': {
      const pct = (p) => (priceChange(p.currentPrice, p.previousPrice) || { pct: 0 }).pct;
      return arr.sort((a, b) => pct(a) - pct(b));
    }
    case 'since': {
      const pct = (p) => {
        const since = sinceAdded(p, state.histories.get(p.id));
        return since && since.change ? since.change.pct : 0;
      };
      return arr.sort((a, b) => pct(a) - pct(b));
    }
    default: return arr; // Speicherreihenfolge = zuletzt hinzugefügt zuerst
  }
}

// Schnellfilter über der Liste: [Schlüssel, Beschriftung, Bedingung]
const FILTERS = [
  ['all', 'Alle', () => true],
  ['target', 'Zielpreis erreicht', (p) => p.targetPrice != null && p.currentPrice != null && p.currentPrice <= p.targetPrice],
  ['error', 'Mit Problem', (p) => !!p.lastError],
  ['paused', 'Pausiert', (p) => !!p.paused],
  ['oos', 'Nicht lieferbar', (p) => p.stockStatus === 'out_of_stock'],
];

/** Farbige Pille mit der letzten Änderung in Prozent, z. B. „−8 %“. */
function changePill(p) {
  const change = priceChange(p.currentPrice, p.previousPrice);
  const ch = changeText(change, p.currency);
  if (!ch) return null;
  const pct = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1, signDisplay: 'always' }).format(change.pct).replace('-', '−');
  return h('span', { class: `pill ${ch.dir}`, title: `Letzte Änderung: ${ch.text}`, text: `${pct} %` });
}

function badge(p, hist) {
  const a = assess(p, hist);
  return a ? h('span', { class: `badge ${a.kind}`, text: a.text }) : null;
}

/** Balken vom Preis beim Hinzufügen bis zum Zielpreis. */
function goalBar(p, since) {
  const prog = targetProgress(p, since ? since.price : null);
  if (!prog) return null;
  const fill = h('i');
  fill.style.width = `${Math.round(prog.share * 100)}%`;
  return h('div', { class: 'goal', title: `Zielpreis ${formatPrice(p.targetPrice, p.currency)}` },
    h('div', { class: 'goal-bar' }, fill),
    h('div', { class: 'goal-text', text: `noch ${formatPrice(prog.missing, p.currency)} bis Ziel ${formatPrice(p.targetPrice, p.currency)}` }));
}

function openProduct(p) {
  return () => { location.hash = `#/p/${p.id}`; };
}

function productCard(p) {
  const hist = state.histories.get(p.id);
  const since = sinceAdded(p, hist);
  const sinceCh = since && changeText(since.change, p.currency);
  const meta = [p.shop, stockLabel(p.stockStatus), p.paused ? 'pausiert' : null].filter(Boolean).join(' · ');
  return h('button', { class: `card${state.unread.has(p.id) ? ' fresh' : ''}`, title: state.unread.has(p.id) ? 'Günstiger geworden' : null, type: 'button', onclick: openProduct(p) },
    thumb(p.imageUrl, 'thumb'),
    h('div', { class: 'body' },
      h('div', { class: 'name', text: displayName(p), title: displayName(p) }),
      h('div', { class: 'meta' },
        p.lastError ? h('span', { class: 'up', title: p.lastError, text: '⚠ ' }) : null,
        meta),
      p.note ? h('div', { class: 'note-line', title: p.note, text: `✎ ${p.note}` }) : null,
      h('div', { class: 'bottom' },
        h('div', { class: 'price-line' },
          h('span', { class: 'price', text: formatPrice(p.currentPrice, p.currency) }),
          changePill(p)),
        sparkline(hist, { from: Date.now() - 30 * DAY, width: 96, height: 32, label: 'Preisverlauf der letzten 30 Tage' })),
      badge(p, hist),
      goalBar(p, since),
      since
        ? h('div', { class: `change ${sinceCh ? sinceCh.dir : 'muted'}`, title: `Beim Hinzufügen: ${formatPrice(since.price, p.currency)}`, text: sinceCh ? `Seit Hinzufügen: ${sinceCh.text}` : 'Seit Hinzufügen unverändert' })
        : h('div', { class: 'change muted', text: `geprüft ${timeAgo(p.lastChecked)}` }),
    ));
}

/** Kompakte Zeile: alles Wichtige auf einer Höhe. */
function productRow(p) {
  const hist = state.histories.get(p.id);
  const since = sinceAdded(p, hist);
  const sinceCh = since && changeText(since.change, p.currency);
  const meta = [p.shop, p.stockStatus === 'out_of_stock' ? 'nicht lieferbar' : null, p.paused ? 'pausiert' : null].filter(Boolean).join(' · ');
  return h('button', { class: `card row${state.unread.has(p.id) ? ' fresh' : ''}`, type: 'button', onclick: openProduct(p) },
    thumb(p.imageUrl, 'thumb'),
    h('div', { class: 'body' },
      h('div', { class: 'name', text: displayName(p), title: displayName(p) }),
      h('div', { class: 'meta' },
        p.lastError ? h('span', { class: 'up', title: p.lastError, text: '⚠ ' }) : null,
        meta)),
    h('div', { class: 'row-badge' }, badge(p, hist)),
    h('div', { class: 'row-since' }, sinceCh ? h('span', { class: sinceCh.dir, title: 'Seit Hinzufügen', text: sinceCh.text }) : null),
    h('div', { class: 'row-price' },
      h('span', { class: 'price', text: formatPrice(p.currentPrice, p.currency) }),
      changePill(p)),
    sparkline(hist, { from: Date.now() - 30 * DAY, width: 72, height: 24, label: 'Preisverlauf der letzten 30 Tage' }));
}

function renderFilters() {
  const counts = new Map(FILTERS.map(([k, , fn]) => [k, state.products.filter(fn).length]));
  // Ein Filter ohne Treffer verschwindet; war er gewählt, gilt wieder „Alle“
  if (state.filter !== 'all' && !counts.get(state.filter)) state.filter = 'all';
  const chips = FILTERS.filter(([k]) => k === 'all' || counts.get(k) > 0).map(([k, label]) => h('button', {
    type: 'button', class: 'chip', 'aria-pressed': String(state.filter === k), 'data-filter': k,
    onclick: () => { state.filter = k; savePref('filter', k); renderList(); },
  }, label, h('span', { class: 'count', text: String(counts.get(k)) })));
  $('filters').replaceChildren(...chips);
  $('filters').hidden = chips.length < 2;
}

function renderList() {
  renderFilters();
  const q = state.search.trim().toLowerCase();
  const filterFn = (FILTERS.find(([k]) => k === state.filter) || FILTERS[0])[2];
  const list = sortProducts(state.products).filter(
    (p) => filterFn(p) && (!q || [displayName(p), p.name, p.shop, p.note].some((s) => (s || '').toLowerCase().includes(q))),
  );
  const compact = state.view === 'list';
  $('cards').className = compact ? 'cards compact' : 'cards';
  for (const b of document.querySelectorAll('#view button')) b.setAttribute('aria-pressed', String(b.dataset.view === state.view));
  $('cards').replaceChildren(...list.map(compact ? productRow : productCard));
  $('empty').hidden = state.products.length > 0;
  const errors = state.products.filter((p) => p.lastError).length;
  $('summary').textContent = state.products.length
    ? `${state.products.length} Produkt${state.products.length === 1 ? '' : 'e'}${errors ? ` · ${errors} mit Problem` : ''}`
    : '';
}

// ---------- Detail ----------

let formFor = null; // Produkt-ID, deren Werte gerade im Formular stehen

function renderDetail() {
  const p = state.products.find((x) => x.id === state.detailId);
  if (!p) { location.hash = ''; return; }
  const hist = state.histories.get(p.id) || [];
  document.title = `${displayName(p)} – Preiswächter`;

  const img = $('d-img');
  const head = document.querySelector('.detail-head');
  head.classList.toggle('noimg', !p.imageUrl);
  img.onerror = () => head.classList.add('noimg');
  if (p.imageUrl && img.getAttribute('src') !== p.imageUrl) img.src = p.imageUrl;
  $('d-name').textContent = displayName(p);
  $('d-origname').hidden = displayName(p) === p.name;
  $('d-origname').textContent = `Im Shop: ${p.name}`;
  $('d-note').hidden = !p.note;
  $('d-note').textContent = p.note || '';
  const meta = [
    p.shop,
    stockLabel(p.stockStatus),
    `geprüft ${timeAgo(p.lastChecked)}`,
    p.paused ? 'Prüfung pausiert' : `nächste Prüfung ${timeUntil(p.nextCheck)}`,
  ].filter(Boolean);
  $('d-meta').textContent = meta.join(' · ');
  $('d-price').textContent = formatPrice(p.currentPrice, p.currency);
  const ch = changeText(priceChange(p.currentPrice, p.previousPrice), p.currency);
  const since = sinceAdded(p, hist);
  // Gab es erst eine Änderung, sagt die Zeile „seit dem Hinzufügen“ dasselbe
  const sameAsSince = ch && since && since.change && ch.text === changeText(since.change, p.currency).text;
  $('d-change').textContent = ch && !sameAsSince ? `${ch.text} seit ${fmtFull.format(new Date(p.lastChange))}` : '';
  $('d-change').className = ch ? ch.dir : '';
  $('d-badge').replaceChildren(...[badge(p, hist)].filter(Boolean));
  $('d-since').hidden = !since;
  if (since) {
    const sinceCh = changeText(since.change, p.currency);
    const when = since.t ? ` am ${fmtDate.format(new Date(since.t))}` : '';
    $('d-since').replaceChildren(
      `Beim Hinzufügen${when}: `,
      h('strong', { text: formatPrice(since.price, p.currency) }),
      ' · ',
      sinceCh ? h('span', { class: sinceCh.dir, text: `seitdem ${sinceCh.text}` }) : 'seitdem unverändert',
    );
  }
  $('d-shop').onclick = () => rpc.openExternal(p.url);
  $('d-error').hidden = !p.lastError;
  $('d-error').textContent = p.lastError ? `⚠ Letzte Prüfung fehlgeschlagen: ${p.lastError}` : '';
  // Hilft, wenn der Shop ein Captcha oder eine Cookie-Abfrage zeigt
  $('d-window').hidden = !p.lastError;

  // Zeitraum-Knöpfe
  $('ranges').replaceChildren(...RANGES.map(([k, label]) => h('button', {
    type: 'button', 'aria-pressed': String(k === state.range), text: label,
    onclick: () => { state.range = k; savePref('range', k); renderDetail(); },
  })));

  const from = rangeFrom(state.range);
  const now = Date.now();
  const pts = seriesInRange(hist, from, now);
  const st = stats(pts, now);
  const ex = extremes(pts);
  const tile = (label, value, sub, subCls) => h('div', { class: 'tile' },
    h('div', { class: 'label', text: label }),
    h('div', { class: 'value', text: value }),
    sub ? h('div', { class: `sub${subCls ? ` ${subCls}` : ''}`, text: sub }) : null);
  const when = (e) => (e.current ? `aktuell, seit ${fmtShort.format(new Date(e.since))}` : `am ${fmtShort.format(new Date(e.since))}`);
  const moved = st && st.min !== st.max;
  let avgSub = null;
  let avgCls = null;
  if (moved && p.currentPrice != null) {
    const vs = priceChange(p.currentPrice, st.avg);
    if (!vs) avgSub = 'aktuell genau im Schnitt';
    else {
      avgSub = `aktuell ${String(Math.abs(vs.pct)).replace('.', ',')} % ${vs.diff < 0 ? 'darunter' : 'darüber'}`;
      avgCls = vs.diff < 0 ? 'down' : 'up';
    }
  }
  $('tiles').replaceChildren(
    tile('Tiefster Preis', st ? formatPrice(st.min, p.currency) : '–', moved ? when(ex.min) : null),
    tile('Höchster Preis', st ? formatPrice(st.max, p.currency) : '–', moved ? when(ex.max) : null),
    tile('Durchschnitt', st ? formatPrice(st.avg, p.currency) : '–', avgSub, avgCls),
    tile('Preisänderungen', st ? String(st.changes) : '–', st ? 'im Zeitraum' : null),
  );

  priceChart($('chart'), hist, {
    from, to: now, currency: p.currency, targetPrice: p.targetPrice, addedPrice: since ? since.price : null,
  });

  renderHistoryTable(p, hist);

  if (formFor !== p.id) fillForm(p);
}

// Tabelle: neueste zuerst; standardmäßig nur Änderungen von Preis oder Lagerstatus
function renderHistoryTable(p, hist) {
  const all = $('history-all').checked;
  const changes = changesOnly(hist);
  let list = changes;
  if (all) {
    const sorted = [...hist].sort((a, b) => a.t - b.t);
    list = sorted.map((x, i) => ({ ...x, change: i ? priceChange(x.price, sorted[i - 1].price) : null }));
  }
  const rows = [...list].reverse().map((x) => {
    const ch = changeText(x.change, p.currency);
    return h('tr', {},
      h('td', { text: fmtFull.format(new Date(x.t)) }),
      h('td', { text: formatPrice(x.price, p.currency) }),
      h('td', { class: ch ? ch.dir : 'muted', text: ch ? ch.text : '–' }),
      h('td', { text: stockLabel(x.stock) }));
  });
  $('history-rows').replaceChildren(...rows);
  const n = changes.length;
  $('history-note').textContent = all
    ? `${hist.length} Messpunkte`
    : `${n} ${n === 1 ? 'Eintrag' : 'Einträge'}, nur Änderungen von Preis oder Lagerstatus`;
}

$('history-all').addEventListener('change', () => {
  const p = state.products.find((x) => x.id === state.detailId);
  if (p) renderHistoryTable(p, state.histories.get(p.id) || []);
});

function fillForm(p) {
  formFor = p.id;
  const f = $('settings');
  const sel = $('s-interval');
  const opts = INTERVALS.map(([v, label]) => h('option', { value: v, text: label }));
  if (!INTERVALS.some(([v]) => v === p.intervalMin)) opts.push(h('option', { value: p.intervalMin, text: `${p.intervalMin} Minuten` }));
  sel.replaceChildren(...opts);
  sel.value = String(p.intervalMin);
  f.targetPrice.value = p.targetPrice != null ? String(p.targetPrice).replace('.', ',') : '';
  f.dropThreshold.value = p.dropThreshold != null ? String(p.dropThreshold).replace('.', ',') : '';
  f.notifyStock.checked = p.notifyStock !== false;
  f.paused.checked = !!p.paused;
  f.customName.value = p.customName || '';
  f.customName.placeholder = p.name;
  f.note.value = p.note || '';
  rpc.getSettings().then((st) => { $('notify-off').hidden = st.notifications !== false; });
  $('s-saved').hidden = true;
}

function parseNum(v) {
  const s = String(v || '').trim().replace(/\s|€|%/g, '');
  if (!s) return null;
  const n = parseFloat(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : NaN;
}

$('settings').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  // Erst prüfen, dann speichern – Fehler sofort am Feld anzeigen
  const targetPrice = parseNum(f.targetPrice.value);
  const dropThreshold = parseNum(f.dropThreshold.value);
  for (const [input, val] of [[f.targetPrice, targetPrice], [f.dropThreshold, dropThreshold]]) {
    input.setCustomValidity(Number.isNaN(val) ? 'Bitte eine Zahl größer 0 eingeben, z. B. 199,99' : '');
  }
  if (!f.reportValidity()) return;
  const p = await rpc.getProduct(state.detailId);
  if (!p) return;
  const intervalMin = Number(f.intervalMin.value);
  const paused = f.paused.checked;
  const base = p.lastChecked || Date.now();
  let nextCheck = p.nextCheck;
  if (intervalMin !== p.intervalMin || (p.paused && !paused)) nextCheck = Math.max(Date.now() + 30 * 1000, base + intervalMin * 60 * 1000);
  await rpc.updateProduct(p.id, {
    intervalMin, targetPrice, dropThreshold, notifyStock: f.notifyStock.checked, paused, nextCheck,
    customName: f.customName.value, note: f.note.value,
  });
  formFor = null; // Formular nach dem Speichern neu füllen
  $('s-saved').hidden = false;
  setTimeout(() => { $('s-saved').hidden = true; }, 2500);
});

$('d-csv').addEventListener('click', async () => {
  const out = $('d-csv-result');
  try {
    const file = await rpc.exportCsv(state.detailId);
    out.hidden = !file;
    out.textContent = file ? `Gespeichert: ${file}` : '';
  } catch (err) {
    out.hidden = false;
    out.textContent = `Speichern fehlgeschlagen: ${err.message || err}`;
  }
});

$('d-check').addEventListener('click', async () => {
  const btn = $('d-check');
  btn.disabled = true;
  btn.textContent = 'Wird geprüft …';
  try {
    await rpc.checkNow(state.detailId);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Jetzt prüfen';
    await refresh();
  }
});

$('d-window').addEventListener('click', async () => {
  const btn = $('d-window');
  btn.disabled = true;
  btn.textContent = 'Fenster schließen, wenn das Produkt zu sehen ist';
  try {
    await rpc.checkInWindow(state.detailId);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Im Fenster öffnen';
    await refresh();
  }
});

$('d-delete').addEventListener('click', async () => {
  const btn = $('d-delete');
  if (!btn.dataset.armed) {
    btn.dataset.armed = '1';
    btn.textContent = 'Wirklich löschen? Nochmal klicken';
    setTimeout(() => { delete btn.dataset.armed; btn.textContent = 'Produkt nicht mehr verfolgen'; }, 4000);
    return;
  }
  delete btn.dataset.armed;
  btn.textContent = 'Produkt nicht mehr verfolgen';
  await rpc.deleteProduct(state.detailId);
  location.hash = '';
});

// ---------- Navigation ----------

function route() {
  const m = /^#\/p\/([\w-]+)$/.exec(location.hash);
  state.detailId = m ? m[1] : null;
  state.settingsOpen = location.hash === '#/einstellungen';
  $('list-view').hidden = !!state.detailId || state.settingsOpen;
  $('detail-view').hidden = !state.detailId;
  $('settings-view').hidden = !state.settingsOpen;
  formFor = null;
  $('d-csv-result').hidden = true;
  if (state.detailId) {
    rpc.markRead(state.detailId);
    renderDetail();
  } else if (state.settingsOpen) {
    document.title = 'Einstellungen – Preiswächter';
    renderSettings();
  } else {
    document.title = 'Preiswächter';
    renderList();
  }
  window.scrollTo(0, 0);
}

async function refresh() {
  await load();
  if (state.detailId) renderDetail();
  else if (!state.settingsOpen) renderList();
  renderUpdateBanner();
}

async function renderUpdateBanner() {
  const info = await rpc.appInfo();
  $('app-version').textContent = `v${info.version}`;
  $('app-version').onclick = () => rpc.openReleaseNotes(info.version);
  $('update-badge').hidden = !info.updateAvailable;
  $('update-badge').textContent = `Update verfügbar: v${info.latestVersion}`;
  $('update-badge').onclick = () => rpc.openReleaseNotes(info.latestVersion);
  $('updated-banner').hidden = !info.updatedTo;
  $('updated-version').textContent = info.updatedTo || '';
  $('updated-notes').onclick = () => rpc.openReleaseNotes(info.updatedTo);
  $('updated-ok').onclick = async () => {
    await rpc.dismissUpdated();
    renderUpdateBanner();
  };
}

$('search').addEventListener('input', (e) => { state.search = e.target.value; renderList(); });
$('sort').value = state.sort;
$('sort').addEventListener('change', (e) => { state.sort = e.target.value; savePref('sort', state.sort); renderList(); });
for (const b of document.querySelectorAll('#view button')) {
  b.addEventListener('click', () => { state.view = b.dataset.view; savePref('view', state.view); renderList(); });
}
window.addEventListener('hashchange', route);

// Prüfungen im Hintergrund sofort anzeigen
let pending = null;
onChanged(() => {
  clearTimeout(pending);
  pending = setTimeout(refresh, 250);
});

// Zeitangaben ("vor 3 Min.") aktuell halten
setInterval(() => {
  if (document.hidden || state.settingsOpen) return;
  (state.detailId ? renderDetail : renderList)();
}, 60 * 1000);

window.pw.onOpenProduct((id) => { location.hash = `#/p/${id}`; });

// Knopf oben: direkt zwischen Hell und Mitternacht wechseln
// (Gespeichertes Design statt nur matchMedia-Ereignis: das kommt nicht in jedem Fenster an.)
const darkQuery = matchMedia('(prefers-color-scheme: dark)');
let currentTheme = 'system';
const isDarkNow = () => currentTheme === 'dark' || (currentTheme !== 'light' && darkQuery.matches);
function renderThemeToggle() {
  const btn = $('theme-toggle');
  const dark = isDarkNow();
  btn.textContent = dark ? '☀ Hell' : '☾ Mitternacht';
  btn.title = dark ? 'Zum hellen Design wechseln' : 'Zum Design Mitternacht wechseln';
}
darkQuery.addEventListener('change', renderThemeToggle);
renderThemeToggle();
rpc.getSettings().then((s) => { currentTheme = s.theme; renderThemeToggle(); });
$('o-theme').addEventListener('change', (e) => { currentTheme = e.target.value; renderThemeToggle(); });
$('theme-toggle').addEventListener('click', async () => {
  currentTheme = isDarkNow() ? 'light' : 'dark';
  renderThemeToggle();
  $('o-theme').value = currentTheme; // Auswahl in den Einstellungen mitziehen
  await rpc.saveSettings({ theme: currentTheme });
});

$('check-all').addEventListener('click', async () => {
  const btn = $('check-all');
  btn.disabled = true;
  btn.textContent = 'Wird geprüft …';
  try {
    await rpc.checkAll();
  } finally {
    btn.disabled = false;
    btn.textContent = 'Alle jetzt prüfen';
    await refresh();
  }
});

setupAddForm();
setupSettings();
await load();
route();
renderUpdateBanner();
