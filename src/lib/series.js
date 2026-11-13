// Reine Rechenfunktionen für Preisverlauf und Diagramm (ohne DOM, unter Node testbar).
//
// Der Verlauf ist eine Treppenfunktion: Ein Preis gilt ab seinem Zeitpunkt,
// bis der nächste Punkt kommt. Danach gilt der letzte Preis bis "jetzt".

export const DAY = 24 * 60 * 60 * 1000;

export const RANGES = [
  ['7', '7 Tage', 7 * DAY],
  ['30', '30 Tage', 30 * DAY],
  ['90', '90 Tage', 90 * DAY],
  ['365', '1 Jahr', 365 * DAY],
  ['all', 'Alles', Infinity],
];

/**
 * Punkte im Zeitraum [from, to]. Der Preis, der zu Beginn galt, wird als
 * Startpunkt bei `from` ergänzt, damit die Linie am linken Rand beginnt.
 */
export function seriesInRange(history, from, to) {
  const pts = (history || []).filter((p) => p && p.price != null).sort((a, b) => a.t - b.t);
  if (!pts.length) return [];
  const start = Number.isFinite(from) ? Math.max(from, pts[0].t) : pts[0].t;
  const out = [];
  let carry = null;
  for (const p of pts) {
    if (p.t < start) carry = p;
    else if (p.t <= to) out.push(p);
  }
  // origT: Seit wann der übernommene Preis wirklich galt (für Datumsangaben)
  if (carry && (!out.length || out[0].t > start)) out.unshift({ ...carry, t: start, origT: carry.t, carried: true });
  return out;
}

/**
 * Nur die Punkte, an denen sich Preis oder Lagerstatus geändert hat (der erste Punkt
 * zählt immer). Jeder Punkt bekommt `change` = Änderung zum vorherigen Preis oder null.
 * Wiederholte Punkte mit gleichem Preis und Lagerstatus (Lebenszeichen) fallen weg.
 */
export function changesOnly(points) {
  const sorted = (points || []).filter((p) => p && p.price != null).sort((a, b) => a.t - b.t);
  const out = [];
  for (const p of sorted) {
    const prev = out[out.length - 1];
    if (prev && prev.price === p.price && (prev.stock || 'unknown') === (p.stock || 'unknown')) continue;
    out.push({ ...p, change: prev ? priceChange(p.price, prev.price) : null });
  }
  return out;
}

/** Wie lange galt der Punkt `i` (bis zum nächsten Punkt bzw. bis `to`)? In Millisekunden. */
export function durationOf(points, i, to) {
  const p = points[i];
  if (!p) return 0;
  const start = p.origT ?? p.t;
  const end = i + 1 < points.length ? points[i + 1].t : Math.max(to, p.t);
  return Math.max(0, end - start);
}

/**
 * Tiefst- und Höchstpreis im Zeitraum mit dem Punkt, an dem er zuletzt begann.
 * `t` ist die Stelle im Diagramm, `since` der echte Beginn (bei übernommenem Startpreis früher),
 * `current` sagt, ob der Preis noch gilt.
 */
export function extremes(points) {
  if (!points || !points.length) return null;
  const pick = (better) => {
    let idx = 0;
    for (let i = 1; i < points.length; i++) {
      const a = points[i].price;
      const b = points[idx].price;
      // bei Gleichstand gewinnt der spätere Abschnitt, aber nur, wenn der Preis dazwischen anders war
      if (better(a, b) || (a === b && points[i - 1].price !== a)) idx = i;
    }
    const p = points[idx];
    return { price: p.price, t: p.t, since: p.origT ?? p.t, current: points.slice(idx).every((q) => q.price === p.price) };
  };
  return { min: pick((a, b) => a < b), max: pick((a, b) => a > b) };
}

