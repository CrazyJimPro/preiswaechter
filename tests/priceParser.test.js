import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/lib/priceParser.js';

const { parsePrice, parseAmount } = globalThis.Preiswaechter;

const cases = [
  ['1.299,00 €', 1299, 'EUR'],
  ['1.299,- €', 1299, 'EUR'],
  ['€ 49,95', 49.95, 'EUR'],
  ['EUR 429,00', 429, 'EUR'],
  ['$1,299.99', 1299.99, 'USD'],
  ['US $12.50', 12.5, 'USD'],
  ['£19.99', 19.99, 'GBP'],
  ['CHF 1\'249.90', 1249.9, 'CHF'],
  ['12,99 €*', 12.99, 'EUR'],
  ['1 299,99 €', 1299.99, 'EUR'],
  ['nur 5 €', 5, 'EUR'],
  ['379,99 €', 379.99, 'EUR'],
  ['2.499', 2499, 'EUR'],
  ['29.99', 29.99, 'EUR'],
];

for (const [text, price, currency] of cases) {
  test(`parsePrice("${text}")`, () => {
    assert.deepEqual(parsePrice(text), { price, currency });
  });
}

for (const text of ['ab 22,88 € / Monat', '$49/mo', '4 payments of $25', 'monatlich 19,99 €', '24 x 12,50 €', '', 'kostenlos']) {
  test(`parsePrice verwirft "${text}"`, () => {
    assert.equal(parsePrice(text), null);
  });
}

test('parseAmount', () => {
  assert.equal(parseAmount('549.00'), 549);
  assert.equal(parseAmount(89.95), 89.95);
  assert.equal(parseAmount('1.299,00'), 1299);
  assert.equal(parseAmount(''), null);
  assert.equal(parseAmount('0'), null);
});
