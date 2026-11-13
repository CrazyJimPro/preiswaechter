import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seriesInRange, stats, priceAt, niceTicks, timeTicks, priceChange, sinceAdded, changesOnly, durationOf, extremes, stockGaps, DAY } from '../src/lib/series.js';

const T = Date.UTC(2026, 10, 1);
const hist = [
  { t: T, price: 100 },
  { t: T + 10 * DAY, price: 80 },
  { t: T + 20 * DAY, price: 90 },
];

test('seriesInRange: Startpreis wird am linken Rand ergänzt', () => {
  const pts = seriesInRange(hist, T + 5 * DAY, T + 30 * DAY);
  assert.deepEqual(pts.map((p) => [p.t - T, p.price]), [[5 * DAY, 100], [10 * DAY, 80], [20 * DAY, 90]]);
  assert.equal(pts[0].carried, true);
});

test('seriesInRange: "Alles" beginnt beim ersten Punkt', () => {
  assert.equal(seriesInRange(hist, -Infinity, T + 30 * DAY).length, 3);
  assert.deepEqual(seriesInRange([], 0, 1), []);
});

test('stats: Min/Max und zeitgewichteter Durchschnitt', () => {
  const st = stats(seriesInRange(hist, -Infinity, T + 30 * DAY), T + 30 * DAY);
  assert.equal(st.min, 80);
  assert.equal(st.max, 100);
  assert.equal(st.avg, 90); // je 10 Tage 100, 80, 90
  assert.equal(st.changes, 2);
});

test('priceAt', () => {
  const pts = seriesInRange(hist, -Infinity, T + 30 * DAY);
  assert.equal(priceAt(pts, T + 15 * DAY).price, 80);
  assert.equal(priceAt(pts, T - 1), null);
});

test('niceTicks', () => {
  assert.deepEqual(niceTicks(81, 99, 4).ticks, [80, 85, 90, 95, 100]);
  const flat = niceTicks(549, 549, 4);
  assert.ok(flat.lo < 549 && flat.hi > 549);
});

test('timeTicks: höchstens ~6 Beschriftungen', () => {
  for (const span of [3 * 3600e3, 2 * DAY, 30 * DAY, 400 * DAY]) {
    const { ticks } = timeTicks(T, T + span);
    assert.ok(ticks.length >= 1 && ticks.length <= 7, `${span}: ${ticks.length}`);
  }
});

test('priceChange', () => {
  assert.deepEqual(priceChange(90, 100), { diff: -10, pct: -10 });
  assert.equal(priceChange(100, 100), null);
  assert.equal(priceChange(100, null), null);
});

test('sinceAdded: gemerkter Preis, sonst erster Verlaufspunkt', () => {
  const p = { addedPrice: 100, currentPrice: 90, createdAt: T };
  assert.deepEqual(sinceAdded(p, hist), { price: 100, t: T, change: { diff: -10, pct: -10 } });
  // ältere Produkte ohne addedPrice
  const old = sinceAdded({ currentPrice: 90 }, [{ t: T + 5, price: 95 }, { t: T, price: 120 }]);
  assert.equal(old.price, 120);
  assert.equal(old.t, T);
  assert.equal(old.change.diff, -30);
  assert.equal(sinceAdded({ addedPrice: 90, currentPrice: 90 }, hist).change, null);
  assert.equal(sinceAdded({ currentPrice: 90 }, []), null);
});

test('seriesInRange: übernommener Startpunkt kennt seinen echten Beginn', () => {
  const pts = seriesInRange(hist, T + 5 * DAY, T + 30 * DAY);
  assert.equal(pts[0].origT, T);
});

test('changesOnly: Lebenszeichen fallen weg, Lagerwechsel bleiben', () => {
  const h = [
    { t: T, price: 100, stock: 'in_stock' },
    { t: T + DAY, price: 100, stock: 'in_stock' },
    { t: T + 2 * DAY, price: 100, stock: 'out_of_stock' },
    { t: T + 3 * DAY, price: 90, stock: 'out_of_stock' },
    { t: T + 4 * DAY, price: 90, stock: 'out_of_stock' },
  ];
  const ch = changesOnly(h);
  assert.deepEqual(ch.map((p) => p.t - T), [0, 2 * DAY, 3 * DAY]);
  assert.equal(ch[0].change, null);
  assert.equal(ch[1].change, null); // nur Lagerstatus anders
  assert.deepEqual(ch[2].change, { diff: -10, pct: -10 });
  // unsortierte Eingabe
  assert.equal(changesOnly([...h].reverse()).length, 3);
});

test('durationOf: bis zum nächsten Punkt bzw. bis jetzt, ab echtem Beginn', () => {
  const pts = seriesInRange(hist, T + 5 * DAY, T + 30 * DAY);
  assert.equal(durationOf(pts, 0, T + 30 * DAY), 10 * DAY); // galt seit T, nicht erst seit T+5
  assert.equal(durationOf(pts, 2, T + 30 * DAY), 10 * DAY);
  assert.equal(durationOf(pts, 9, T), 0);
});

test('extremes: Tiefst- und Höchstpreis mit Beginn, letzter Abschnitt gewinnt', () => {
  const h = [
    { t: T, price: 80 },
    { t: T + DAY, price: 100 },
    { t: T + 2 * DAY, price: 80 },
    { t: T + 3 * DAY, price: 80 }, // Lebenszeichen, kein neuer Abschnitt
  ];
  const ex = extremes(h);
  assert.equal(ex.min.price, 80);
  assert.equal(ex.min.t, T + 2 * DAY);
  assert.equal(ex.min.current, true);
  assert.equal(ex.max.price, 100);
  assert.equal(ex.max.current, false);
  const carried = extremes(seriesInRange(hist, T + 5 * DAY, T + 30 * DAY));
  assert.equal(carried.max.since, T);
  assert.equal(carried.max.t, T + 5 * DAY);
  assert.equal(extremes([]), null);
});

test('stockGaps: Lücken zusammenfassen, offene Lücke reicht bis jetzt', () => {
  const h = [
    { t: T, price: 1, stock: 'in_stock' },
    { t: T + DAY, price: 1, stock: 'out_of_stock' },
    { t: T + 2 * DAY, price: 1, stock: 'out_of_stock' },
    { t: T + 3 * DAY, price: 1, stock: 'in_stock' },
    { t: T + 5 * DAY, price: 1, stock: 'out_of_stock' },
  ];
  assert.deepEqual(stockGaps(h, T + 9 * DAY).map((g) => [g.from - T, g.to - T]), [[DAY, 3 * DAY], [5 * DAY, 9 * DAY]]);
  assert.deepEqual(stockGaps([], T), []);
});