/** Zeitabschnitte, in denen der Artikel nicht lieferbar war: [{from, to}]. */
export function stockGaps(points, to) {
  const gaps = [];
  let open = null;
  for (const p of points || []) {
    if (p.stock === 'out_of_stock') {
      if (open == null) open = p.t;
    } else if (open != null) {
      gaps.push({ from: open, to: p.t });
      open = null;
    }
  }
  if (open != null) gaps.push({ from: open, to: Math.max(to, open) });
  return gaps;
}

/** Tiefst-, Höchst- und zeitgewichteter Durchschnittspreis im Zeitraum. */
export function stats(points, to) {
  if (!points.length) return null;
  let min = Infinity;
  let max = -Infinity;
  let weighted = 0;
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    min = Math.min(min, p.price);
    max = Math.max(max, p.price);
    const end = i + 1 < points.length ? points[i + 1].t : Math.max(to, p.t);
    const span = end - p.t;
    weighted += p.price * span;
    total += span;
  }
  const avg = total > 0 ? weighted / total : points.reduce((s, p) => s + p.price, 0) / points.length;
  return { min, max, avg: Math.round(avg * 100) / 100, changes: countChanges(points) };
}

function countChanges(points) {
  let n = 0;
  for (let i = 1; i < points.length; i++) if (points[i].price !== points[i - 1].price) n++;
  return n;
}

/** Preis, der zum Zeitpunkt t galt. */
export function priceAt(points, t) {
  let cur = null;
  for (const p of points) {
    if (p.t <= t) cur = p;
    else break;
  }
  return cur;
}

/** "Schöne" Achsenwerte (1, 2, 2,5, 5 × 10^n) zwischen min und max. */
export function niceTicks(min, max, count = 4) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { lo: 0, hi: 1, ticks: [0, 1] };
  if (min === max) {
    const pad = Math.max(Math.abs(min) * 0.05, 1);
    min -= pad;
    max += pad;
  }
  const raw = (max - min) / Math.max(1, count);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || 10 * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
  return { lo, hi, ticks };
}

/** Zeitachse: Abstand der Beschriftungen passend zur Spanne, höchstens ~6 Stück. */
export function timeTicks(from, to) {
  const span = to - from;
  const HOUR = 60 * 60 * 1000;
  const steps = [HOUR, 3 * HOUR, 6 * HOUR, 12 * HOUR, DAY, 2 * DAY, 7 * DAY, 14 * DAY, 30 * DAY, 61 * DAY, 91 * DAY, 182 * DAY, 365 * DAY];
  const step = steps.find((s) => span / s <= 6) || 365 * DAY;
  const ticks = [];
  // An lokalen Tages- bzw. Stundengrenzen ausrichten
  const d = new Date(from);
  if (step >= DAY) d.setHours(0, 0, 0, 0);
  else d.setMinutes(0, 0, 0);
  let t = d.getTime();
  while (t < from) t += step;
  for (; t <= to; t += step) ticks.push(t);
  return { step, ticks, withTime: step < DAY };
}

/** Änderung gegenüber dem vorherigen Preis: { diff, pct } oder null. */
export function priceChange(current, previous) {
  if (current == null || previous == null || previous === 0 || current === previous) return null;
  const diff = Math.round((current - previous) * 100) / 100;
  return { diff, pct: Math.round((diff / previous) * 1000) / 10 };
}

/**
 * Was hat sich seit dem Hinzufügen getan? Produkte aus älteren Versionen haben kein
 * addedPrice, dort gilt der erste Punkt im Verlauf.
 * @returns {{price: number, t: number|null, change: {diff: number, pct: number}|null}|null}
 */
export function sinceAdded(product, history) {
  const first = (history || []).reduce((a, b) => (!a || b.t < a.t ? b : a), null);
  const price = product.addedPrice ?? (first ? first.price : null);
  if (price == null) return null;
  return {
    price,
    t: product.createdAt ?? (first ? first.t : null),
    change: priceChange(product.currentPrice, price),
  };
}
