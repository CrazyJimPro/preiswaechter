// Symbol im Infobereich (neben der Uhr). Die App läuft dort weiter, wenn das Fenster zu ist.
import { app, Menu, Tray, nativeImage } from 'electron';
import { fileURLToPath } from 'node:url';

const IS_WINDOWS = process.platform === 'win32';
const asset = (name) => fileURLToPath(new URL(`../../assets/${name}.${IS_WINDOWS ? 'ico' : 'png'}`, import.meta.url));

let tray = null;
let unread = 0;
let actions = { show: () => {}, checkAll: () => {} };

function unreadText() {
  return unread === 1 ? '1 Produkt günstiger geworden' : `${unread} Produkte günstiger geworden`;
}

function refresh() {
  if (!tray) return;
  tray.setImage(nativeImage.createFromPath(asset(unread > 0 ? 'tray-neu' : 'tray')));
  tray.setToolTip(unread > 0 ? `Preiswächter: ${unreadText()}` : 'Preiswächter');
  const items = [{ label: 'Preiswächter öffnen', click: () => actions.show() }];
  if (unread > 0) items.push({ label: unreadText(), enabled: false });
  items.push(
    { label: 'Alle Preise jetzt prüfen', click: () => actions.checkAll() },
    { type: 'separator' },
    { label: 'Beenden', click: () => app.quit() },
  );
  // Unter Linux wird ein geändertes Menü erst durch erneutes Setzen übernommen
  tray.setContextMenu(Menu.buildFromTemplate(items));
}

export function initTray(callbacks) {
  actions = callbacks;
  try {
    tray = new Tray(nativeImage.createFromPath(asset('tray')));
    tray.on('click', () => actions.show());
    refresh();
  } catch (err) {
    // Ohne Infobereich läuft alles andere normal weiter, das Fenster beendet dann die App
    tray = null;
    console.warn('Symbol im Infobereich nicht verfügbar:', err.message);
  }
  return !!tray;
}

export function setTrayUnread(count) {
  if (count === unread) return;
  unread = count;
  refresh();
}

export const trayActive = () => !!tray && !tray.isDestroyed();
