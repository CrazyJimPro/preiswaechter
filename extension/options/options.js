import { api, isFirefox } from '../lib/api.js';
import {
  getSettings, saveSettings, listProducts, updateProduct, allData, writeProducts, INTERVALS,
} from '../lib/storage.js';
import { buildBackup, planImport } from '../lib/backup.js';

const $ = (id) => document.getElementById(id);

function flash(id) {
  const el = $(id);
  el.hidden = false;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.hidden = true; }, 2000);
}

// ---------- Einstellungen ----------

async function init() {
  const s = await getSettings();
  $('interval').replaceChildren(...INTERVALS.map(([v, label]) => {
    const o = document.createElement('option');
    o.value = String(v);
    o.textContent = label;
    return o;
  }));
  $('interval').value = String(s.defaultIntervalMin);
  $('tabFallback').checked = s.tabFallback;
  $('notifications').checked = s.notifications;
  $('ff-hint').hidden = !isFirefox;
  await showUsage();
}

$('interval').addEventListener('change', async (e) => {
  await saveSettings({ defaultIntervalMin: Number(e.target.value) });
  flash('saved-check');
});

$('apply-all').addEventListener('click', async () => {
  const intervalMin = Number($('interval').value);
  const products = await listProducts();
  for (const p of products) {
    const base = p.lastChecked || Date.now();
    await updateProduct(p.id, { intervalMin, nextCheck: Math.max(Date.now() + 30 * 1000, base + intervalMin * 60 * 1000) });
  }
  await saveSettings({ defaultIntervalMin: intervalMin });
  $('saved-check').textContent = `Für ${products.length} Produkt${products.length === 1 ? '' : 'e'} übernommen ✓`;
  flash('saved-check');
  setTimeout(() => { $('saved-check').textContent = 'Gespeichert ✓'; }, 2200);
});

$('tabFallback').addEventListener('change', async (e) => {
  await saveSettings({ tabFallback: e.target.checked });
  flash('saved-check');
});

$('notifications').addEventListener('change', async (e) => {
  await saveSettings({ notifications: e.target.checked });
  flash('saved-notify');
});

$('test-notification').addEventListener('click', async () => {
  const res = await api.runtime.sendMessage({ type: 'testNotification' }).catch((e) => ({ ok: false, error: String(e) }));
  $('test-result').textContent = res && res.ok
    ? 'Gesendet – erscheint keine Meldung, sind Benachrichtigungen für den Browser im Betriebssystem abgeschaltet.'
    : `Fehlgeschlagen: ${res && res.error}`;
});

// ---------- Export ----------

$('export').addEventListener('click', async () => {
  const backup = buildBackup(await allData());
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `preiswaechter-sicherung-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
});

// ---------- Import ----------

let plan = null;

$('import-file').addEventListener('change', async (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  $('import-result').hidden = true;
  if (!file) return;
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    showResult('Die Datei ist keine gültige JSON-Datei.', true);
    return;
  }
  const existing = await allData();
  plan = planImport(data, existing, { newId: () => crypto.randomUUID() });
  if (plan.error) {
    showResult(plan.error, true);
    plan = null;
    return;
  }
  const parts = [];
  parts.push(`${plan.add.length} neue${plan.add.length === 1 ? 's' : ''} Produkt${plan.add.length === 1 ? '' : 'e'}`);
  if (plan.merge.length) parts.push(`bei ${plan.merge.length} vorhandenen wird der Preisverlauf ergänzt`);
  if (plan.skipped) parts.push(`${plan.skipped} fehlerhafte Einträge werden übersprungen`);
  const nothing = !plan.add.length && !plan.merge.length;
  $('import-summary').textContent = nothing
    ? 'Alles aus dieser Sicherung ist schon vorhanden – es gibt nichts einzuspielen.'
    : `In der Sicherung: ${parts.join(', ')}. Danach fragt der Browser nach Zugriff auf die Shops, damit die Preise geprüft werden können.`;
  $('import-go').hidden = nothing;
  $('import-plan').hidden = false;
});

$('import-cancel').addEventListener('click', () => {
  plan = null;
  $('import-plan').hidden = true;
});

$('import-go').addEventListener('click', () => {
  if (!plan) return;
  const current = plan;
  plan = null;
  // Zugriffsanfrage muss direkt im Klick starten (vor jedem await)
  const permission = current.origins.length
    ? api.permissions.request({ origins: current.origins }).catch(() => false)
    : Promise.resolve(true);
  (async () => {
    await writeProducts([...current.add, ...current.merge]);
    const granted = await permission;
    $('import-plan').hidden = true;
    showResult(
      `Eingespielt: ${current.add.length} neue Produkte${current.merge.length ? `, ${current.merge.length} Verläufe ergänzt` : ''}.`
      + (granted ? '' : ' Ohne Zugriff auf die Shops können die Preise nicht im Hintergrund geprüft werden – in der Übersicht beim Produkt „Jetzt prüfen“ bzw. im Popup „Zugriff erlauben“ wählen.'),
      !granted,
    );
    await showUsage();
  })();
});

function showResult(text, warn) {
  const el = $('import-result');
  el.textContent = text;
  el.className = warn ? 'warn' : 'muted';
  el.hidden = false;
}

async function showUsage() {
  const products = await listProducts();
  let usage = '';
  try {
    if (api.storage.local.getBytesInUse) {
      const bytes = await api.storage.local.getBytesInUse(null);
      usage = ` · belegt ${(bytes / 1024).toFixed(bytes < 102400 ? 1 : 0).replace('.', ',')} KB`;
    }
  } catch { /* nicht überall verfügbar */ }
  $('usage').textContent = `${products.length} Produkt${products.length === 1 ? '' : 'e'} gespeichert${usage}`;
}

init();
