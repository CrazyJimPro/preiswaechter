// Anzeige-Helfer (deutsches Format).

export function formatPrice(value, currency = 'EUR') {
  if (value == null || Number.isNaN(value)) return '–';
  try {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(value);
  } catch {
    return `${Number(value).toFixed(2).replace('.', ',')} ${currency}`;
  }
}

export function stockLabel(status) {
  switch (status) {
    case 'in_stock': return 'Lieferbar';
    case 'out_of_stock': return 'Nicht lieferbar';
    default: return 'Lagerstatus unbekannt';
  }
}

export function timeAgo(ts) {
  if (!ts) return 'nie';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'gerade eben';
  const m = Math.round(s / 60);
  if (m < 60) return `vor ${m} Min.`;
  const h = Math.round(m / 60);
  if (h < 48) return `vor ${h} Std.`;
  return `vor ${Math.round(h / 24)} Tagen`;
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

export function timeUntil(ts) {
  if (!ts) return '–';
  const s = Math.round((ts - Date.now()) / 1000);
  if (s <= 60) return 'gleich';
  const m = Math.round(s / 60);
  if (m < 60) return `in ${m} Min.`;
  const h = Math.round(m / 60);
  if (h < 48) return `in ${h} Std.`;
  return `in ${Math.round(h / 24)} Tagen`;
}

/** Dauer in Worten: "unter einer Stunde", "5 Std.", "3 Tage". */
export function durationText(ms) {
  const h = ms / 3600e3;
  if (h < 1) return 'unter einer Stunde';
  if (h < 48) return `${Math.round(h)} Std.`;
  const d = Math.round(h / 24);
  return `${d} Tage`;
}

/** "▼ 10,00 € (−5 %)" – Text und Richtung ('down' | 'up') einer Preisänderung. */
export function changeText(change, currency) {
  if (!change) return null;
  const arrow = change.diff < 0 ? '▼' : '▲';
  const pct = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1, signDisplay: 'always' }).format(change.pct);
  return {
    text: `${arrow} ${formatPrice(Math.abs(change.diff), currency)} (${pct.replace('-', '−')} %)`,
    dir: change.diff < 0 ? 'down' : 'up',
  };
}

