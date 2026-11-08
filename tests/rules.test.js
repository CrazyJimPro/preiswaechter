import { test } from 'node:test';
import assert from 'node:assert/strict';
import { notificationsFor, notificationText } from '../extension/lib/rules.js';

const on = { notifications: true };
const ev = (product, previous) => ({ product: { name: 'Testprodukt', notifyStock: true, ...product }, previous });
const kinds = (list) => list.map((n) => n.kind);

test('jede Senkung ohne Schwelle', () => {
  assert.deepEqual(kinds(notificationsFor(ev({ currentPrice: 99 }, { price: 100 }), on)), ['drop']);
});

test('Preisanstieg und gleicher Preis melden nichts', () => {
  assert.deepEqual(notificationsFor(ev({ currentPrice: 101 }, { price: 100 }), on), []);
  assert.deepEqual(notificationsFor(ev({ currentPrice: 100 }, { price: 100 }), on), []);
});

test('Schwelle in Prozent', () => {
  assert.deepEqual(notificationsFor(ev({ currentPrice: 95, dropThreshold: 10 }, { price: 100 }), on), []);
  const r = notificationsFor(ev({ currentPrice: 90, dropThreshold: 10 }, { price: 100 }), on);
  assert.deepEqual(kinds(r), ['drop']);
  assert.equal(r[0].pct, 10);
});

test('Zielpreis nur beim Unterschreiten, danach normale Senkung', () => {
  assert.deepEqual(kinds(notificationsFor(ev({ currentPrice: 80, targetPrice: 80 }, { price: 85 }), on)), ['target']);
  assert.deepEqual(kinds(notificationsFor(ev({ currentPrice: 75, targetPrice: 80 }, { price: 80 }), on)), ['drop']);
  assert.deepEqual(notificationsFor(ev({ currentPrice: 82, targetPrice: 80 }, { price: 85, stock: 'in_stock' }), { notifications: true }).filter((n) => n.kind === 'target'), []);
});

test('Zielpreis schon beim Anlegen unterschritten → beim ersten Wechsel melden', () => {
  assert.deepEqual(kinds(notificationsFor(ev({ currentPrice: 70, targetPrice: 80 }, { price: null }), on)), ['target']);
});

test('wieder lieferbar (abschaltbar)', () => {
  const e = ev({ currentPrice: 100, stockStatus: 'in_stock' }, { price: 100, stock: 'out_of_stock' });
  assert.deepEqual(kinds(notificationsFor(e, on)), ['stock']);
  e.product.notifyStock = false;
  assert.deepEqual(notificationsFor(e, on), []);
});

test('Senkung + wieder lieferbar gleichzeitig', () => {
  const e = ev({ currentPrice: 90, stockStatus: 'in_stock' }, { price: 100, stock: 'out_of_stock' });
  assert.deepEqual(kinds(notificationsFor(e, on)), ['drop', 'stock']);
});

test('global ausgeschaltet', () => {
  assert.deepEqual(notificationsFor(ev({ currentPrice: 1 }, { price: 100 }), { notifications: false }), []);
});

test('Texte', () => {
  const fmt = (v) => `${v.toFixed(2).replace('.', ',')} €`;
  const t = notificationText({ kind: 'drop', oldPrice: 100, newPrice: 85, pct: 15 }, { name: 'Kopfhörer' }, fmt);
  assert.equal(t.title, 'Preis gesunken um 15 %');
  assert.equal(t.message, 'Kopfhörer\n100,00 € → 85,00 €');
  const z = notificationText({ kind: 'target', oldPrice: 90, newPrice: 79, target: 80 }, { name: 'X' }, fmt);
  assert.equal(z.title, 'Zielpreis erreicht: 79,00 €');
});
