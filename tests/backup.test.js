import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBackup, planImport, mergeHistory } from '../extension/lib/backup.js';

const prod = (id, url, extra) => ({ id, url, name: `Produkt ${id}`, currency: 'EUR', currentPrice: 10, intervalMin: 60, ...extra });

test('Export → Import in leeren Speicher stellt alles wieder her', () => {
  const data = buildBackup({
    settings: { notifications: true },
    products: [prod('a', 'https://shop.de/a', { targetPrice: 8 }), prod('b', 'https://other.de/b')],
    histories: [[{ t: 1, price: 12, stock: 'in_stock' }, { t: 2, price: 10, stock: 'in_stock' }], []],
  }, 0);
  assert.equal(data.app, 'preiswaechter');
  const json = JSON.parse(JSON.stringify(data));
  const plan = planImport(json, { products: [], histories: [] }, { now: 1000 });
  assert.equal(plan.error, undefined);
  assert.equal(plan.add.length, 2);
  assert.deepEqual(plan.add[0].history.map((h) => h.price), [12, 10]);
  assert.equal(plan.add[0].product.targetPrice, 8);
  assert.equal(plan.add[0].product.id, 'a');
  assert.deepEqual(plan.origins.sort(), ['https://other.de/*', 'https://shop.de/*']);
  assert.ok(plan.add[1].product.nextCheck > plan.add[0].product.nextCheck, 'Prüfungen gestaffelt');
});

test('vorhandene Adresse: Einstellungen bleiben, Verlauf wird ergänzt', () => {
  const existing = { products: [prod('x', 'https://shop.de/a', { targetPrice: 5 })], histories: [[{ t: 2, price: 10, stock: 'in_stock' }]] };
  const data = { app: 'preiswaechter', version: 1, products: [{ ...prod('a', 'https://shop.de/a', { targetPrice: 99 }), history: [{ t: 1, price: 12 }, { t: 2, price: 10 }] }] };
  const plan = planImport(data, existing);
  assert.equal(plan.add.length, 0);
  assert.equal(plan.merge.length, 1);
  assert.equal(plan.merge[0].product.targetPrice, 5);
  assert.deepEqual(plan.merge[0].history.map((h) => h.t), [1, 2]);
});

test('gleiche ID, andere Adresse → neue ID', () => {
  const existing = { products: [prod('a', 'https://shop.de/x')], histories: [[]] };
  const plan = planImport({ app: 'preiswaechter', version: 1, products: [prod('a', 'https://shop.de/y')] }, existing, { newId: () => 'neu' });
  assert.equal(plan.add[0].product.id, 'neu');
});

test('fremde oder kaputte Dateien', () => {
  assert.ok(planImport({ foo: 1 }, { products: [], histories: [] }).error);
  assert.ok(planImport({ app: 'preiswaechter', version: 99, products: [] }, { products: [], histories: [] }).error);
  const plan = planImport({ app: 'preiswaechter', version: 1, products: [{ url: 'javascript:alert(1)', name: 'x' }, { url: 'https://a.de/', name: 5 }, null] }, { products: [], histories: [] });
  assert.equal(plan.skipped, 3);
  assert.equal(plan.add.length, 0);
});

test('Verlauf: ungültige Punkte fliegen raus, Bild-URL nur http(s)', () => {
  const plan = planImport({ app: 'preiswaechter', version: 1, products: [{
    url: 'https://a.de/p', name: 'P', imageUrl: 'javascript:x', history: [{ t: 'x', price: 1 }, { t: 5, price: -1 }, { t: 3, price: 4 }],
  }] }, { products: [], histories: [] });
  assert.deepEqual(plan.add[0].history, [{ t: 3, price: 4, stock: 'unknown' }]);
  assert.equal(plan.add[0].product.imageUrl, null);
  assert.equal(plan.add[0].product.currentPrice, 4);
});

test('mergeHistory', () => {
  assert.deepEqual(mergeHistory([{ t: 1 }, { t: 3 }], [{ t: 2 }, { t: 3 }]).map((x) => x.t), [1, 2, 3]);
});
