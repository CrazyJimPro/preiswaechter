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
