// Speicherung in storage.local
//   productIds        → ['id1', 'id2', …]   (Reihenfolge = neueste zuerst)
//   product:<id>      → Produktdaten
//   history:<id>      → [{ t, price, stock }, …]
//   settings          → Einstellungen
import { api } from './api.js';

const IDS = 'productIds';
const P = (id) => `product:${id}`;
const H = (id) => `history:${id}`;

// Ein Verlaufspunkt wird nur gespeichert, wenn sich Preis oder Lagerstatus
// ändern – oder spätestens alle 6 Stunden, damit das Diagramm durchgehend ist.
const HISTORY_KEEPALIVE_MS = 6 * 60 * 60 * 1000;

export const DEFAULT_SETTINGS = {
  defaultIntervalMin: 60,
  notifications: true,
  tabFallback: true,
};

export const INTERVALS = [
  [15, '15 Minuten'],
  [30, '30 Minuten'],
  [60, '1 Stunde'],
  [180, '3 Stunden'],
  [360, '6 Stunden'],
  [720, '12 Stunden'],
  [1440, '24 Stunden'],
];

export async function getSettings() {
  const { settings } = await api.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...(settings || {}) };
}

export async function saveSettings(patch) {
  const s = { ...(await getSettings()), ...patch };
  await api.storage.local.set({ settings: s });
  return s;
}

async function getIds() {
  const r = await api.storage.local.get(IDS);
  return Array.isArray(r[IDS]) ? r[IDS] : [];
}

export async function listProducts() {
  const ids = await getIds();
  if (!ids.length) return [];
  const r = await api.storage.local.get(ids.map(P));
  return ids.map((id) => r[P(id)]).filter(Boolean);
}

export async function getProduct(id) {
  const r = await api.storage.local.get(P(id));
  return r[P(id)] || null;
}

export async function saveProduct(product) {
  await api.storage.local.set({ [P(product.id)]: product });
  return product;
}

export async function updateProduct(id, patch) {
  const p = await getProduct(id);
  if (!p) return null;
  return saveProduct({ ...p, ...patch });
}

export async function findProductByUrl(url) {
  const all = await listProducts();
  return all.find((p) => p.url === url) || null;
}

/**
 * Neues Produkt anlegen (oder vorhandenes mit gleicher URL zurückgeben).
 * @param {{url, name, imageUrl, shop, currency, price, stockStatus, targetPrice?}} info
 */
export async function addProduct(info) {
  const existing = await findProductByUrl(info.url);
  if (existing) return existing;

  const settings = await getSettings();
  const now = Date.now();
  const id = crypto.randomUUID();
  const intervalMin = settings.defaultIntervalMin;
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
    // Bei mehreren gefundenen Preisen: die Methode(n), deren Preis der User gewählt hat
    preferredMethods: Array.isArray(info.preferredMethods) ? info.preferredMethods : [],
    previousPrice: null,
    lastChange: null,
    errorCount: 0,
    dropThreshold: null, // Preissenkung in Prozent, ab der gemeldet wird
    notifyStock: true,
    createdAt: now,
  };
  await api.storage.local.set({
    [P(id)]: product,
    [H(id)]: product.currentPrice != null
      ? [{ t: now, price: product.currentPrice, stock: product.stockStatus }]
      : [],
  });
  const ids = await getIds();
  await api.storage.local.set({ [IDS]: [id, ...ids.filter((x) => x !== id)] });
  return product;
}

export async function deleteProduct(id) {
  const ids = await getIds();
  await api.storage.local.set({ [IDS]: ids.filter((x) => x !== id) });
  await api.storage.local.remove([P(id), H(id)]);
}

export async function getHistory(id) {
  const r = await api.storage.local.get(H(id));
  return Array.isArray(r[H(id)]) ? r[H(id)] : [];
}

export async function appendHistory(id, point) {
  const hist = await getHistory(id);
  const last = hist[hist.length - 1];
  if (
    last &&
    last.price === point.price &&
    last.stock === point.stock &&
    point.t - last.t < HISTORY_KEEPALIVE_MS
  ) {
    return false;
  }
  hist.push(point);
  await api.storage.local.set({ [H(id)]: hist });
  return true;
}

// ---------- ungelesene Preissenkungen (Zahl am Symbol) ----------

export async function getUnread() {
  const { unread } = await api.storage.local.get('unread');
  return Array.isArray(unread) ? unread : [];
}

export async function addUnread(id) {
  const list = await getUnread();
  if (!list.includes(id)) list.push(id);
  await api.storage.local.set({ unread: list });
  return list;
}

export async function clearUnread() {
  await api.storage.local.set({ unread: [] });
}

/** Alle Produkte mit Verlauf – für die Datensicherung. */
export async function allData() {
  const products = await listProducts();
  const histories = await Promise.all(products.map((p) => getHistory(p.id)));
  return { settings: await getSettings(), products, histories };
}

/** Mehrere Produkte samt Verlauf auf einmal schreiben (Import). */
export async function writeProducts(entries) {
  const ids = await getIds();
  const patch = {};
  for (const { product, history } of entries) {
    patch[P(product.id)] = product;
    patch[H(product.id)] = history;
    if (!ids.includes(product.id)) ids.push(product.id);
  }
  patch[IDS] = ids;
  await api.storage.local.set(patch);
}
