// App-Test: startet die echte Electron-App unsichtbar und bedient sie über die
// Debug-Schnittstelle, mit einem kleinen Test-Shop, dessen Preis sich ändern lässt.
// Aufruf: node tests/app/run.mjs [Programmdatei] [Zusatzargumente]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SHOTS = path.join(ROOT, 'tests/app/screenshots');
const PORT = 9347;
// Fotos gehen nur mit sichtbarem Fenster: FOTOS=1 node tests/app/run.mjs
const SHOTS_ON = !!process.env.FOTOS;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
const ok = (cond, msg) => { console.log(`  ${cond ? '✓' : '✗'} ${msg}`); if (!cond) errors.push(msg); };

const state = { price: 549, js: 77.77, seenUa: '' };
const shop = http.createServer((req, res) => {
  state.seenUa = req.headers['user-agent'] || state.seenUa;
  const route = req.url.split('?')[0];
  const send = (code, body) => { res.writeHead(code, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); res.end(body); };
  if (route === '/p.html') {
    return send(200, `<!doctype html><html><head><title>P</title><script type="application/ld+json">{"@type":"Product","name":"Kaffeevollautomat XY","offers":{"price":"${state.price}","priceCurrency":"EUR","availability":"https://schema.org/InStock"}}</script></head><body><h1>Kaffeevollautomat XY</h1></body></html>`);
  }
  if (route === '/js.html') {
    return send(200, `<!doctype html><html><head><title>JS</title></head><body><h1>JS-Produkt</h1><div class="product-price" id="p"></div><script>setTimeout(()=>{document.getElementById('p').textContent='${String(state.js).replace('.', ',')} €'},800)</script></body></html>`);
  }
  if (route === '/konflikt.html') {
    return send(200, `<!doctype html><html><head><title>K</title><script type="application/ld+json">{"@type":"Product","name":"Monitor","offers":{"price":"299.00","priceCurrency":"EUR"}}</script><meta property="product:price:amount" content="279.00"></head><body><h1>Monitor</h1></body></html>`);
  }
  if (route === '/blog.html') return send(200, '<!doctype html><html><head><title>Blog</title></head><body><h1>Text ohne Preis</h1></body></html>');
  return send(404, 'weg');
});
await new Promise((r) => shop.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${shop.address().port}`;

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-app-'));
const [bin, ...binArgs] = process.argv.slice(2);
const cmd = bin || path.join(ROOT, 'node_modules/.bin/electron');
const args = [...(bin ? binArgs : [ROOT]), `--remote-debugging-port=${PORT}`];
const child = spawn(cmd, args, { env: { ...process.env, PREISWAECHTER_USERDATA: userData, ...(SHOTS_ON ? {} : { PREISWAECHTER_HIDDEN: '1' }) }, stdio: ['ignore', 'pipe', 'pipe'] });
let log = '';
child.stdout.on('data', (d) => { log += d; });
child.stderr.on('data', (d) => { log += d; });

let browser;
try {
  for (let i = 0; i < 60 && !browser; i++) {
    await sleep(500);
    try { browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null }); } catch { /* startet noch */ }
    if (child.exitCode != null) throw new Error(`App beendet mit Code ${child.exitCode}:\n${log}`);
  }
  if (!browser) throw new Error('Keine Verbindung zur App');
  let page = null;
  for (let i = 0; i < 40 && !page; i++) {
    page = (await browser.pages()).find((p) => p.url().startsWith('preiswaechter://'));
    if (!page) await sleep(250);
  }
  if (!page) throw new Error('Hauptfenster nicht gefunden');
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_|Failed to load resource/.test(m.text())) pageErrors.push(m.text()); });
  await page.waitForSelector('#add-form', { timeout: 10000 });
  const shot = async (name) => {
    if (!SHOTS_ON) return;
    fs.mkdirSync(SHOTS, { recursive: true });
    await sleep(300);
    await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
  };
  const call = (method, ...a) => page.evaluate((m, x) => window.pw.call(m, ...x), method, a);

  async function submit(url) {
    await page.evaluate((u) => { const i = document.getElementById('add-url'); i.value = u; document.getElementById('add-form').requestSubmit(); }, url);
    await page.waitForFunction(() => {
      const box = document.getElementById('add-result');
      return !box.hidden && !box.textContent.includes('wird gelesen');
    }, { timeout: 45000 });
  }
  async function track() {
    await page.evaluate(() => document.getElementById('add-track').click());
    await page.waitForFunction(() => document.getElementById('add-result').hidden, { timeout: 5000 });
    await sleep(100);
  }
  const productBy = async (part) => (await call('listProducts')).find((p) => p.url.includes(part));

  console.log('Sicherheit und Start');
  ok((await page.evaluate(() => typeof require)) === 'undefined', 'kein Node-Zugriff in der Oberfläche');
  ok(await page.evaluate(() => window.pw.call('gibtsnicht').then(() => false, () => true)), 'unbekannte Aufrufe werden abgelehnt');
  ok((await page.evaluate(() => document.querySelector('#empty').hidden)) === false, 'Hinweis bei leerer Liste');
  ok(await page.evaluate(() => window.pw.call('clipboardUrl').then((v) => v === null || typeof v === 'string', () => false)), 'Zwischenablage lesbar');

  console.log('Produkt per Link hinzufügen');
  await submit(`${BASE}/p.html?utm_source=mail`);
  ok((await page.evaluate(() => document.querySelector('.preview .bigprice')?.textContent || '')).includes('549,00'), 'Vorschau zeigt 549,00 €');
  ok(!/Electron|preiswaechter/i.test(state.seenUa), `Shop sieht normalen Browser (${state.seenUa.slice(-40)})`);
  await shot('vorschau');
  await page.evaluate(() => { document.getElementById('add-target').value = '499,50'; });
  await track();
  let p = await productBy('p.html');
  ok(p && p.currentPrice === 549 && p.targetPrice === 499.5 && !p.url.includes('utm_'), 'gespeichert mit Zielpreis, ohne Tracking-Zusatz');
  await page.waitForFunction(() => document.querySelectorAll('.card').length === 1, { timeout: 3000 });
  ok(true, 'Karte erscheint in der Übersicht');

  console.log('Sonderfälle beim Hinzufügen');
  await submit(`${BASE}/p.html`);
  ok((await page.evaluate(() => document.getElementById('add-result').textContent)).includes('bereits verfolgt'), 'schon verfolgtes Produkt erkannt');
  await submit(`${BASE}/blog.html`);
  ok((await page.evaluate(() => document.getElementById('add-result').textContent)).includes('kein Preis'), 'Seite ohne Preis gemeldet');
  await submit('http://127.0.0.1:1/nichts');
  ok((await page.evaluate(() => document.getElementById('add-result').textContent)).includes('nicht geladen'), 'nicht erreichbare Seite gemeldet');
  await page.evaluate(() => { document.getElementById('add-url').value = 'kein link'; document.getElementById('add-form').requestSubmit(); });
  ok((await page.evaluate(() => document.getElementById('add-result').textContent)).includes('https://'), 'ungültiger Link abgelehnt');
  await submit(`${BASE}/konflikt.html`);
  ok((await page.evaluate(() => document.querySelectorAll('.preview input[type=radio]').length)) === 2, 'mehrere Preise: Auswahl');
  await page.evaluate(() => document.querySelectorAll('.preview input[type=radio]')[1].click());
  await track();
  ok((await productBy('konflikt')).currentPrice === 279, 'gewählter Preis 279 gespeichert');

  console.log('Seite, die den Preis per JavaScript anzeigt');
  await submit(`${BASE}/js.html`);
  ok((await page.evaluate(() => document.querySelector('.preview .bigprice')?.textContent || '')).includes('77,77'), 'Preis 77,77 € erkannt');
  await track();

  console.log('Jetzt prüfen');
  state.price = 444;
  p = await productBy('p.html');
  let r = await call('checkNow', p.id);
  p = await productBy('p.html');
  ok(p.currentPrice === 444 && p.previousPrice === 549 && !r.error, `neuer Preis 444 (${r.error || 'ok'})`);
  ok((await call('getHistory', p.id)).length === 2, 'Verlauf hat 2 Punkte');
  state.js = 66.66;
  const js = await productBy('js.html');
  await call('checkNow', js.id);
  ok((await productBy('js.html')).currentPrice === 66.66, 'JS-Seite: 66,66');
  const leftover = (await browser.pages()).filter((x) => x.url().includes(BASE)).length;
  ok(leftover === 0, 'keine versteckten Fenster übrig');

  console.log('Detailansicht');
  await page.evaluate((id) => { location.hash = `#/p/${id}`; }, p.id);
  await page.waitForSelector('#chart svg', { timeout: 5000 });
  ok((await page.evaluate(() => document.getElementById('d-price').textContent)).includes('444,00'), 'Preis im Kopf');
  ok((await page.evaluate(() => document.getElementById('d-change').textContent)).includes('▼ 105,00'), 'Änderung ▼ 105,00 €');
  await shot('detail');
  await page.evaluate(() => {
    const f = document.getElementById('settings');
    f.targetPrice.value = '1.050,50'; f.dropThreshold.value = '5'; f.intervalMin.value = '360'; f.requestSubmit();
  });
  await sleep(300);
  p = await productBy('p.html');
  ok(p.targetPrice === 1050.5 && p.dropThreshold === 5 && p.intervalMin === 360, 'Einstellungen je Produkt gespeichert');
  state.price = 400;
  await call('checkNow', p.id);
  await sleep(500);
  ok((await page.evaluate(() => document.getElementById('d-price').textContent)).includes('400,00'), 'neuer Preis erscheint sofort');
  await page.evaluate(() => document.getElementById('d-delete').click());
  await page.evaluate(() => document.getElementById('d-delete').click());
  await sleep(300);
  ok(!(await productBy('p.html')), 'Produkt gelöscht');
  await shot('uebersicht');
  ok(pageErrors.length === 0, `keine Skriptfehler (${pageErrors.join('; ')})`);

  console.log('Daten überleben den Neustart');
  browser.disconnect();
  child.kill('SIGTERM');
  for (let i = 0; i < 20 && child.exitCode == null && child.signalCode == null; i++) await sleep(250);
  const saved = JSON.parse(fs.readFileSync(path.join(userData, 'daten.json'), 'utf8'));
  ok(saved.ids.length === 2, `${saved.ids.length} Produkte in der Datei`);
} catch (e) {
  errors.push(`Abbruch: ${e && e.stack || e}`);
} finally {
  child.kill('SIGTERM');
  shop.close();
  fs.rmSync(userData, { recursive: true, force: true });
}
console.log(errors.length ? `FEHLER:\n- ${errors.join('\n- ')}\n--- App-Ausgabe:\n${log.slice(-1500)}` : 'ALLES OK');
process.exit(errors.length ? 1 : 0);
