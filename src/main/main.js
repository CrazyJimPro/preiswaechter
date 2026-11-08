// Preiswächter – Hauptprozess
import {
  app, BrowserWindow, Notification, clipboard, dialog, ipcMain, nativeTheme, net, powerMonitor, protocol, shell,
} from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { initLog } from './log.js';
import { createStore } from './store.js';
import { createChecker } from './checker.js';
import { isWebUrl, readPage, readVisible } from './reader.js';
import { initTray, setTrayUnread, trayActive } from './tray.js';
import {
  isAutostartEnabled, programPath, refreshAutostartPath, setAutostart, startedByAutostart,
} from './autostart.js';
import { canIntegrate, installMenuEntry, removeMenuEntry } from './desktop.js';
import { notificationsFor, notificationText } from '../lib/rules.js';
import { formatPrice } from '../lib/format.js';
import { buildBackup, planImport } from '../lib/backup.js';
import { isNewer } from '../lib/version.js';
import { THEMES } from '../lib/constants.js';
import '../lib/priceParser.js';
import '../lib/extract.js';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCHEME = 'preiswaechter';
const START_URL = `${SCHEME}://app/renderer/index.html`;
const APP_ID = 'de.crazyjimpro.preiswaechter';
const REPO = 'CrazyJimPro/preiswaechter';
const TICK_MS = 60 * 1000;
const FIRST_CHECK_MS = 20 * 1000;
const UPDATE_CHECK_MS = 24 * 60 * 60 * 1000;
const IS_TEST = !!process.env.PREISWAECHTER_TEST;
const HANDOVER_POLLS = 30;
const HANDOVER_POLL_MS = 200;

/** Im Test lässt sich eine andere Version vorgeben, um Updates durchzuspielen. */
const currentVersion = () => (IS_TEST && process.env.PREISWAECHTER_FAKE_VERSION) || app.getVersion();

// Datenordner ohne Umlaut, das lässt sich leichter finden und tippen
app.setPath('userData', process.env.PREISWAECHTER_USERDATA || path.join(app.getPath('appData'), 'Preiswaechter'));

protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

let mainWindow = null;
let store = null;
let checker = null;
let importPlan = null;
let latestVersion = (IS_TEST && process.env.PREISWAECHTER_FAKE_LATEST) || null;
let updatedTo = null; // gesetzt, wenn die App seit dem letzten Start aktualisiert wurde
const openNotifications = new Set(); // sonst räumt der Speicherbereiniger sie weg und Klicks gehen verloren
const testLog = { notifications: [] };

// ---------- Benachrichtigungen ----------

function notify(title, body, onClick) {
  if (IS_TEST) testLog.notifications.push({ title, body });
  if (!Notification.isSupported()) return;
  const n = new Notification({ title, body, icon: path.join(SRC, '..', 'assets', 'icon.png') });
  openNotifications.add(n);
  const forget = () => openNotifications.delete(n);
  n.on('click', () => { forget(); if (onClick) onClick(); });
  n.on('close', forget);
  n.on('failed', (event, error) => { forget(); console.warn('Benachrichtigung fehlgeschlagen:', error); });
  n.show();
}

function onProductChecked(event) {
  const { product, previous } = event;
  for (const item of notificationsFor(event, store.getSettings())) {
    const { title, message } = notificationText(item, product, (v) => formatPrice(v, product.currency));
    notify(title, message, () => showProduct(product.id));
  }
  if (previous && previous.price != null && product.currentPrice != null && product.currentPrice < previous.price) {
    store.addUnread(product.id);
  }
}

// ---------- Aufrufe aus der Oberfläche ----------

// Nur Einstellungen, die die Oberfläche ändern darf
const PRODUCT_FIELDS = ['intervalMin', 'targetPrice', 'dropThreshold', 'notifyStock', 'paused', 'nextCheck'];
const SETTING_FIELDS = ['defaultIntervalMin', 'notifications', 'theme'];
const BACKGROUND = { dark: '#161b1b', light: '#ffffff' };

/** Steuert prefers-color-scheme in allen Fenstern, die Farben stehen in der CSS-Datei. */
function applyTheme(theme) {
  nativeTheme.themeSource = THEMES.some(([value]) => value === theme) ? theme : 'system';
  if (mainWindow) mainWindow.setBackgroundColor(nativeTheme.shouldUseDarkColors ? BACKGROUND.dark : BACKGROUND.light);
}

