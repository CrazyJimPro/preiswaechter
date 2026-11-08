// Preisprüfung: Seite lesen, Produkt und Verlauf aktualisieren.
import { readPage, readVisible } from './reader.js';
import { pickPrice, nextCheckTime, retryTime } from '../lib/pick.js';

export function createChecker(store) {
  const listeners = new Set();

  function applyResult(id, result, picked, now) {
    const fresh = store.getProduct(id); // kann inzwischen geändert oder gelöscht sein
    if (!fresh) return null;
    const previous = { price: fresh.currentPrice, stock: fresh.stockStatus };
    const stock = result.stockStatus && result.stockStatus !== 'unknown' ? result.stockStatus : fresh.stockStatus || 'unknown';
    const priceChanged = fresh.currentPrice != null && picked.price !== fresh.currentPrice;
    const product = store.saveProduct({
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
      imageUrl: fresh.imageUrl || result.imageUrl || null,
    });
    store.appendHistory(id, { t: now, price: picked.price, stock });
    const event = { product, previous, changed: previous.price !== picked.price || previous.stock !== stock };
    for (const fn of listeners) {
      try { fn(event); } catch (err) { console.error('Fehler nach der Prüfung:', err); }
    }
    return event;
  }

  function applyError(id, error, now) {
    const fresh = store.getProduct(id);
    if (!fresh) return null;
    const errorCount = (fresh.errorCount || 0) + 1;
    const product = store.saveProduct({
      ...fresh,
      lastChecked: now,
      lastError: error,
      errorCount,
      nextCheck: retryTime(fresh.intervalMin, errorCount, now),
    });
    return { product, changed: false, error };
  }

  /** Ein Produkt sofort prüfen. */
  async function checkProduct(id) {
    const product = store.getProduct(id);
    if (!product) return null;
    const { result, status, error } = await readPage(product.url, product);
    const now = Date.now();
    const picked = pickPrice(result, product);
    if (status === 404 || status === 410) return applyError(id, `Seite nicht mehr vorhanden (HTTP ${status})`, now);
    if (picked) return applyResult(id, result, picked, now);
    if (error) return applyError(id, error, now);
    if (status && status >= 400) return applyError(id, `Shop antwortet mit HTTP ${status}`, now);
    return applyError(id, 'Kein Preis auf der Seite gefunden', now);
  }

  /** Seite sichtbar öffnen (Captcha, Cookie-Abfrage); beim Schließen wird der Preis gelesen. */
  async function checkInWindow(id) {
    const product = store.getProduct(id);
    if (!product) return null;
    const { result, error } = await readVisible(product.url);
    const now = Date.now();
    const picked = pickPrice(result, product);
    if (picked) return applyResult(id, result, picked, now);
    return applyError(id, error || 'Kein Preis auf der Seite gefunden', now);
  }

  let running = false;

  /** Alle fälligen Produkte prüfen (höchstens `max` pro Durchlauf, mit Pausen dazwischen). */
  async function checkDue({ max = 5, all = false } = {}) {
    if (running) return 0;
    running = true;
    try {
      const now = Date.now();
      const due = store.listProducts()
        .filter((p) => !p.paused && (all || (p.nextCheck || 0) <= now))
        .sort((a, b) => (a.nextCheck || 0) - (b.nextCheck || 0))
        .slice(0, all ? undefined : max);
      for (let i = 0; i < due.length; i++) {
        if (i > 0) await new Promise((r) => setTimeout(r, 2000 + Math.random() * 3000));
        try {
          await checkProduct(due[i].id);
        } catch (err) {
          console.error('Prüfung fehlgeschlagen:', due[i].url, err);
        }
      }
      return due.length;
    } finally {
      running = false;
    }
  }

  return { checkProduct, checkInWindow, checkDue, onChecked: (fn) => listeners.add(fn) };
}
