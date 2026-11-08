// Preiswächter – Hintergrundskript
// (Chrome: Service Worker, Firefox: Event-Page; beide als ES-Modul)
import { api } from './lib/api.js';
import { addProduct, getSettings, saveSettings } from './lib/storage.js';
import { checkDue, checkProduct, passiveUpdate } from './lib/checker.js';

const ALARM = 'preiswaechter-tick';

async function ensureAlarm() {
  const existing = await api.alarms.get(ALARM);
  if (!existing) {
    // Jede Minute nachsehen, welche Produkte fällig sind (jedes hat sein eigenes Intervall)
    await api.alarms.create(ALARM, { delayInMinutes: 0.5, periodInMinutes: 1 });
  }
}

api.runtime.onInstalled.addListener(async () => {
  await saveSettings(await getSettings()); // Standardwerte festschreiben, vorhandene bleiben
  await ensureAlarm();
});

api.runtime.onStartup.addListener(async () => {
  await ensureAlarm();
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
    default:
      return false;
  }
});

ensureAlarm();

// Für Fehlersuche in der Konsole des Hintergrundskripts
globalThis.preiswaechter = { checkDue, checkProduct };
