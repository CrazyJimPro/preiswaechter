// Preiswächter – Hintergrundskript
// (Chrome: Service Worker, Firefox: Event-Page; beide als ES-Modul)
//
// M1: Produkte anlegen. Die regelmäßige Preisprüfung folgt in M2.
import { api } from './lib/api.js';
import { addProduct, getSettings, saveSettings } from './lib/storage.js';

api.runtime.onInstalled.addListener(async () => {
  // Standardwerte einmal festschreiben, vorhandene Einstellungen bleiben erhalten
  await saveSettings(await getSettings());
});

api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg !== 'object') return false;

  if (msg.type === 'addProduct') {
    // Das Popup schickt das Produkt hierher, weil es sich beim
    // Berechtigungsdialog schließen kann – der Hintergrund speichert trotzdem.
    addProduct(msg.data).then(
      (product) => sendResponse({ ok: true, product }),
      (err) => sendResponse({ ok: false, error: String(err && err.message || err) }),
    );
    return true; // Antwort kommt asynchron
  }
  return false;
});
