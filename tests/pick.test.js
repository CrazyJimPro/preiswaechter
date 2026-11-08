import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickPrice, nextCheckTime, retryTime, charsetFromContentType, charsetFromHtmlHead } from '../extension/lib/pick.js';

const opt = (price, methods) => ({ price, currency: 'EUR', methods });

test('pickPrice: eindeutig', () => {
  assert.deepEqual(pickPrice({ hasConsensus: true, options: [opt(10, ['jsonld'])] }, {}), { price: 10, currency: 'EUR' });
});

test('pickPrice: nichts gefunden', () => {
  assert.equal(pickPrice({ options: [] }, {}), null);
  assert.equal(pickPrice(null, {}), null);
});

test('pickPrice: bevorzugt die vom User gewählte Methode', () => {
  const r = { hasConsensus: false, options: [opt(299, ['jsonld']), opt(279, ['meta'])] };
  assert.equal(pickPrice(r, { preferredMethods: ['meta'], currentPrice: 299 }).price, 279);
});

test('pickPrice: sonst der Kandidat nahe am letzten Preis', () => {
  const r = { hasConsensus: false, options: [opt(299, ['jsonld']), opt(49, ['generic'])] };
  assert.equal(pickPrice(r, { currentPrice: 55 }).price, 49);
  assert.equal(pickPrice(r, {}).price, 299);
});

test('nextCheckTime streut ±10 %', () => {
  const now = 1_000_000;
  assert.equal(nextCheckTime(60, now, () => 0), now + 54 * 60_000);
  assert.equal(nextCheckTime(60, now, () => 1), now + 66 * 60_000);
});

test('retryTime: 5, 10 … höchstens 30 Min., nie länger als das Intervall', () => {
  assert.equal(retryTime(60, 1, 0), 5 * 60_000);
  assert.equal(retryTime(60, 3, 0), 15 * 60_000);
  assert.equal(retryTime(60, 20, 0), 30 * 60_000);
  assert.equal(retryTime(15, 20, 0), 15 * 60_000);
});

test('Zeichensatz erkennen', () => {
  assert.equal(charsetFromContentType('text/html; charset=ISO-8859-1'), 'iso-8859-1');
  assert.equal(charsetFromContentType('text/html'), null);
  assert.equal(charsetFromHtmlHead('<head><meta charset="windows-1252">'), 'windows-1252');
  assert.equal(charsetFromHtmlHead('<meta http-equiv="Content-Type" content="text/html; charset=iso-8859-15">'), 'iso-8859-15');
});
