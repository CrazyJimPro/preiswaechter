import { test } from 'node:test';
import assert from 'node:assert/strict';
import { historyCsv, csvFileName } from '../src/lib/csv.js';
import { displayName, cleanText } from '../src/lib/format.js';
import { notificationText } from '../src/lib/rules.js';
import { buildBackup, planImport } from '../src/lib/backup.js';

const T = new Date(2026, 10, 1, 9, 30).getTime();
const product = { name: 'Kaffee; "Deluxe"', url: 'https://shop.de/k', currency: 'EUR' };

test('historyCsv: Semikolon, Dezimalkomma, Änderung, Maskierung', () => {
  const csv = historyCsv(product, [
    { t: T + 864e5, price: 89.5, stock: 'out_of_stock' },
    { t: T, price: 100, stock: 'in_stock' },
  ]);
  const lines = csv.split('\r\n');
  assert.equal(lines[0], 'Produkt;"Kaffee; ""Deluxe"""');
  assert.equal(lines[3], 'Zeitpunkt;Preis;Währung;Änderung;Änderung in %;Lagerstatus');
  assert.equal(lines[4], '01.11.2026 09:30;100,00;EUR;;;Lieferbar');
  assert.equal(lines[5], '02.11.2026 09:30;89,50;EUR;-10,50;-10,5;Nicht lieferbar');
  assert.ok(csv.endsWith('\r\n'));
});

test('csvFileName: nur sichere Zeichen, eigener Name zählt', () => {
  assert.equal(csvFileName({ name: 'Größe: 10/20 Äpfel' }, T), 'preisverlauf-grosse-10-20-apfel-2026-11-01.csv');
  assert.equal(csvFileName({ name: 'x', customName: 'Meine SSD' }, T), 'preisverlauf-meine-ssd-2026-11-01.csv');
  assert.equal(csvFileName({ name: '!!!' }, T), 'preisverlauf-produkt-2026-11-01.csv');
});

test('displayName und cleanText', () => {
  assert.equal(displayName({ name: 'Shopname', customName: '  ' }), 'Shopname');
  assert.equal(displayName({ name: 'Shopname', customName: 'Mein Name' }), 'Mein Name');
  assert.equal(cleanText('  a\r\nb  ', 10), 'a\nb');
  assert.equal(cleanText('', 10), null);
  assert.equal(cleanText(5, 10), null);
  assert.equal(cleanText('abcdef', 3), 'abc');
});

test('Benachrichtigung nutzt den eigenen Namen', () => {
  const n = notificationText({ kind: 'stock', newPrice: 5 }, { name: 'Langer Shopname', customName: 'Lampe' }, String);
  assert.ok(n.message.startsWith('Lampe\n'));
});

test('Sicherung nimmt eigenen Namen und Notiz mit', () => {
  const data = JSON.parse(JSON.stringify(buildBackup({
    settings: {},
    products: [{ id: 'a', url: 'https://shop.de/a', name: 'A', customName: 'Mein A', note: 'Notiz', intervalMin: 60 }],
    histories: [[]],
  })));
  const plan = planImport(data, { products: [], histories: [] });
  assert.equal(plan.add[0].product.customName, 'Mein A');
  assert.equal(plan.add[0].product.note, 'Notiz');
});
