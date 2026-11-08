// Preiswächter – Hintergrundskript
// (Chrome: Service Worker, Firefox: Event-Page; beide als ES-Modul)
import { api } from './lib/api.js';
import {
  addProduct, getSettings, saveSettings, getProduct, getUnread, addUnread, clearUnread,
} from './lib/storage.js';
import { checkDue, checkProduct, passiveUpdate, onProductChecked } from './lib/checker.js';
import { notificationsFor, notificationText } from './lib/rules.js';
import { formatPrice } from './lib/format.js';

const ALARM = 'preiswaechter-tick';

async function ensureAlarm() {
  const existing = await api.alarms.get(ALARM);
  if (!existing) {
    // Jede Minute nachsehen, welche Produkte fällig sind (jedes hat sein eigenes Intervall)
    await api.alarms.create(ALARM, { delayInMinutes: 0.5, periodInMinutes: 1 });
  }
}

// ---------- Zahl am Symbol ----------

async function updateBadge() {
  const unread = await getUnread();
  await api.action.setBadgeBackgroundColor({ color: '#0f766e' });
  if (api.action.setBadgeTextColor) await api.action.setBadgeTextColor({ color: '#ffffff' }).catch(() => {});
  await api.action.setBadgeText({ text: unread.length ? String(unread.length) : '' });
  await api.action.setTitle({
    title: unread.length
      ? `Preiswächter – ${unread.length} Produkt${unread.length === 1 ? '' : 'e'} günstiger geworden`
      : 'Preiswächter',
  });
}

// ---------- Benachrichtigungen ----------

const NOTIF_PREFIX = 'pw|';

async function notify(product, n) {
  const { title, message } = notificationText(n, product, (v) => formatPrice(v, product.currency));
  await api.notifications.create(`${NOTIF_PREFIX}${product.id}|${n.kind}|${Date.now()}`, {
    type: 'basic',
    iconUrl: api.runtime.getURL('icons/icon-128.png'),
    title,
    message,
  });
}

onProductChecked(async (event) => {
  const settings = await getSettings();
  const list = notificationsFor(event, settings);
  for (const n of list) {
    try { await notify(event.product, n); } catch (e) { console.warn('Preiswächter: Benachrichtigung fehlgeschlagen', e); }
  }
  // Preissenkungen (auch ohne Benachrichtigung) als „neu“ am Symbol zählen
  const prev = event.previous && event.previous.price;
  if (prev != null && event.product.currentPrice != null && event.product.currentPrice < prev) {
    await addUnread(event.product.id);
    await updateBadge();
  }
});

api.notifications.onClicked.addListener(async (id) => {
  if (!id.startsWith(NOTIF_PREFIX)) return;
  api.notifications.clear(id);
  const [, productId, kind] = id.split('|');
  if (kind === 'test') {
    api.tabs.create({ url: api.runtime.getURL('dashboard/dashboard.html') });
    return;
  }
  const p = await getProduct(productId);
  if (p) api.tabs.create({ url: p.url });
});

// ---------- Lebenszyklus ----------

api.runtime.onInstalled.addListener(async () => {
  await saveSettings(await getSettings()); // Standardwerte festschreiben, vorhandene bleiben
  await ensureAlarm();
  await updateBadge();
});

api.runtime.onStartup.addListener(async () => {
  await ensureAlarm();
  await updateBadge();
  checkDue(); // beim Browserstart Überfälliges nachholen
});

api.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM) checkDue();
});

// Verfolgte Produktseite vom User geöffnet → Preis mitnehmen.
// tab.url ist nur gesetzt, wenn wir Zugriff auf den Shop haben.
api.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status === 'complete' && tab && tab.url) {
    passiveUpdate(tabId, tab.url).catch(() => {});
  }
});

// ---------- Nachrichten von Popup, Übersicht, Einstellungen ----------

api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg !== 'object' || msg.target === 'offscreen') return false;

  const reply = (promise) => {
    promise.then(
      (value) => sendResponse({ ok: true, ...value }),
      (err) => sendResponse({ ok: false, error: String((err && err.message) || err) }),
    );
    return true; // Antwort kommt asynchron
  };

  switch (msg.type) {
    case 'addProduct':
      // Das Popup schickt das Produkt hierher, weil es sich beim
      // Berechtigungsdialog schließen kann – der Hintergrund speichert trotzdem.
      return reply(addProduct(msg.data).then((product) => ({ product })));
    case 'checkNow':
      return reply(checkProduct(msg.id).then((ev) => ({ product: ev && ev.product, error: ev && ev.error })));
    case 'checkDue':
      return reply(checkDue({ max: msg.max || 5 }).then((count) => ({ count })));
    case 'clearUnread':
      return reply(clearUnread().then(updateBadge).then(() => ({})));
    case 'testNotification':
      return reply(api.notifications.create(`${NOTIF_PREFIX}-|test|${Date.now()}`, {
        type: 'basic',
        iconUrl: api.runtime.getURL('icons/icon-128.png'),
        title: 'Preiswächter: Test',
        message: 'So sieht eine Benachrichtigung aus. Ein Klick öffnet die Übersicht.',
      }).then(() => ({})));
    default:
      return false;
  }
});

ensureAlarm();

// Für Fehlersuche in der Konsole des Hintergrundskripts
globalThis.preiswaechter = { checkDue, checkProduct, updateBadge };