function pick(obj, fields) {
  const clean = {};
  for (const k of fields) if (obj && k in obj) clean[k] = obj[k];
  return clean;
}

async function analyse(url, reader) {
  const norm = isWebUrl(url) ? globalThis.Preiswaechter.normalizeProductUrl(url) : url;
  const tracked = store.findProductByUrl(norm);
  return { ...(await reader(url)), tracked };
}

const methods = {
  listProducts: () => store.listProducts(),
  getHistory: (id) => store.getHistory(id),
  getProduct: (id) => store.getProduct(id),
  getSettings: () => store.getSettings(),
  saveSettings(patch) {
    const clean = pick(patch, SETTING_FIELDS);
    if ('theme' in clean) {
      if (!THEMES.some(([value]) => value === clean.theme)) delete clean.theme;
      else applyTheme(clean.theme);
    }
    return store.saveSettings(clean);
  },
  deleteProduct: (id) => store.deleteProduct(id),
  updateProduct: (id, patch) => store.updateProduct(id, pick(patch, PRODUCT_FIELDS)),
  analyseUrl: (url) => analyse(url, readPage),
  analyseInWindow: (url) => analyse(url, readVisible),
  addProduct: (data) => store.addProduct(data),
  async checkNow(id) {
    const ev = await checker.checkProduct(id);
    return { product: ev && ev.product, error: ev && ev.error };
  },
  async checkInWindow(id) {
    const ev = await checker.checkInWindow(id);
    return { product: ev && ev.product, error: ev && ev.error };
  },
  checkAll: () => checker.checkDue({ all: true }),
  getUnread: () => store.getUnread(),
  markRead: (id) => store.removeUnread(id),
  openExternal(url) {
    if (isWebUrl(url)) shell.openExternal(url);
  },
  /** Internetadresse aus der Zwischenablage, sonst null. */
  async clipboardUrl() {
    const text = String(await clipboard.readText()).trim();
    return isWebUrl(text) && !/\s/.test(text) ? text : null;
  },
  appInfo: () => ({
    version: currentVersion(),
    latestVersion,
    updateAvailable: !!latestVersion && isNewer(latestVersion, currentVersion()),
    updatedTo,
    autostart: isAutostartEnabled(),
    canRemoveMenuEntry: canIntegrate(),
    platform: process.platform,
  }),
  /** Versionshinweise einer Version bei GitHub öffnen. */
  openReleaseNotes(version) {
    const tag = /^[\d.]+$/.test(String(version)) ? `tag/v${version}` : 'latest';
    shell.openExternal(`https://github.com/${REPO}/releases/${tag}`);
  },
  dismissUpdated() {
    updatedTo = null;
  },
  /** Knopf „Nach Updates suchen“. */
  async checkUpdate() {
    const reached = await checkForUpdate();
    return {
      reached,
      latest: latestVersion,
      updateAvailable: !!latestVersion && isNewer(latestVersion, currentVersion()),
    };
  },
  setAutostart: (on) => setAutostart(!!on),
  testNotification() {
    notify('Preiswächter: Test', 'So sieht eine Benachrichtigung aus. Ein Klick öffnet die App.', showWindow);
  },
  openDataFolder: () => shell.openPath(app.getPath('userData')),
  /** Menüeintrag und Autostart entfernen und beenden (Linux, AppImage). */
  removeFromSystem() {
    if (!canIntegrate()) return false;
    removeMenuEntry();
    setAutostart(false);
    store.saveSettings({ menuEntryRemoved: true });
    setTimeout(() => app.quit(), 300);
    return true;
  },
  async exportBackup(testPath) {
    let file = IS_TEST ? testPath : null;
    if (!file) {
      const name = `preiswaechter-sicherung-${new Date().toISOString().slice(0, 10)}.json`;
      const res = await dialog.showSaveDialog(mainWindow, {
        title: 'Sicherung speichern',
        defaultPath: path.join(app.getPath('downloads'), name),
        filters: [{ name: 'Preiswächter-Sicherung', extensions: ['json'] }],
      });
      if (res.canceled || !res.filePath) return null;
      file = res.filePath;
    }
    fs.writeFileSync(file, JSON.stringify(buildBackup(store.allData()), null, 2));
    return file;
  },
  /** Sicherung auswählen und prüfen; eingespielt wird erst mit applyImport. */
  async pickBackup(testPath) {
    let file = IS_TEST ? testPath : null;
    if (!file) {
      const res = await dialog.showOpenDialog(mainWindow, {
        title: 'Sicherung auswählen',
        defaultPath: app.getPath('downloads'),
        filters: [{ name: 'Preiswächter-Sicherung', extensions: ['json'] }],
        properties: ['openFile'],
      });
      if (res.canceled || !res.filePaths.length) return null;
      [file] = res.filePaths;
    }
    let data;
    try {
      data = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      return { error: 'Die Datei ist keine gültige Sicherung.' };
    }
    const plan = planImport(data, store.allData());
    importPlan = plan.error ? null : plan;
    return { error: plan.error, add: plan.add.length, merge: plan.merge.length, skipped: plan.skipped };
  },
  applyImport() {
    if (!importPlan) return false;
    store.writeProducts([...importPlan.add, ...importPlan.merge]);
    importPlan = null;
    return true;
  },
};

