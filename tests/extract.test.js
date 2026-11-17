import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import '../src/lib/priceParser.js';
import '../src/lib/extract.js';

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
  assert.equal(r.uvp, null, 'durchgestrichener Preis ohne Beschriftung ist keine UVP');
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
  assert.equal(r.uvp, null, 'Streichpreis ohne „UVP“ zählt nicht');
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

test('Büromarkt Böttcher: Bruttopreis für 1 Stück statt Netto-„ab“-Preis, Empfehlungen ignoriert', () => {
  const r = run('bueromarkt-staffel.html', 'https://www.bueromarkt-ag.de/usv_eaton_3s_850_din_3s850d_8_ausgaenge,p-101778.html');
  assert.equal(r.price, 164.21);
  assert.equal(r.currency, 'EUR');
  assert.equal(r.shop, 'Büromarkt Böttcher');
  assert.equal(r.hasConsensus, true);
  assert.equal(r.name, 'EATON USV 3S 850 DIN, 3S850D, 8 Ausgänge, Schuko, 850 VA');
  assert.equal(r.imageUrl, 'https://cdn.bueromarkt-ag.de/product/abc/usv.jpg');
  assert.equal(r.stockStatus, 'in_stock');
});

test('Büromarkt Böttcher: ohne Staffel der Bruttopreis des Hauptpreises, nicht lieferbar', () => {
  const r = run('bueromarkt-einzelpreis.html', 'https://www.bueromarkt-ag.de/pc_lautsprecher_logitech_z150,p-123456.html');
  assert.equal(r.price, 29.74);
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

test('MediaMarkt-Aufbau: BuyAction → ProductGroup, Hauptangebot statt Variante/Zubehör', () => {
  const r = run('buyaction-group.html', 'https://www.mediamarkt.de/de/product/_kaffeemaschine-1.html');
  assert.equal(r.price, 39.99);
  assert.equal(r.currency, 'EUR');
  assert.equal(r.name, 'Testmarke Kaffeemaschine Schwarz');
  assert.equal(r.stockStatus, 'in_stock');
});

test('Seite ohne Preis', () => {
  const r = run('noprice.html', 'https://blog.example/kaffee');
  assert.equal(r.price, null);
  assert.equal(r.options.length, 0);
});

test('UVP Amazon: beschriftete UVP im Preisblock, Empfehlungen ignoriert', () => {
  const r = run('amazon-uvp.html', 'https://www.amazon.de/dp/B0DRXRH9DQ?th=1');
  assert.equal(r.price, 67.99);
  assert.equal(r.uvp, 99.99);
});

test('UVP Amazon: „Niedrigster Preis in 30 Tagen“ ist keine UVP, Beschreibung zählt nicht', () => {
  const r = run('amazon-30tage.html', 'https://www.amazon.de/dp/B000000002');
  assert.equal(r.price, 49.99);
  assert.equal(r.uvp, null);
});

test('UVP Shop: „Unverbindliche Preisempfehlung“, Kopfzeile/Empfehlungen/Ersparnis/Streichpreis ignoriert', () => {
  const r = run('uvp-shop.html', 'https://shop.example/standmixer-m3');
  assert.equal(r.price, 119);
  assert.equal(r.uvp, 159);
});

test('UVP Shop: zwei verschiedene UVPs → unbekannt', () => {
  const r = run('uvp-mehrdeutig.html', 'https://shop.example/k1');
  assert.equal(r.price, 79);
  assert.equal(r.uvp, null);
});

test('UVP aus JSON-LD: priceType ListPrice', () => {
  const r = run('jsonld-listprice.html', 'https://shop.example/r9');
  assert.equal(r.price, 189.9);
  assert.equal(r.uvp, 249.99);
});

test('normalizeProductUrl entfernt Tracking, behält Varianten-Parameter', () => {
  assert.equal(
    normalizeProductUrl('https://shop.example/p/1?color=rot&utm_campaign=x&gclid=abc#reviews'),
    'https://shop.example/p/1?color=rot',
  );
});
