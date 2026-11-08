// Preiswächter – Hauptprozess
import { app, BrowserWindow, Menu, clipboard, ipcMain, net, protocol, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createStore } from './store.js';
import { createChecker } from './checker.js';
import { isWebUrl, readPage } from './reader.js';
import '../lib/priceParser.js';
import '../lib/extract.js';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCHEME = 'preiswaechter';
const START_URL = `${SCHEME}://app/renderer/index.html`;

// Getrennte Daten für Tests
if (process.env.PREISWAECHTER_USERDATA) app.setPath('userData', process.env.PREISWAECHTER_USERDATA);

protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

let mainWindow = null;
let store = null;
let checker = null;

// Nur Einstellungen, die die Oberfläche ändern darf
const PRODUCT_FIELDS = ['intervalMin', 'targetPrice', 'dropThreshold', 'notifyStock', 'paused', 'nextCheck'];

const methods = {
  listProducts: () => store.listProducts(),
  getHistory: (id) => store.getHistory(id),
  getProduct: (id) => store.getProduct(id),
  getSettings: () => store.getSettings(),
  deleteProduct: (id) => store.deleteProduct(id),
  updateProduct(id, patch) {
    const clean = {};
    for (const k of PRODUCT_FIELDS) if (patch && k in patch) clean[k] = patch[k];
    return store.updateProduct(id, clean);
  },
  async analyseUrl(url) {
    const norm = isWebUrl(url) ? globalThis.Preiswaechter.normalizeProductUrl(url) : url;
    const tracked = store.findProductByUrl(norm);
    const { result, status, error } = await readPage(url);
    return { result, status, error, tracked };
  },
  addProduct: (data) => store.addProduct(data),
  async checkNow(id) {
    const ev = await checker.checkProduct(id);
    return { product: ev && ev.product, error: ev && ev.error };
  },
  openExternal(url) {
    if (isWebUrl(url)) shell.openExternal(url);
  },
  /** Internetadresse aus der Zwischenablage, sonst null. */
  async clipboardUrl() {
    const text = String(await clipboard.readText()).trim();
    return isWebUrl(text) && !/\s/.test(text) ? text : null;
  },
};

function fromOwnPage(event) {
  try {
    return new URL(event.senderFrame.url).protocol === `${SCHEME}:`;
  } catch {
    return false;
  }
}

function setupIpc() {
  ipcMain.handle('pw', (event, method, ...args) => {
    if (!fromOwnPage(event) || !Object.hasOwn(methods, method)) throw new Error('Nicht erlaubt');
    return methods[method](...args);
  });
}

function setupProtocol() {
  protocol.handle(SCHEME, (request) => {
    const { pathname } = new URL(request.url);
    const file = path.normalize(path.join(SRC, decodeURIComponent(pathname)));
    const allowed = ['renderer', 'lib'].some((dir) => file.startsWith(path.join(SRC, dir) + path.sep));
    if (!allowed) return new Response('Nicht gefunden', { status: 404 });
    return net.fetch(pathToFileURL(file).href);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    minWidth: 480,
    minHeight: 400,
    title: 'Preiswächter',
    icon: path.join(SRC, '..', 'assets', 'icon.png'),
    show: false,
    webPreferences: {
      preload: path.join(SRC, 'preload.cjs'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  if (!process.env.PREISWAECHTER_HIDDEN) mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });
  const wc = mainWindow.webContents;
  // Links gehen in den normalen Browser, nie in das App-Fenster
  wc.setWindowOpenHandler(({ url }) => {
    if (isWebUrl(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  wc.on('will-navigate', (event, url) => {
    if (!url.startsWith(`${SCHEME}://app/`)) {
      event.preventDefault();
      if (isWebUrl(url)) shell.openExternal(url);
    }
  });
  mainWindow.loadURL(START_URL);
}

function showWindow() {
  if (!mainWindow) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showWindow);
  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    store = createStore(path.join(app.getPath('userData'), 'daten.json'));
    checker = createChecker(store);
    store.onChange(() => {
      if (mainWindow) mainWindow.webContents.send('pw:changed');
    });
    setupProtocol();
    setupIpc();
    createWindow();
  });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', () => {
    if (store) store.flush();
  });
}
