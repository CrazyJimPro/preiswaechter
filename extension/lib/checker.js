// Preisprüfung: Produktseite laden, Preis auslesen, Produkt + Verlauf aktualisieren.
//
// Weg 1: fetch() im Hintergrund, HTML parsen
//        (Firefox: DOMParser direkt, Chrome: im Offscreen-Dokument – Service Worker haben kein DOM)
// Weg 2: findet Weg 1 nichts (JS-lastige Seite, Captcha), Seite kurz in einem
//        Hintergrund-Tab öffnen und dort auslesen (abschaltbar).
// Weg 3: Öffnet der User ein verfolgtes Produkt ohnehin, wird der Preis mitgenommen.
import './priceParser.js';
import './extract.js';
import { api } from './api.js';
import { getProduct, saveProduct, listProducts, appendHistory, getSettings } from './storage.js';
import { pickPrice, nextCheckTime, retryTime, charsetFromContentType, charsetFromHtmlHead } from './pick.js';

const NS = globalThis.Preiswaechter;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Wer über Preisänderungen informiert werden will (Benachrichtigungen in M4)
const listeners = new Set();
export function onProductChecked(fn) {
  listeners.add(fn);
}

export function originPattern(url) {
  return new URL(url).origin + '/*';
}

export async function hasHostPermission(url) {
  try {
    return await api.permissions.contains({ origins: [originPattern(url)] });
  } catch {
    return false;
  }
}

// ---------- Weg 1: fetch + parsen ----------

async function fetchHtml(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25000);
  try {
    const res = await fetch(url, {
      credentials: 'include',
      redirect: 'follow',
      cache: 'no-store',
      signal: ctrl.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'de-DE,de;q=0.9,en;q=0.7',
      },
    });
    const buf = await res.arrayBuffer();
    let charset = charsetFromContentType(res.headers.get('content-type'));
    if (!charset) charset = charsetFromHtmlHead(new TextDecoder('latin1').decode(buf.slice(0, 4096)));
    let html;
    try {
      html = new TextDecoder(charset || 'utf-8').decode(buf);
    } catch {
      html = new TextDecoder('utf-8').decode(buf);
    }
    return { status: res.status, ok: res.ok, url: res.url || url, html };
  } finally {
    clearTimeout(timer);
  }
}

let creatingOffscreen = null;

async function ensureOffscreen() {
  if (api.runtime.getContexts) {
    const ctx = await api.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
    if (ctx.length) return;
  }
  if (!creatingOffscreen) {
    creatingOffscreen = api.offscreen
      .createDocument({
        url: 'offscreen/offscreen.html',
        reasons: ['DOM_PARSER'],
        justification: 'HTML von Produktseiten auswerten, um den Preis zu lesen',
      })
      .catch((e) => {
        if (!/single offscreen|already/i.test(String(e && e.message))) throw e;
      })
      .finally(() => {
        creatingOffscreen = null;
      });
  }
  await creatingOffscreen;
}

async function parseHtml(html, url) {
  if (typeof DOMParser === 'function') {
    // Firefox: Hintergrundseite hat ein DOM
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return NS.extractFromDocument(doc, url);
  }
  await ensureOffscreen();
  const res = await api.runtime.sendMessage({ target: 'offscreen', type: 'parseHtml', html, url });
  if (!res || !res.ok) throw new Error((res && res.error) || 'Auswertung im Offscreen-Dokument fehlgeschlagen');
  return res.result;
}

// ---------- Weg 2 + 3: in einem Tab auslesen ----------

export async function extractInTab(tabId) {
  await api.scripting.executeScript({ target: { tabId }, files: ['/lib/priceParser.js', '/lib/extract.js'] });
  const [r] = await api.scripting.executeScript({
    target: { tabId },
    func: () => globalThis.Preiswaechter.extractFromDocument(document, location.href, { live: true }),
  });
  return r && r.result;
}

// Tabs, die wir selbst geöffnet haben – die passive Aktualisierung lässt sie aus.
const ownTabs = new Set();

function waitForTabComplete(tabId, timeoutMs) {
  return new Promise((resolve) => {
    const timer = setTimeout(done, timeoutMs);
    function listener(id, info) {
      if (id === tabId && info.status === 'complete') done();
    }
    function done() {
      clearTimeout(timer);
      api.tabs.onUpdated.removeListener(listener);
      resolve();
    }
    api.tabs.onUpdated.addListener(listener);
    api.tabs.get(tabId).then((t) => { if (t.status === 'complete') done(); }, () => done());
  });
}

async function extractViaBackgroundTab(url, product) {
  const tab = await api.tabs.create({ url, active: false });
  ownTabs.add(tab.id);
  try {
    api.tabs.update(tab.id, { muted: true }).catch(() => {});
    await waitForTabComplete(tab.id, 30000);
    // JS-lastige Shops füllen den Preis erst nach dem Laden – bis zu viermal nachsehen
    let r = null;
    for (let i = 0; i < 4; i++) {
      await sleep(1500);
      try { r = await extractInTab(tab.id); } catch { r = null; }
      if (pickPrice(r, product)) return r;
    }
    return r;
  } finally {
    ownTabs.delete(tab.id);
    api.tabs.remove(tab.id).catch(() => {});
  }
}

