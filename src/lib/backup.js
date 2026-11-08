// Datensicherung: Export-Format bauen und Import planen (ohne Browser-API, testbar).

export const BACKUP_APP = 'preiswaechter';
export const BACKUP_VERSION = 1;

export function buildBackup({ settings, products, histories }, now = Date.now()) {
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: new Date(now).toISOString(),
    settings,
    products: products.map((p, i) => ({ ...p, history: histories[i] || [] })),
  };
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

function cleanHistory(h) {
  if (!Array.isArray(h)) return [];
  return h
    .filter((x) => x && isNum(x.t) && isNum(x.price) && x.price > 0)
    .map((x) => ({ t: x.t, price: x.price, stock: typeof x.stock === 'string' ? x.stock : 'unknown' }))
    .sort((a, b) => a.t - b.t);
}

function validUrl(u) {
  try { return /^https?:$/.test(new URL(u).protocol); } catch { return false; }
}

/** Verläufe zusammenführen: doppelte Zeitpunkte nur einmal. */
export function mergeHistory(a, b) {
  const map = new Map();
  for (const x of [...(a || []), ...(b || [])]) if (!map.has(x.t)) map.set(x.t, x);
  return [...map.values()].sort((x, y) => x.t - y.t);
}

/**
 * Prüft eine Sicherungsdatei und plant den Import.
 * - Produkte mit neuer Adresse werden hinzugefügt.
 * - Produkte, deren Adresse schon verfolgt wird, behalten ihre Einstellungen;
 *   nur der Verlauf wird ergänzt.
 * @returns {{ error?: string, add: object[], merge: object[], skipped: number, origins: string[] }}
 */
export function planImport(data, existing, { now = Date.now(), newId } = {}) {
  const empty = { add: [], merge: [], skipped: 0, origins: [] };
  if (!data || typeof data !== 'object' || data.app !== BACKUP_APP || !Array.isArray(data.products)) {
    return { ...empty, error: 'Das ist keine Preiswächter-Sicherung.' };
  }
  if (data.version > BACKUP_VERSION) {
    return { ...empty, error: 'Die Sicherung stammt aus einer neueren Version des Preiswächters.' };
  }
  const byUrl = new Map(existing.products.map((p, i) => [p.url, { product: p, history: existing.histories[i] || [] }]));
  const usedIds = new Set(existing.products.map((p) => p.id));
  const add = [];
  const merge = [];
  const origins = new Set();
  let skipped = 0;

  data.products.forEach((raw, i) => {
    if (!raw || typeof raw !== 'object' || !validUrl(raw.url) || typeof raw.name !== 'string') { skipped++; return; }
    const history = cleanHistory(raw.history);
    origins.add(new URL(raw.url).origin + '/*');
    const have = byUrl.get(raw.url);
    if (have) {
      const merged = mergeHistory(have.history, history);
      if (merged.length !== have.history.length) merge.push({ product: have.product, history: merged });
      return;
    }
    let id = typeof raw.id === 'string' && /^[\w-]{1,64}$/.test(raw.id) ? raw.id : null;
    if (!id || usedIds.has(id)) id = newId ? newId() : `import-${now}-${i}`;
    usedIds.add(id);
    const last = history[history.length - 1];
    const intervalMin = isNum(raw.intervalMin) && raw.intervalMin >= 15 ? raw.intervalMin : 60;
    const product = {
      id,
      url: raw.url,
      name: raw.name.slice(0, 300),
      imageUrl: typeof raw.imageUrl === 'string' && validUrl(raw.imageUrl) ? raw.imageUrl : null,
      shop: typeof raw.shop === 'string' ? raw.shop : null,
      currency: typeof raw.currency === 'string' && /^[A-Z]{3}$/.test(raw.currency) ? raw.currency : 'EUR',
      currentPrice: isNum(raw.currentPrice) ? raw.currentPrice : last ? last.price : null,
      addedPrice: isNum(raw.addedPrice) ? raw.addedPrice : null,
      previousPrice: isNum(raw.previousPrice) ? raw.previousPrice : null,
      lastChange: isNum(raw.lastChange) ? raw.lastChange : null,
      stockStatus: typeof raw.stockStatus === 'string' ? raw.stockStatus : 'unknown',
      intervalMin,
      lastChecked: isNum(raw.lastChecked) ? raw.lastChecked : null,
      // gestaffelt in den nächsten Minuten prüfen, nicht alle auf einmal
      nextCheck: now + (2 + add.length) * 60 * 1000,
      lastError: null,
      errorCount: 0,
      targetPrice: isNum(raw.targetPrice) ? raw.targetPrice : null,
      dropThreshold: isNum(raw.dropThreshold) ? raw.dropThreshold : null,
      notifyStock: raw.notifyStock !== false,
      paused: raw.paused === true,
      preferredMethods: Array.isArray(raw.preferredMethods) ? raw.preferredMethods.filter((m) => typeof m === 'string') : [],
      createdAt: isNum(raw.createdAt) ? raw.createdAt : now,
    };
    add.push({ product, history });
    byUrl.set(raw.url, { product, history });
  });
  return { add, merge, skipped, origins: [...origins] };
}
