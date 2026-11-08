// Liest eine Produktseite in einem unsichtbaren Fenster (echtes Chromium, also auch
// Shops, die den Preis erst per JavaScript anzeigen). Die Seiten sind fremder Code:
// eigener Speicherbereich, Sandbox, keine Popups, keine Downloads, keine Rechte.
import { BrowserWindow, session } from 'electron';
import fs from 'node:fs';
import { pickPrice } from '../lib/pick.js';

const PARTITION = 'persist:shops';
const LOAD_WAIT_MS = 12000;
const POLL_MS = 1500;
const POLLS = 5;
const MAX_PARALLEL = 2;
const ISOLATED_WORLD = 1000;

const libFile = (name) => new URL(`../lib/${name}`, import.meta.url);
const EXTRACT_CODE = [
  fs.readFileSync(libFile('priceParser.js'), 'utf8'),
  fs.readFileSync(libFile('extract.js'), 'utf8'),
  'globalThis.Preiswaechter.extractFromDocument(document, location.href, { live: true });',
].join('\n;\n');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let prepared = false;

function prepareSession() {
  if (prepared) return;
  prepared = true;
  const s = session.fromPartition(PARTITION);
  // Viele Shops lehnen Electron ab: als normales Chrome auftreten
  const ua = s.getUserAgent().replace(/\s(?:Electron|preiswaechter|Preisw\S*)\/\S+/gi, '');
  s.setUserAgent(ua, 'de-DE,de;q=0.9,en;q=0.7');
  s.setPermissionRequestHandler((wc, permission, cb) => cb(false));
  s.setPermissionCheckHandler(() => false);
  s.on('will-download', (event) => event.preventDefault());
}

// Höchstens zwei Fenster gleichzeitig
let active = 0;
const waiting = [];
async function slot() {
  if (active >= MAX_PARALLEL) await new Promise((r) => waiting.push(r));
  active++;
}
function release() {
  active--;
  const next = waiting.shift();
  if (next) next();
}

export function isWebUrl(url) {
  try {
    return /^https?:$/.test(new URL(url).protocol);
  } catch {
    return false;
  }
}

/**
 * Öffnet die Seite unsichtbar und liefert das Erkennungsergebnis.
 * @param {string} url
 * @param {object} [product] vorhandenes Produkt – entscheidet bei mehreren Preisen mit
 * @returns {Promise<{result: object|null, status: number|null, error: string|null}>}
 */
export async function readPage(url, product) {
  if (!isWebUrl(url)) return { result: null, status: null, error: 'Das ist keine gültige Internetadresse.' };
  prepareSession();
  await slot();
  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 900,
    webPreferences: {
      partition: PARTITION,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false, // sonst laufen Skripte versteckter Fenster gebremst
      images: false,
      webgl: false,
    },
  });
  const wc = win.webContents;
  let status = null;
  let failed = null;
  let loaded = false;
  try {
    wc.setAudioMuted(true);
    wc.setWindowOpenHandler(() => ({ action: 'deny' }));
    wc.on('will-navigate', (event, target) => { if (!isWebUrl(target)) event.preventDefault(); });
    wc.on('did-navigate', (event, target, code) => { status = code; });
    wc.on('did-finish-load', () => { loaded = true; });
    wc.on('did-fail-load', (event, code, description, target, isMainFrame) => {
      // -3 = abgebrochen, passiert bei Weiterleitungen per Skript
      if (isMainFrame && code !== -3) failed = description || `Fehler ${code}`;
    });
    wc.loadURL(url).catch(() => {}); // Fehler kommen über did-fail-load

    const start = Date.now();
    while (!loaded && !failed && Date.now() - start < LOAD_WAIT_MS) await sleep(100);
    if (failed) return { result: null, status, error: `Seite konnte nicht geladen werden (${failed}).` };

    // Nachgeladene Preise abwarten: mehrmals nachsehen, bis ein Preis gefunden ist
    let result = null;
    for (let i = 0; i < POLLS; i++) {
      try {
        result = await wc.executeJavaScriptInIsolatedWorld(ISOLATED_WORLD, [{ code: EXTRACT_CODE }]);
      } catch {
        result = null; // Seite navigiert gerade weiter
      }
      if (result && pickPrice(result, product)) return { result, status, error: null };
      await sleep(POLL_MS);
    }
    return { result, status, error: null };
  } finally {
    if (!win.isDestroyed()) win.destroy();
    release();
  }
}