// ---------- Ergebnis übernehmen ----------

async function applyResult(productId, result, picked, via, now) {
  const fresh = await getProduct(productId); // neu lesen: User kann inzwischen etwas geändert haben
  if (!fresh) return null; // inzwischen gelöscht
  const previous = { price: fresh.currentPrice, stock: fresh.stockStatus };
  const stock = result.stockStatus && result.stockStatus !== 'unknown' ? result.stockStatus : fresh.stockStatus || 'unknown';
  const priceChanged = fresh.currentPrice != null && picked.price !== fresh.currentPrice;
  const updated = {
    ...fresh,
    currentPrice: picked.price,
    currency: picked.currency || fresh.currency,
    stockStatus: stock,
    previousPrice: priceChanged ? fresh.currentPrice : fresh.previousPrice ?? null,
    lastChange: priceChanged ? now : fresh.lastChange ?? null,
    lastChecked: now,
    nextCheck: nextCheckTime(fresh.intervalMin, now),
    lastError: null,
    errorCount: 0,
    lastVia: via,
    imageUrl: fresh.imageUrl || result.imageUrl || null,
  };
  await saveProduct(updated);
  await appendHistory(fresh.id, { t: now, price: picked.price, stock });
  const event = {
    product: updated,
    previous,
    changed: previous.price !== picked.price || previous.stock !== stock,
    via,
  };
  for (const fn of listeners) {
    try { await fn(event); } catch (e) { console.warn('Preiswächter: Listener-Fehler', e); }
  }
  return event;
}

async function applyError(productId, error, now) {
  const fresh = await getProduct(productId);
  if (!fresh) return null;
  const errorCount = (fresh.errorCount || 0) + 1;
  const updated = {
    ...fresh,
    lastChecked: now,
    lastError: error,
    errorCount,
    nextCheck: retryTime(fresh.intervalMin, errorCount, now),
  };
  await saveProduct(updated);
  return { product: updated, changed: false, error };
}

// ---------- öffentliche Funktionen ----------

/** Ein Produkt sofort prüfen. */
export async function checkProduct(id) {
  const product = await getProduct(id);
  if (!product) return null;
  const now = Date.now();

  if (!(await hasHostPermission(product.url))) {
    return applyError(id, 'Kein Zugriff auf diesen Shop – im Popup auf „Zugriff erlauben“ klicken.', now);
  }

  const settings = await getSettings();
  let result = null;
  let error = null;
  let gone = false;

  try {
    const page = await fetchHtml(product.url);
    if (page.status === 404 || page.status === 410) {
      gone = true;
      error = `Seite nicht mehr vorhanden (HTTP ${page.status})`;
    } else {
      result = await parseHtml(page.html, page.url);
      if (!page.ok) error = `Shop antwortet mit HTTP ${page.status}`;
    }
  } catch (e) {
    error = e && e.name === 'AbortError' ? 'Zeitüberschreitung beim Laden der Seite' : `Laden fehlgeschlagen: ${e && e.message || e}`;
  }

  let picked = pickPrice(result, product);
  if (picked) return applyResult(id, result, picked, 'abruf', now);

  if (!gone && settings.tabFallback) {
    try {
      const r = await extractViaBackgroundTab(product.url, product);
      picked = pickPrice(r, product);
      if (picked) return applyResult(id, r, picked, 'tab', Date.now());
    } catch (e) {
      error = error || `Hintergrund-Tab fehlgeschlagen: ${e && e.message || e}`;
    }
  }

  return applyError(id, error || 'Kein Preis auf der Seite gefunden', now);
}

let running = false;

/** Alle fälligen Produkte prüfen (höchstens `max` pro Durchlauf, mit Pausen dazwischen). */
export async function checkDue({ max = 5 } = {}) {
  if (running) return 0;
  running = true;
  try {
    const now = Date.now();
    const due = (await listProducts())
      .filter((p) => !p.paused && (p.nextCheck || 0) <= now)
      .sort((a, b) => (a.nextCheck || 0) - (b.nextCheck || 0))
      .slice(0, max);
    for (let i = 0; i < due.length; i++) {
      if (i > 0) await sleep(2000 + Math.random() * 3000);
      try {
        await checkProduct(due[i].id);
      } catch (e) {
        console.warn('Preiswächter: Prüfung fehlgeschlagen', due[i].url, e);
      }
    }
    return due.length;
  } finally {
    running = false;
  }
}

/** Der User hat eine Seite geöffnet – ist es ein verfolgtes Produkt, Preis mitnehmen. */
export async function passiveUpdate(tabId, url) {
  if (ownTabs.has(tabId) || !/^https?:/i.test(url)) return null;
  const norm = NS.normalizeProductUrl(url);
  const product = (await listProducts()).find((p) => p.url === norm);
  if (!product) return null;
  if (Date.now() - (product.lastChecked || 0) < 60 * 1000) return null;
  await sleep(1500); // nachgeladene Preise abwarten
  let r;
  try { r = await extractInTab(tabId); } catch { return null; }
  if (!r || NS.normalizeProductUrl(r.url) !== norm) return null; // Tab ist inzwischen woanders
  const picked = pickPrice(r, product);
  if (!picked) return null;
  return applyResult(product.id, r, picked, 'besuch', Date.now());
}
