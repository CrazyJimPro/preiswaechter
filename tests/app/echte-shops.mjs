// Handprobe an echten Shops: Was erkennt die App? Nur lesen, nichts wird gekauft oder gespeichert.
// Aufruf: node tests/app/echte-shops.mjs <Link> [<Link> …]
// Programmdatei optional über PREISWAECHTER_BIN (sonst Entwicklerversion).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PORT = 9348;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const urls = process.argv.slice(2);
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'pw-echt-'));
const bin = process.env.PREISWAECHTER_BIN;
const child = spawn(bin || path.join(ROOT, 'node_modules/.bin/electron'), [...(bin ? [] : [ROOT]), `--remote-debugging-port=${PORT}`], {
  env: {
    ...process.env,
    PREISWAECHTER_USERDATA: userData,
    PREISWAECHTER_HIDDEN: '1',
    // Eine fertige Datei legt sonst Autostart und Startmenü-Eintrag im echten Profil an
    XDG_CONFIG_HOME: path.join(userData, 'xdg-config'),
    XDG_DATA_HOME: path.join(userData, 'xdg-data'),
  }, stdio: 'ignore',
});
let browser;
try {
  for (let i = 0; i < 60 && !browser; i++) {
    await sleep(500);
    try { browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${PORT}`, defaultViewport: null, protocolTimeout: 90000 }); } catch { /* startet noch */ }
  }
  let page;
  for (let i = 0; i < 40 && !page; i++) {
    page = (await browser.pages()).find((p) => p.url().startsWith('preiswaechter://'));
    if (!page) await sleep(250);
  }
  await page.waitForSelector('#add-form');
  for (const url of urls) {
    const t0 = Date.now();
    const r = await page.evaluate((u) => window.pw.call('analyseUrl', u), url);
    const x = r.result;
    const opts = x ? x.options.map((o) => `${o.price} ${o.currency} [${o.methods.join('+')}]`).join(' | ') : '-';
    console.log(`\n${new URL(url).hostname} (${((Date.now() - t0) / 1000).toFixed(1)} s, HTTP ${r.status})`);
    console.log(`  Name:  ${x ? x.name.slice(0, 80) : '-'}`);
    console.log(`  Preis: ${x && x.price != null ? x.price : '-'}  eindeutig=${x ? x.hasConsensus : '-'}  Lager=${x ? x.stockStatus : '-'}  Bild=${x && x.imageUrl ? 'ja' : 'nein'}`);
    console.log(`  Kandidaten: ${opts}${r.error ? `\n  Fehler: ${r.error}` : ''}`);
  }
} finally {
  if (browser) browser.disconnect();
  child.kill('SIGTERM');
  await sleep(500);
  fs.rmSync(userData, { recursive: true, force: true });
}
