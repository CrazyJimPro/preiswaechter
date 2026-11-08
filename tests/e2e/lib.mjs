// Gemeinsame Helfer für die Browsertests.
import puppeteer from 'puppeteer';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const EXT_SRC = path.resolve(HERE, '../../extension');
export const SHOTS = path.join(HERE, 'screenshots');
const UUID = '0b6f6a3e-1c1c-4d2e-9a7a-123456789abc';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Firefox: FIREFOX_BIN oder die neueste von Puppeteer geladene Version. */
function firefoxBinary() {
  if (process.env.FIREFOX_BIN) return process.env.FIREFOX_BIN;
  const root = path.join(os.homedir(), '.cache/puppeteer/firefox');
  const dirs = fs.existsSync(root) ? fs.readdirSync(root).sort().reverse() : [];
  for (const d of dirs) {
    const bin = path.join(root, d, 'firefox', 'firefox');
    if (fs.existsSync(bin)) return bin;
  }
  throw new Error('Kein Firefox für Puppeteer gefunden – "npm run setup" in tests/e2e ausführen.');
}

/**
 * Testkopie der Erweiterung: Zugriff auf alle Seiten vorab erteilt (kein Dialog im Test),
 * in Firefox öffnet sie zusätzlich eine Steuerseite, weil das Testwerkzeug
 * Erweiterungsseiten dort nicht selbst aufrufen darf.
 */
function prepareExtension(which) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `preiswaechter-e2e-${which}-`));
  fs.cpSync(EXT_SRC, dir, { recursive: true });
  const mf = path.join(dir, 'manifest.json');
  const m = JSON.parse(fs.readFileSync(mf, 'utf8'));
  m.host_permissions = ['<all_urls>'];
  fs.writeFileSync(mf, JSON.stringify(m, null, 2));
  if (which === 'firefox') {
    fs.appendFileSync(path.join(dir, 'background.js'),
      "\napi.runtime.onInstalled.addListener(() => api.tabs.create({ url: api.runtime.getURL('popup/popup.html?ctl') })); // NUR TEST\n");
  }
  return dir;
}

/** Kleiner Test-Shop. routes: { '/pfad': () => html | {status, body} } */
export function startShop(routes) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const route = routes[req.url.split('?')[0]];
      let out = route ? route() : { status: 404, body: '' };
      if (typeof out === 'string') out = { status: 200, body: out };
      res.writeHead(out.status, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      res.end(out.body);
    }).listen(0, '127.0.0.1', () => {
      resolve({ base: `http://127.0.0.1:${server.address().port}`, close: () => server.close() });
    });
  });
}

export async function setup(which) {
  const extDir = prepareExtension(which);
  let browser;
  if (which === 'chrome') {
    browser = await puppeteer.launch({ headless: true, protocolTimeout: 60000, args: [`--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`] });
  } else {
    browser = await puppeteer.launch({
      browser: 'firefox', headless: true, protocolTimeout: 60000,
      executablePath: firefoxBinary(),
      env: { ...process.env, MOZ_REMOTE_ALLOW_SYSTEM_ACCESS: '1' },
      extraPrefsFirefox: { 'extensions.webextensions.uuids': JSON.stringify({ 'preiswaechter@crazyjimpro': UUID }) },
    });
    await browser.installExtension(extDir);
  }

  const realUrl = async (pg) => { try { return await pg.evaluate(() => location.href); } catch { return pg.url(); } };
  const findPage = async (part, skip) => {
    // Firefox meldet neue Hintergrund-Tabs manchmal erst nach einigen Sekunden
    for (let i = 0; i < 120; i++) {
      for (const pg of await browser.pages()) if (pg !== skip && (await realUrl(pg)).includes(part)) return pg;
      await sleep(250);
    }
    const urls = await Promise.all((await browser.pages()).map(realUrl));
    throw new Error(`Seite nicht gefunden: ${part} (offen: ${urls.join(', ')})`);
  };

  let extBase;
  let ctl;
  if (which === 'chrome') {
    const sw = await browser.waitForTarget((t) => t.type() === 'service_worker', { timeout: 15000 });
    extBase = `chrome-extension://${new URL(sw.url()).host}`;
    ctl = await browser.newPage();
    await ctl.goto(`${extBase}/popup/popup.html?ctl`);
  } else {
    extBase = `moz-extension://${UUID}`;
    ctl = await findPage('popup.html?ctl');
  }

  const API = '(globalThis.browser ?? globalThis.chrome)';
  const errors = [];
  const t = {
    which, browser, extBase, ctl, API, errors, findPage, realUrl,
    ok(cond, msg) { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) errors.push(msg); },
    /** Code mit Zugriff auf die Erweiterungs-API ausführen; `arg` ist als Variable verfügbar. */
    call: (body, arg) => ctl.evaluate(new Function('arg', body.replaceAll('API', API)), arg),
    storage: () => ctl.evaluate(new Function(`return ${API}.storage.local.get(null)`)),
    send: (msg) => ctl.evaluate(new Function('msg', `return ${API}.runtime.sendMessage(msg)`), msg),
    async product(match) {
      const all = await t.storage();
      const p = Object.entries(all).filter(([k]) => k.startsWith('product:')).map(([, v]) => v).find((x) => x.url.includes(match) || x.id === match);
      return { p, hist: p ? all['history:' + p.id] : null, all };
    },
    async patchProduct(id, patch) {
      await t.call(`const k='product:'+arg.id; return API.storage.local.get(k).then(r=>{Object.assign(r[k], arg.patch); return API.storage.local.set(r)})`, { id, patch });
    },
    async openExtPage(rel, { active = true } = {}) {
      if (which === 'chrome' && active) {
        const pg = await browser.newPage();
        await pg.goto(`${extBase}/${rel}`);
        return pg;
      }
      const marker = rel.includes('?') ? rel : `${rel}?t=${Date.now()}`;
      await t.call('return API.tabs.create({url: arg.url, active: arg.active})', { url: `${extBase}/${marker}`, active });
      return findPage(marker, ctl);
    },
    async activate(pg) {
      if (which === 'chrome') return pg.bringToFront();
      return pg.evaluate(() => browser.tabs.getCurrent().then((x) => browser.tabs.update(x.id, { active: true })));
    },
    async click(pg, sel) {
      if (which === 'chrome') return pg.click(sel);
      return pg.evaluate((s) => document.querySelector(s).click(), sel);
    },
    async shot(pg, name, opts = {}) {
      fs.mkdirSync(SHOTS, { recursive: true });
      try { await pg.screenshot({ path: path.join(SHOTS, `${which}-${name}.png`), ...opts }); } catch { /* Firefox: privilegierte Seiten */ }
    },
    async close() {
      await browser.close().catch(() => {});
      fs.rmSync(extDir, { recursive: true, force: true });
    },
  };
  return t;
}
