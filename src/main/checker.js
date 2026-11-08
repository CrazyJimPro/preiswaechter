// Preisprüfung: Seite lesen, Produkt und Verlauf aktualisieren.
import { readPage } from './reader.js';
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

  return { checkProduct, onChecked: (fn) => listeners.add(fn) };
}
