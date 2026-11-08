import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seriesInRange, stats, priceAt, niceTicks, timeTicks, priceChange, DAY } from '../extension/lib/series.js';

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
