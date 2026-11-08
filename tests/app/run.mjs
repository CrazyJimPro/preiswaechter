// App-Test: startet die echte Electron-App unsichtbar und bedient sie über die
// Debug-Schnittstelle, mit einem kleinen Test-Shop, dessen Preis sich ändern lässt.
// Aufruf: node tests/app/run.mjs [Programmdatei] [Zusatzargumente]
import { spawn, spawnSync } from 'node:child_process';
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
const within = (ms, promise) => Promise.race([
  promise,
  new Promise((resolve, reject) => setTimeout(() => reject(new Error('Frist abgelaufen')), ms)),
]);
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
  if (route === '/konflikt2.html') {
    return send(200, `<!doctype html><html><head><title>K2</title><script type="application/ld+json">{"@type":"Product","name":"Fensterprodukt","offers":{"price":"${state.price}","priceCurrency":"EUR"}}</script></head><body><h1>F</h1></body></html>`);
  }
  if (route === '/blog.html') return send(200, '<!doctype html><html><head><title>Blog</title></head><body><h1>Text ohne Preis</h1></body></html>');
  return send(404, 'weg');
});
await new Promise((r) => shop.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${shop.address().port}`;

// Eine liegengebliebene Testinstanz würde den Test still an die falsche App hängen
const portBusy = await fetch(`http://127.0.0.1:${PORT}/json/version`, { signal: AbortSignal.timeout(3000) }).then(() => true, (err) => err.name === 'TimeoutError');
if (portBusy) {
  console.error(`Port ${PORT} ist belegt: Eine frühere Testinstanz läuft noch. Bitte erst beenden.`);
  process.exit(2);
}

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-app-'));
const [bin, ...binArgs] = process.argv.slice(2);
const cmd = bin || path.join(ROOT, 'node_modules/.bin/electron');
const args = [...(bin ? binArgs : [ROOT]), `--remote-debugging-port=${PORT}`];
const launch = (extraEnv = {}) => spawn(cmd, args, { env: {
  ...process.env,
  PREISWAECHTER_USERDATA: userData,
  PREISWAECHTER_TEST: '1',
  // Autostart und Startmenü-Eintrag nicht im echten Profil anlegen
  XDG_CONFIG_HOME: path.join(userData, 'xdg-config'),
  XDG_DATA_HOME: path.join(userData, 'xdg-data'),
  ...(SHOTS_ON ? {} : { PREISWAECHTER_HIDDEN: '1' }),
  PREISWAECHTER_FAKE_LATEST: '9.9.9', // Tests sollen nicht von GitHub abhängen
  ...extraEnv,
}, stdio: ['ignore', 'pipe', 'pipe'] });
let log = '';
let child = launch();
const watchLog = (c) => {
  c.stdout.on('data', (d) => { log += d; });
  c.stderr.on('data', (d) => { log += d; });
};
watchLog(child);

let browser;
let relaunchedPid = null; // Windows: Nach der Übergabe ist die neue App kein Kindprozess des Tests mehr
let newerChild = null;
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

  console.log('Version und Update-Hinweis');
  const pkgVersion = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
  await page.waitForFunction(() => document.getElementById('app-version').textContent !== '', { timeout: 3000 });
  ok((await page.evaluate(() => document.getElementById('app-version').textContent)) === `v${pkgVersion}`, `Version im Kopf: v${pkgVersion}`);
  ok((await page.evaluate(() => document.getElementById('update-badge').textContent)) === 'Update verfügbar: v9.9.9' && (await page.evaluate(() => !document.getElementById('update-badge').hidden)), 'Abzeichen „Update verfügbar: v9.9.9“');
  ok(await page.evaluate(() => document.getElementById('updated-banner').hidden), 'beim ersten Start kein „Aktualisiert“');
  await page.evaluate(() => { location.hash = '#/einstellungen'; });
  await sleep(200);
  await page.evaluate(() => document.getElementById('o-check-update').click());
  await page.waitForFunction(() => document.getElementById('o-update-result').textContent.includes('9.9.9'), { timeout: 3000 });
  ok(true, 'Knopf „Nach Updates suchen“ meldet neue Version');
  await call('setFakeLatest', pkgVersion);
  await page.evaluate(() => document.getElementById('o-check-update').click());
  await page.waitForFunction(() => document.getElementById('o-update-result').textContent.includes('neueste Version'), { timeout: 3000 });
  ok(true, 'Knopf meldet: neueste Version');
  await call('setFakeLatest', '9.9.9');
  await page.evaluate(() => { location.hash = ''; });
  await sleep(200);

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

  console.log('Seit dem Hinzufügen');
  ok((await productBy('p.html')).addedPrice === 549, 'Preis beim Hinzufügen gemerkt: 549');
  await page.waitForFunction(() => [...document.querySelectorAll('.card')].some((c) => c.innerText.includes('Seit Hinzufügen: ▼ 105,00')), { timeout: 3000 }).then(() => ok(true, 'Karte: Seit Hinzufügen ▼ 105,00 €'), () => ok(false, 'Karte: Seit Hinzufügen ▼ 105,00 €'));
  ok(await page.evaluate(() => [...document.querySelectorAll('.card')].some((c) => c.innerText.includes('Seit Hinzufügen unverändert'))), 'Karte: unverändert beim anderen Produkt');
  await page.evaluate(() => { const o = document.getElementById('sort'); o.value = 'since'; o.dispatchEvent(new Event('change')); });
  ok((await page.evaluate(() => document.querySelector('.card .name').textContent)).includes('Kaffeevollautomat'), 'Sortierung: größte Ersparnis zuerst');
  await page.evaluate(() => { const o = document.getElementById('sort'); o.value = 'new'; o.dispatchEvent(new Event('change')); });

  console.log('Detailansicht');
  await page.evaluate((id) => { location.hash = `#/p/${id}`; }, p.id);
  await page.waitForSelector('#chart svg', { timeout: 5000 });
  ok((await page.evaluate(() => document.getElementById('d-price').textContent)).includes('444,00'), 'Preis im Kopf');
  ok((await page.evaluate(() => document.getElementById('d-change').textContent)) === '', 'bei nur einer Änderung nichts doppelt');
  const sinceLine = await page.evaluate(() => document.getElementById('d-since').textContent);
  ok(sinceLine.includes('549,00') && sinceLine.includes('▼ 105,00'), `Kopf: ${sinceLine}`);
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

  console.log('Benachrichtigungen');
  const added = await call('addProduct', { url: `${BASE}/p.html`, name: 'Monitor', price: 100, currency: 'EUR', stockStatus: 'out_of_stock' });
  await call('updateProduct', added.id, { targetPrice: 80, dropThreshold: 10 });
  const seen = async () => (await call('testState')).notifications.map((n) => n.title);
  const before = (await seen()).length;
  state.price = 95;
  await call('checkNow', added.id);
  let titles = (await seen()).slice(before);
  ok(titles.length === 1 && titles[0] === 'Wieder lieferbar', `100 → 95 (−5 %, Schwelle 10 %) + wieder lieferbar: nur „Wieder lieferbar“ (${titles})`);
  state.price = 85;
  await call('checkNow', added.id);
  titles = (await seen()).slice(before);
  ok(titles.at(-1) === 'Preis gesunken um 10,5 %', `95 → 85: ${titles.at(-1)}`);
  state.price = 79;
  await call('checkNow', added.id);
  titles = (await seen()).slice(before);
  ok(titles.at(-1).startsWith('Zielpreis erreicht'), `85 → 79 unter Ziel 80: ${titles.at(-1)}`);

  console.log('Markierung „günstiger geworden“');
  ok((await call('getUnread')).includes(added.id), 'Produkt als neu gemerkt');
  await page.waitForFunction(() => document.querySelector('.card.fresh'), { timeout: 3000 });
  ok(true, 'Karte markiert');
  await page.evaluate((id) => { location.hash = `#/p/${id}`; }, added.id);
  await sleep(300);
  ok(!(await call('getUnread')).includes(added.id), 'Detailansicht öffnen setzt zurück');
  await page.evaluate(() => { location.hash = ''; });
  await sleep(200);

  console.log('Automatische Prüfung (bis 90 s)');
  state.price = 70;
  await call('updateProduct', added.id, { nextCheck: 0 });
  const t0 = Date.now();
  let auto = false;
  for (let i = 0; i < 90 && !auto; i++) { await sleep(1000); auto = (await productBy('p.html')).currentPrice === 70; }
  ok(auto, `Preis 70 von selbst nach ${Math.round((Date.now() - t0) / 1000)} s`);
  const after = await productBy('p.html');
  ok(after.nextCheck > Date.now() + 50 * 60e3, 'nächste Prüfung in ca. 1 Stunde');
  await call('updateProduct', added.id, { paused: true, nextCheck: 0 });
  state.price = 65;
  await call('checkAll');
  ok((await productBy('p.html')).currentPrice === 70, 'pausiertes Produkt wird übersprungen');
  await call('updateProduct', added.id, { paused: false, nextCheck: Date.now() + 3600e3 });

  console.log('Einstellungen');
  await page.evaluate(() => { location.hash = '#/einstellungen'; });
  await page.waitForFunction(() => !document.getElementById('settings-view').hidden && document.querySelectorAll('#o-interval option').length > 0, { timeout: 3000 });
  ok(/Version \d/.test(await page.evaluate(() => document.getElementById('o-version').textContent)), 'Version angezeigt');
  await shot('einstellungen');
  await page.evaluate(() => document.getElementById('o-notifications').click());
  await sleep(100);
  ok((await call('getSettings')).notifications === false, 'Benachrichtigungen aus');
  const countOff = (await seen()).length;
  state.price = 60;
  await call('checkNow', added.id);
  ok((await seen()).length === countOff, 'ausgeschaltet: keine neue Meldung');
  await page.evaluate(() => document.getElementById('o-notifications').click());
  await page.evaluate(() => document.getElementById('o-test').click());
  await sleep(200);
  ok((await seen()).at(-1) === 'Preiswächter: Test', 'Testbenachrichtigung');
  await page.evaluate(() => { const s = document.getElementById('o-interval'); s.value = '360'; s.dispatchEvent(new Event('change')); });
  await page.evaluate(() => document.getElementById('o-apply-all').click());
  await sleep(300);
  ok((await call('getSettings')).defaultIntervalMin === 360 && (await productBy('p.html')).intervalMin === 360, 'Intervall für alle übernommen');
  const auto1 = await page.evaluate(() => window.pw.call('setAutostart', true));
  ok(auto1 === true && (await call('testState')).autostart === true, 'Autostart an');
  const auto2 = await page.evaluate(() => window.pw.call('setAutostart', false));
  ok(auto2 === false, 'Autostart aus');

  console.log('Design');
  const isDark = () => page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches);
  const bodyBg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const pickTheme = async (value) => {
    await page.evaluate((v) => { const t = document.getElementById('o-theme'); t.value = v; t.dispatchEvent(new Event('change')); }, value);
    await sleep(300);
  };
  ok((await call('getSettings')).theme === 'system', 'Standard: wie das System');
  await pickTheme('dark');
  ok((await isDark()) && (await bodyBg()) === 'rgb(22, 27, 27)', `Dunkel: Hintergrund ${await bodyBg()}`);
  ok((await call('getSettings')).theme === 'dark', 'Dunkel gespeichert');
  await shot('dunkel-einstellungen');
  await page.evaluate(() => { location.hash = ''; });
  await sleep(300);
  await shot('dunkel-uebersicht');
  await page.evaluate((id) => { location.hash = `#/p/${id}`; }, added.id);
  await page.waitForSelector('#chart svg', { timeout: 5000 });
  await sleep(300);
  await shot('dunkel-detail');
  await page.evaluate(() => { location.hash = '#/einstellungen'; });
  await sleep(300);
  ok((await page.evaluate(() => document.getElementById('o-theme').value)) === 'dark', 'Auswahl zeigt Dunkel');
  await pickTheme('light');
  ok(!(await isDark()) && (await bodyBg()) === 'rgb(255, 255, 255)', `Hell: Hintergrund ${await bodyBg()}`);
  await call('saveSettings', { theme: 'lila' });
  ok((await call('getSettings')).theme === 'light', 'unbekanntes Design abgelehnt');
  await pickTheme('dark');
  await pickTheme('system');
  ok((await call('testState')).themeSource === 'system', 'zurück auf System');

  console.log('Sicherung');
  const backupFile = path.join(userData, 'sicherung.json');
  await call('exportBackup', backupFile);
  const backup = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
  const countProducts = (await call('listProducts')).length;
  ok(backup.app === 'preiswaechter' && backup.products.length === countProducts, `Sicherung mit ${countProducts} Produkten`);
  for (const x of await call('listProducts')) await call('deleteProduct', x.id);
  let plan = await call('pickBackup', backupFile);
  ok(plan.add === countProducts, `Vorschau: ${plan.add} neue Produkte`);
  await call('applyImport');
  const back = await productBy('p.html');
  ok((await call('listProducts')).length === countProducts && back.targetPrice === 80 && back.addedPrice === 100 && (await call('getHistory', back.id)).length > 1, 'wiederhergestellt mit Verlauf, Zielpreis und Preis beim Hinzufügen');
  plan = await call('pickBackup', backupFile);
  ok(plan.add === 0 && plan.merge === 0, 'zweites Einspielen: nichts doppelt');
  fs.writeFileSync(`${backupFile}.x`, '{"foo":1}');
  ok(!!(await call('pickBackup', `${backupFile}.x`)).error, 'fremde Datei abgelehnt');
  await page.evaluate(() => { location.hash = ''; });

  console.log('Sichtbares Fenster (Captcha)');
  state.price = 55;
  const shown = page.evaluate((u) => window.pw.call('analyseInWindow', u), `${BASE}/konflikt2.html`);
  let extra = null;
  for (let i = 0; i < 40 && !extra; i++) {
    extra = (await browser.pages()).find((x) => x.url().includes('konflikt2'));
    if (!extra) await sleep(250);
  }
  ok(!!extra, 'Fenster geöffnet');
  await sleep(500);
  await call('closeOtherWindows');
  const shownRes = await shown;
  ok(shownRes.result && shownRes.result.price === 55, `beim Schließen gelesen (${shownRes.result && shownRes.result.price})`);

  ok(pageErrors.length === 0, `keine Skriptfehler (${pageErrors.join('; ')})`);

  await call('saveSettings', { theme: 'dark' }); // für die Prüfung nach dem Neustart

  console.log('Hintergrund');
  ok((await call('testState')).windowOpen === true, 'Fenster offen');
  page.evaluate(() => window.pw.call('closeWindow')).catch(() => {});
  await sleep(1500);
  if (process.env.OHNE_INFOBEREICH) console.log('  (ohne Infobereich: übersprungen)');
  else ok(child.exitCode == null && child.signalCode == null, 'App läuft nach dem Schließen des Fensters weiter');

  console.log('Daten überleben den Neustart');
  browser.disconnect();
  child.kill('SIGTERM');
  for (let i = 0; i < 20 && child.exitCode == null && child.signalCode == null; i++) await sleep(250);
  const saved = JSON.parse(fs.readFileSync(path.join(userData, 'daten.json'), 'utf8'));
  ok(saved.ids.length === 3, `${saved.ids.length} Produkte in der Datei`);

  console.log('Neustart');
  await sleep(1000);
  child = launch({ PREISWAECHTER_FAKE_VERSION: '9.9.9' }); // simuliert: Datei durch neue Version ersetzt
  watchLog(child);
  browser = null;
  for (let i = 0; i < 60 && !browser; i++) {
    await sleep(500);
    try { browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null }); } catch { /* startet noch */ }
  }
  if (!browser) throw new Error('Keine Verbindung nach dem Neustart');
  let again = null;
  for (let i = 0; i < 40 && !again; i++) {
    again = (await browser.pages()).find((x) => x.url().startsWith('preiswaechter://'));
    if (!again) await sleep(250);
  }
  await again.waitForSelector('#add-form', { timeout: 10000 });
  ok((await again.evaluate(() => window.pw.call('listProducts'))).length === 3, 'Produkte wieder da');
  ok(await again.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches), 'Dunkles Design bleibt erhalten');
  ok((await again.evaluate(() => getComputedStyle(document.body).backgroundColor)) === 'rgb(22, 27, 27)', 'Hintergrund nach dem Neustart dunkel');

  console.log('Nach einem Update');
  await again.waitForFunction(() => document.getElementById('app-version').textContent === 'v9.9.9', { timeout: 3000 });
  ok(await again.evaluate(() => !document.getElementById('updated-banner').hidden && document.getElementById('updated-version').textContent === '9.9.9'), 'Hinweis „Aktualisiert auf Version 9.9.9“');
  ok(await again.evaluate(() => document.getElementById('update-badge').hidden), 'kein Update-Abzeichen, wenn aktuell');
  await again.evaluate(() => document.getElementById('updated-ok').click());
  await sleep(200);
  ok(await again.evaluate(() => document.getElementById('updated-banner').hidden), '„Alles klar“ blendet den Hinweis aus');

  console.log('Neuere Datei startet, alte läuft noch');
  const oldPid = (await again.evaluate(() => window.pw.call('testState'))).pid;
  browser.disconnect();
  const newer = launch({ PREISWAECHTER_FAKE_VERSION: '10.0.0' });
  watchLog(newer);
  newerChild = newer;
  const gone = (c) => c.exitCode != null || c.signalCode != null;
  if (process.platform === 'linux') {
    // Die neue App übernimmt selbst: Die alte ist weg, die neue läuft weiter und hat die Daten geöffnet
    for (let i = 0; i < 40 && !gone(child); i++) await sleep(250);
    await sleep(4000);
    const appLog = fs.readFileSync(path.join(userData, 'logs', 'preiswaechter.log'), 'utf8');
    const afterHandover = appLog.slice(appLog.lastIndexOf('diese App beendet sich'));
    ok(gone(child), 'alte App beendet');
    ok(!gone(newer) && afterHandover.includes('gestartet'), 'neue App übernimmt und läuft weiter');
    // Auch der zweite Fall: Gleiche Version nochmal gestartet, die laufende bleibt
    const same = launch({ PREISWAECHTER_FAKE_VERSION: '10.0.0' });
    watchLog(same);
    for (let i = 0; i < 48 && !gone(same); i++) await sleep(250);
    ok(gone(same) && !gone(newer), 'gleiche Version: laufende App bleibt, zweiter Start geht wieder');
  } else {
    let swapped = null;
    for (let i = 0; i < 40 && !swapped; i++) {
      await sleep(500);
      let b = null;
      try {
        b = await within(3000, puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null, protocolTimeout: 3000 }));
        const pg = (await within(3000, b.pages())).find((x) => x.url().startsWith('preiswaechter://'));
        if (pg) {
          const st = await within(3000, pg.evaluate(() => window.pw.call('testState')));
          if (st.pid !== oldPid) swapped = st;
        }
      } catch { /* Übergabe läuft noch */ }
      if (b) { try { b.disconnect(); } catch { /* schon getrennt */ } }
    }
    ok(!!swapped, `alte App beendet, neue läuft (PID ${oldPid} → ${swapped && swapped.pid})`);
    if (swapped) relaunchedPid = swapped.pid;
  }
} catch (e) {
  errors.push(`Abbruch: ${e && e.stack || e}`);
} finally {
  child.kill('SIGTERM');
  if (relaunchedPid) { try { process.kill(relaunchedPid, 'SIGTERM'); } catch { /* schon beendet */ } }
  if (newerChild) newerChild.kill('SIGTERM');
  // Was auch immer übrig ist, darf den Port für den nächsten Lauf nicht blockieren
  if (process.platform !== 'win32') spawnSync('pkill', ['-f', `remote-debugging-port=${PORT}`]);
  shop.close();
  // Unter Windows kann die App die Dateien noch kurz festhalten
  await sleep(1000);
  try { fs.rmSync(userData, { recursive: true, force: true }); } catch { /* temporärer Ordner, egal */ }
}
console.log(errors.length ? `FEHLER:\n- ${errors.join('\n- ')}\n--- App-Ausgabe:\n${log.slice(-1500)}` : 'ALLES OK');
process.exit(errors.length ? 1 : 0);