if (IS_TEST) {
  methods.testState = () => ({
    notifications: testLog.notifications,
    tray: trayActive(),
    autostart: isAutostartEnabled(),
    windowOpen: !!mainWindow,
    themeSource: nativeTheme.themeSource,
    dark: nativeTheme.shouldUseDarkColors,
    pid: process.pid,
  });
  methods.closeWindow = () => { if (mainWindow) mainWindow.close(); };
  methods.setFakeLatest = (v) => { latestVersion = v; };
  // wie ein Klick auf das X der übrigen Fenster
  methods.closeOtherWindows = () => {
    for (const w of BrowserWindow.getAllWindows()) if (w !== mainWindow) w.close();
  };
}

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

// ---------- Fenster ----------

function createWindow(hash = '') {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    minWidth: 480,
    minHeight: 400,
    title: 'Preiswächter',
    icon: path.join(SRC, '..', 'assets', 'icon.png'),
    show: false,
    autoHideMenuBar: true,
    // Sonst blitzt das Fenster beim Öffnen weiß auf
    backgroundColor: nativeTheme.shouldUseDarkColors ? BACKGROUND.dark : BACKGROUND.light,
    webPreferences: {
      preload: path.join(SRC, 'preload.cjs'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.setMenu(null);
  if (!process.env.PREISWAECHTER_HIDDEN) mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('close', () => {
    store.clearUnread();
    const s = store.getSettings();
    if (trayActive() && !s.closeHintShown) {
      store.saveSettings({ closeHintShown: true });
      notify('Preiswächter läuft weiter', 'Die Preise werden weiter geprüft. Du findest die App im Infobereich neben der Uhr.', showWindow);
    }
  });
  // Das Fenster wird wirklich geschlossen: Im Hintergrund braucht die App so viel weniger Speicher
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
  wc.on('before-input-event', (event, input) => {
    if (input.control && input.type === 'keyDown' && input.key.toLowerCase() === 'q') app.quit();
  });
  mainWindow.loadURL(START_URL + hash);
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

function showProduct(id) {
  if (!mainWindow) {
    createWindow(`#/p/${id}`);
    return;
  }
  mainWindow.webContents.send('pw:open-product', id);
  showWindow();
}

// ---------- Zeitplan ----------

function startSchedule() {
  const tick = () => {
    if (!net.isOnline()) return;
    checker.checkDue().catch((err) => console.error('Prüflauf fehlgeschlagen:', err));
  };
  setTimeout(tick, FIRST_CHECK_MS);
  setInterval(tick, TICK_MS);
  // Nach dem Aufwachen braucht das Netz einen Moment
  powerMonitor.on('resume', () => setTimeout(tick, 30 * 1000));
}

/** Fragt GitHub nach der neuesten Version. false, wenn GitHub nicht erreichbar war. */
async function checkForUpdate() {
  if (IS_TEST && process.env.PREISWAECHTER_FAKE_LATEST) return true; // Tests ohne Netz
  try {
    const res = await net.fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Preiswaechter' },
    });
    if (!res.ok) return false;
    const { tag_name: tag } = await res.json();
    if (!tag) return false;
    latestVersion = String(tag).replace(/^v/, '');
    if (mainWindow) mainWindow.webContents.send('pw:changed');
    return true;
  } catch {
    return false; // offline oder GitHub nicht erreichbar: kein Hinweis
  }
}

/** Merkt sich die Version, um nach einem Update „Aktualisiert auf …“ zu zeigen. */
function noteVersion() {
  const s = store.getSettings();
  const version = currentVersion();
  // Bis 1.0.0 wurde die Version nicht gemerkt, vorhandene Daten verraten eine ältere Installation
  const hadOlder = !s.lastVersion && (s.autostartConfigured || store.listProducts().length > 0);
  if (hadOlder || (s.lastVersion && s.lastVersion !== version)) updatedTo = version;
  if (s.lastVersion !== version) store.saveSettings({ lastVersion: version });
}

// ---------- Start ----------

// Startet eine neuere Datei, während die alte noch im Infobereich läuft, würde sonst nur das
// alte Fenster nach vorn kommen und das Update scheinbar nichts bewirken.
const lockData = { version: currentVersion(), exe: programPath(), args: process.argv.slice(1) };

/**
 * Linux: Die Sperre einer laufenden App ist ein Verweis „Rechner-PID“. Ist diese App älter, beendet
 * sie sich gleich (siehe second-instance), und diese hier läuft einfach weiter. Bleibt sie laufen,
 * zeigt sie ihr Fenster und diese hier geht nach kurzer Zeit wieder. So entsteht kein Hilfsprozess,
 * der offene Dateien der alten App erbt, und das AppImage wird nicht neu gestartet.
 */
async function waitForOlderInstance() {
  if (process.platform !== 'linux') return false;
  let pid = NaN;
  try {
    pid = Number(fs.readlinkSync(path.join(app.getPath('userData'), 'SingletonLock')).split('-').pop());
  } catch {
    return false;
  }
  if (!pid) return false;
  for (let i = 0; i < HANDOVER_POLLS; i++) {
    await new Promise((r) => setTimeout(r, HANDOVER_POLL_MS));
    try {
      process.kill(pid, 0);
    } catch {
      return app.requestSingleInstanceLock(lockData); // alte App ist weg
    }
  }
  return false;
}

if (!app.requestSingleInstanceLock(lockData) && !(await waitForOlderInstance())) {
  app.quit();
} else {
  app.on('second-instance', (event, argv, cwd, data) => {
    if (data && data.exe && isNewer(data.version, currentVersion())) {
      console.info(`Neuere Version ${data.version} gestartet, diese App beendet sich`);
      if (store) store.flush();
      // Unter Linux wartet die neue App und übernimmt, unter Windows ersetzt sonst der Installer die App
      if (process.platform !== 'linux') app.relaunch({ execPath: data.exe, args: Array.isArray(data.args) ? data.args : [] });
      app.quit();
      return;
    }
    showWindow();
  });
  app.whenReady().then(() => {
    initLog();
    app.setAppUserModelId(APP_ID);
    store = createStore(path.join(app.getPath('userData'), 'daten.json'));
    checker = createChecker(store);
    checker.onChecked(onProductChecked);
    applyTheme(store.getSettings().theme);
    noteVersion();
    store.onChange(() => {
      setTrayUnread(store.getUnread().length);
      if (mainWindow) mainWindow.webContents.send('pw:changed');
    });
    setupProtocol();
    setupIpc();

    // Installierte App: beim allerersten Start Autostart an, Startmenü-Eintrag anlegen
    const s = store.getSettings();
    if (app.isPackaged && !s.autostartConfigured) {
      setAutostart(true);
      store.saveSettings({ autostartConfigured: true });
    }
    if (app.isPackaged) refreshAutostartPath();
    if (!s.menuEntryRemoved) installMenuEntry();

    initTray({ show: showWindow, checkAll: () => checker.checkDue({ all: true }) });
    setTrayUnread(store.getUnread().length);
    if (!startedByAutostart()) createWindow();
    startSchedule();
    checkForUpdate();
    setInterval(checkForUpdate, UPDATE_CHECK_MS);
  });
  // Ohne Infobereich beendet das Schließen die App, sonst läuft sie dort weiter.
  // (Das Ereignis kommt auch, wenn nur ein unsichtbares Lesefenster zuging.)
  app.on('window-all-closed', () => {
    if (!trayActive()) app.quit();
  });
  app.on('before-quit', () => {
    if (store) store.flush();
  });
}
