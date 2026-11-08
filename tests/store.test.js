import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createStore } from '../src/main/store.js';

function tmpFile() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pw-store-')), 'daten.json');
}
const info = { url: 'https://shop.de/a', name: 'A', price: 10, currency: 'EUR', stockStatus: 'in_stock' };

test('Produkt anlegen, wiederfinden, doppelt verhindern', () => {
  const s = createStore(tmpFile());
  const p = s.addProduct(info);
  assert.equal(s.addProduct(info).id, p.id);
  assert.equal(s.listProducts().length, 1);
  assert.equal(s.getHistory(p.id).length, 1);
  assert.equal(p.intervalMin, 60);
  s.flush();
});

test('Daten überleben einen Neustart', () => {
  const f = tmpFile();
  const a = createStore(f);
  const p = a.addProduct(info);
  a.saveSettings({ notifications: false });
  a.flush();
  const b = createStore(f);
  assert.equal(b.getProduct(p.id).name, 'A');
  assert.equal(b.getSettings().notifications, false);
  assert.equal(b.getSettings().defaultIntervalMin, 60);
});

test('beschädigte Datei: Kopie wird geladen, kaputte Datei bleibt erhalten', () => {
  const f = tmpFile();
  const a = createStore(f);
  a.addProduct(info);
  a.flush();
  createStore(f); // legt .bak an
  fs.writeFileSync(f, '{ kaputt');
  const c = createStore(f);
  assert.equal(c.listProducts().length, 1);
  assert.ok(fs.readdirSync(path.dirname(f)).some((n) => n.includes('kaputt')));
});

test('Verlauf: gleicher Wert erst nach 6 Stunden erneut', () => {
  const s = createStore(tmpFile());
  const p = s.addProduct(info);
  const t0 = s.getHistory(p.id)[0].t;
  assert.equal(s.appendHistory(p.id, { t: t0 + 1000, price: 10, stock: 'in_stock' }), false);
  assert.equal(s.appendHistory(p.id, { t: t0 + 2000, price: 9, stock: 'in_stock' }), true);
  assert.equal(s.appendHistory(p.id, { t: t0 + 7 * 3600e3, price: 9, stock: 'in_stock' }), true);
  s.flush();
});

test('Löschen entfernt Verlauf und Markierung', () => {
  const s = createStore(tmpFile());
  const p = s.addProduct(info);
  s.addUnread(p.id);
  s.deleteProduct(p.id);
  assert.equal(s.listProducts().length, 0);
  assert.deepEqual(s.getHistory(p.id), []);
  assert.deepEqual(s.getUnread(), []);
  s.flush();
});

test('Preis beim Hinzufügen bleibt, auch wenn sich der aktuelle ändert', () => {
  const s = createStore(tmpFile());
  const p = s.addProduct(info);
  assert.equal(p.addedPrice, 10);
  s.updateProduct(p.id, { currentPrice: 7 });
  assert.equal(s.getProduct(p.id).addedPrice, 10);
  s.flush();
});
