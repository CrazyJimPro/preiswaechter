import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import '../extension/lib/priceParser.js';
import '../extension/lib/extract.js';

const { extractFromDocument, normalizeProductUrl } = globalThis.Preiswaechter;

function run(file, url) {
  const html = readFileSync(new URL(`./fixtures/${file}`, import.meta.url), 'utf8');
  const doc = new JSDOM(html, { url }).window.document;
  return extractFromDocument(doc, url);
}

test('JSON-LD-Shop: Preis aus @graph, Kopfzeile/UVP/Rate/Zubehör ignoriert', () => {
  const r = run('jsonld-shop.html', 'https://shop.example.de/p/xy-500?utm_source=mail');
  assert.equal(r.price, 549);
  assert.equal(r.currency, 'EUR');
  assert.equal(r.hasConsensus, true);
  assert.equal(r.name, 'Kaffeevollautomat XY-500');
  assert.equal(r.imageUrl, 'https://shop.example.de/img/xy500-big.jpg');
  assert.equal(r.stockStatus, 'in_stock');
  assert.equal(r.productUrl, 'https://shop.example.de/p/xy-500');
});

test('Amazon.de: priceToPay statt Streichpreis, URL auf /dp/ASIN gekürzt', () => {
  const r = run('amazon-de.html', 'https://www.amazon.de/Sony-WH-1000XM6/dp/B0F1234567/ref=sr_1_1?keywords=sony&qid=1');
  assert.equal(r.price, 379.99);
  assert.equal(r.currency, 'EUR');
  assert.equal(r.shop, 'Amazon');
  assert.equal(r.name, 'Sony WH-1000XM6 Kabellose Kopfhörer');
  assert.equal(r.imageUrl, 'https://m.media-amazon.com/images/I/big.jpg');
  assert.equal(r.stockStatus, 'in_stock');
  assert.equal(r.productUrl, 'https://www.amazon.de/dp/B0F1234567');
});

test('Amazon.de: Ganzzahl + Nachkommastellen, nicht verfügbar', () => {
  const r = run('amazon-whole-fraction.html', 'https://www.amazon.de/dp/B000000001');
  assert.equal(r.price, 1249.5);
  assert.equal(r.stockStatus, 'out_of_stock');
});

test('eBay.de', () => {
  const r = run('ebay-de.html', 'https://www.ebay.de/itm/Nintendo-Switch-2/123456789012?hash=item1');
  assert.equal(r.price, 429);
  assert.equal(r.currency, 'EUR');
  assert.equal(r.shop, 'eBay');
  assert.equal(r.name, 'Nintendo Switch 2 Konsole');
  assert.equal(r.imageUrl, 'https://i.ebayimg.com/images/g/abc/s-l1600.jpg');
  assert.equal(r.stockStatus, 'in_stock');
  assert.equal(r.productUrl, 'https://www.ebay.de/itm/123456789012');
});

test('Magento 2: finalPrice statt oldPrice, Lager "unavailable"', () => {
  const r = run('magento.html', 'https://werkzeug.example.de/akkuschrauber.html');
  assert.equal(r.price, 149.9);
  assert.equal(r.shop, 'Magento');
  assert.equal(r.name, 'Akkuschrauber 18V Profi');
  assert.equal(r.stockStatus, 'out_of_stock');
});

test('OpenGraph-Preis + Seitentext stimmen überein', () => {
  const r = run('og-meta.html', 'https://shop.example/air2');
  assert.equal(r.price, 89.95);
  assert.equal(r.hasConsensus, true);
  assert.equal(r.stockStatus, 'out_of_stock');
  assert.equal(r.imageUrl, 'https://cdn.shop.example/air2.jpg');
});

test('Widersprüchliche Quellen → Auswahl, JSON-LD zuerst', () => {
  const r = run('conflict.html', 'https://shop.example/monitor');
  assert.equal(r.hasConsensus, false);
  assert.equal(r.options.length, 2);
  assert.equal(r.options[0].price, 299);
  assert.equal(r.options[1].price, 279);
});

test('Seite ohne Preis', () => {
  const r = run('noprice.html', 'https://blog.example/kaffee');
  assert.equal(r.price, null);
  assert.equal(r.options.length, 0);
});

test('normalizeProductUrl entfernt Tracking, behält Varianten-Parameter', () => {
  assert.equal(
    normalizeProductUrl('https://shop.example/p/1?color=rot&utm_campaign=x&gclid=abc#reviews'),
    'https://shop.example/p/1?color=rot',
  );
});
