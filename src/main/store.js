// Speicher der App: eine JSON-Datei im Benutzerordner.
// Schreiben ist atomar (temporäre Datei + Umbenennen). Beim Start wird eine Kopie
// als .bak angelegt; ist die Datei einmal beschädigt, wird die Kopie geladen und
// die kaputte Datei zur Untersuchung beiseitegelegt.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DEFAULT_SETTINGS } from '../lib/constants.js';

// Ein Verlaufspunkt wird nur gespeichert, wenn sich Preis oder Lagerstatus
// ändern – oder spätestens alle 6 Stunden, damit das Diagramm durchgehend ist.
const HISTORY_KEEPALIVE_MS = 6 * 60 * 60 * 1000;
const WRITE_DELAY_MS = 200;

const emptyData = () => ({ version: 1, settings: {}, ids: [], products: {}, histories: {}, unread: [] });

function loadFile(file) {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.ids)) throw new Error('Unbekanntes Format');
  return { ...emptyData(), ...parsed };
}

function load(file) {
  if (!fs.existsSync(file)) return emptyData();
  try {
    const data = loadFile(file);
    fs.copyFileSync(file, `${file}.bak`);
    return data;
  } catch (err) {
    const broken = `${file}.kaputt-${Date.now()}`;
    fs.renameSync(file, broken);
    console.error(`Datendatei beschädigt, beiseitegelegt als ${broken}:`, err);
    try {
      return loadFile(`${file}.bak`);
    } catch {
      return emptyData();
    }
  }
}

export function createStore(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const data = load(file);
  const listeners = new Set();
  let timer = null;

  function flush() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, file);
  }

  function changed() {
    if (!timer) {
      timer = setTimeout(() => {
        timer = null;
        try { flush(); } catch (err) { console.error('Speichern fehlgeschlagen:', err); }
      }, WRITE_DELAY_MS);
    }
    for (const fn of listeners) fn();
  }

  const store = {
    flush,
    onChange: (fn) => listeners.add(fn),

    getSettings: () => ({ ...DEFAULT_SETTINGS, ...data.settings }),
    saveSettings(patch) {
      data.settings = { ...data.settings, ...patch };
      changed();
      return store.getSettings();
    },

    listProducts: () => data.ids.map((id) => data.products[id]).filter(Boolean),
    getProduct: (id) => data.products[id] || null,
    findProductByUrl: (url) => store.listProducts().find((p) => p.url === url) || null,

    saveProduct(product) {
      data.products[product.id] = product;
      changed();
      return product;
    },
    updateProduct(id, patch) {
      const p = data.products[id];
      return p ? store.saveProduct({ ...p, ...patch }) : null;
    },

    /** Neues Produkt anlegen (oder vorhandenes mit gleicher Adresse zurückgeben). */
    addProduct(info) {
      const existing = store.findProductByUrl(info.url);
      if (existing) return existing;
      const now = Date.now();
      const id = crypto.randomUUID();
      const intervalMin = store.getSettings().defaultIntervalMin;
      const product = {
        id,
        url: info.url,
        name: info.name || info.url,
        imageUrl: info.imageUrl || null,
        shop: info.shop || null,
        currency: info.currency || 'EUR',
        currentPrice: info.price ?? null,
        stockStatus: info.stockStatus || 'unknown',
        intervalMin,
        lastChecked: now,
        nextCheck: now + intervalMin * 60 * 1000,
        lastError: null,
        targetPrice: info.targetPrice ?? null,
        // Bei mehreren gefundenen Preisen: die Methode(n), deren Preis gewählt wurde
        preferredMethods: Array.isArray(info.preferredMethods) ? info.preferredMethods : [],
        addedPrice: info.price ?? null, // Preis beim Hinzufügen, bleibt für immer gleich
        previousPrice: null,
        lastChange: null,
        errorCount: 0,
        dropThreshold: null, // Preissenkung in Prozent, ab der gemeldet wird
        notifyStock: true,
        createdAt: now,
      };
      data.products[id] = product;
      data.histories[id] = product.currentPrice != null
        ? [{ t: now, price: product.currentPrice, stock: product.stockStatus }]
        : [];
      data.ids = [id, ...data.ids];
      changed();
      return product;
    },

    deleteProduct(id) {
      data.ids = data.ids.filter((x) => x !== id);
      delete data.products[id];
      delete data.histories[id];
      data.unread = data.unread.filter((x) => x !== id);
      changed();
    },

    getHistory: (id) => data.histories[id] || [],
    appendHistory(id, point) {
      const hist = data.histories[id] || (data.histories[id] = []);
      const last = hist[hist.length - 1];
      if (last && last.price === point.price && last.stock === point.stock && point.t - last.t < HISTORY_KEEPALIVE_MS) {
        return false;
      }
      hist.push(point);
      changed();
      return true;
    },

    getUnread: () => [...data.unread],
    addUnread(id) {
      if (!data.unread.includes(id)) {
        data.unread.push(id);
        changed();
      }
    },
    removeUnread(id) {
      if (data.unread.includes(id)) {
        data.unread = data.unread.filter((x) => x !== id);
        changed();
      }
    },
    clearUnread() {
      if (data.unread.length) {
        data.unread = [];
        changed();
      }
    },

    /** Für die Datensicherung. */
    allData() {
      const products = store.listProducts();
      return { settings: store.getSettings(), products, histories: products.map((p) => store.getHistory(p.id)) };
    },
    /** Mehrere Produkte samt Verlauf auf einmal schreiben (Sicherung einspielen). */
    writeProducts(entries) {
      for (const { product, history } of entries) {
        data.products[product.id] = product;
        data.histories[product.id] = history;
        if (!data.ids.includes(product.id)) data.ids.push(product.id);
      }
      changed();
    },
  };
  return store;
}
