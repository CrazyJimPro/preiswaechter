// Einstellungsseite: Prüfung, Autostart, Benachrichtigungen, Datensicherung.
import { rpc } from './rpc.js';
import { INTERVALS, THEMES } from '../lib/constants.js';

const $ = (id) => document.getElementById(id);

export async function renderSettings() {
  const [s, info] = await Promise.all([rpc.getSettings(), rpc.appInfo()]);
  const sel = $('o-interval');
  if (!sel.options.length) {
    sel.replaceChildren(...INTERVALS.map(([v, label]) => {
      const o = document.createElement('option');
      o.value = String(v);
      o.textContent = label;
      return o;
    }));
  }
  sel.value = String(s.defaultIntervalMin);
  const theme = $('o-theme');
  if (!theme.options.length) {
    theme.replaceChildren(...THEMES.map(([value, label]) => {
      const o = document.createElement('option');
      o.value = value;
      o.textContent = label;
      return o;
    }));
  }
  theme.value = s.theme;
  $('o-notifications').checked = s.notifications !== false;
  $('o-autostart').checked = info.autostart;
  $('o-version').textContent = `Version ${info.version}`;
  $('o-remove').hidden = !info.canRemoveMenuEntry;
}

function backupResult(text, warn) {
  const el = $('o-backup-result');
  el.textContent = text;
  el.className = warn ? 'warn' : 'muted small';
  el.hidden = false;
}

export function setupSettings() {
  $('o-theme').addEventListener('change', (e) => rpc.saveSettings({ theme: e.target.value }));

  $('o-interval').addEventListener('change', (e) => rpc.saveSettings({ defaultIntervalMin: Number(e.target.value) }));

  $('o-apply-all').addEventListener('click', async () => {
    const intervalMin = Number($('o-interval').value);
    const products = await rpc.listProducts();
    for (const p of products) {
      const base = p.lastChecked || Date.now();
      await rpc.updateProduct(p.id, { intervalMin, nextCheck: Math.max(Date.now() + 30 * 1000, base + intervalMin * 60 * 1000) });
    }
    await rpc.saveSettings({ defaultIntervalMin: intervalMin });
    $('o-apply-result').textContent = `Für ${products.length} Produkt${products.length === 1 ? '' : 'e'} übernommen ✓`;
  });

  $('o-autostart').addEventListener('change', async (e) => {
    e.target.checked = await rpc.setAutostart(e.target.checked);
  });

  $('o-notifications').addEventListener('change', (e) => rpc.saveSettings({ notifications: e.target.checked }));

  $('o-test').addEventListener('click', async () => {
    await rpc.testNotification();
    $('o-test-result').textContent = 'Gesendet. Erscheint keine Meldung, sind Benachrichtigungen im Betriebssystem abgeschaltet.';
  });

  $('o-export').addEventListener('click', async () => {
    try {
      const file = await rpc.exportBackup();
      if (file) backupResult(`Gespeichert: ${file}`);
    } catch (err) {
      backupResult(`Speichern fehlgeschlagen: ${err.message}`, true);
    }
  });

  $('o-import').addEventListener('click', async () => {
    $('o-backup-result').hidden = true;
    const plan = await rpc.pickBackup();
    if (!plan) return;
    if (plan.error) {
      $('o-import-plan').hidden = true;
      backupResult(plan.error, true);
      return;
    }
    const parts = [`${plan.add} neue${plan.add === 1 ? 's' : ''} Produkt${plan.add === 1 ? '' : 'e'}`];
    if (plan.merge) parts.push(`bei ${plan.merge} vorhandenen wird der Preisverlauf ergänzt`);
    if (plan.skipped) parts.push(`${plan.skipped} fehlerhafte Einträge werden übersprungen`);
    const nothing = !plan.add && !plan.merge;
    $('o-import-summary').textContent = nothing
      ? 'Alles aus dieser Sicherung ist schon vorhanden, es gibt nichts einzuspielen.'
      : `In der Sicherung: ${parts.join(', ')}.`;
    $('o-import-go').hidden = nothing;
    $('o-import-plan').hidden = false;
  });

  $('o-import-go').addEventListener('click', async () => {
    await rpc.applyImport();
    $('o-import-plan').hidden = true;
    backupResult('Sicherung eingespielt ✓');
  });

  $('o-import-cancel').addEventListener('click', () => { $('o-import-plan').hidden = true; });

  $('o-check-update').addEventListener('click', async (e) => {
    const out = $('o-update-result');
    e.target.disabled = true;
    out.textContent = 'Wird gesucht …';
    try {
      const r = await rpc.checkUpdate();
      if (!r.reached) out.textContent = 'GitHub ist gerade nicht erreichbar, bitte später noch einmal versuchen.';
      else if (r.updateAvailable) out.textContent = `Version ${r.latest} ist verfügbar, siehe oben neben dem Namen.`;
      else out.textContent = 'Du hast die neueste Version ✓';
    } finally {
      e.target.disabled = false;
    }
  });

  $('o-folder').addEventListener('click', () => rpc.openDataFolder());

  $('o-remove').addEventListener('click', (e) => {
    const btn = e.target;
    if (!btn.dataset.armed) {
      btn.dataset.armed = '1';
      btn.textContent = 'Wirklich entfernen? Nochmal klicken';
      setTimeout(() => { delete btn.dataset.armed; btn.textContent = 'Aus dem Startmenü entfernen und beenden'; }, 4000);
      return;
    }
    rpc.removeFromSystem();
  });
}
