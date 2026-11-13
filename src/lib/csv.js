// Preisverlauf als CSV für Excel & Co. (deutsch: Semikolon, Dezimalkomma). Ohne DOM, testbar.
import { displayName, stockLabel } from './format.js';
import { priceChange } from './series.js';

const fmtTime = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

const num = (v) => (v == null ? '' : v.toFixed(2).replace('.', ','));

/** Feld maskieren, wenn Trenner, Anführungszeichen oder Zeilenumbruch darin stehen. */
function cell(v) {
  const s = String(v ?? '');
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Alle Messpunkte, älteste zuerst, mit Änderung zum vorherigen Punkt.
 * Liefert den Text ohne BOM; der kommt beim Schreiben dazu.
 */
export function historyCsv(product, history) {
  const pts = (history || []).filter((p) => p && p.price != null).sort((a, b) => a.t - b.t);
  const lines = [
    ['Produkt', displayName(product)],
    ['Adresse', product.url || ''],
    [],
    ['Zeitpunkt', 'Preis', 'Währung', 'Änderung', 'Änderung in %', 'Lagerstatus'],
  ];
  pts.forEach((p, i) => {
    const ch = i ? priceChange(p.price, pts[i - 1].price) : null;
    lines.push([
      fmtTime.format(new Date(p.t)).replace(',', ''),
      num(p.price),
      product.currency || 'EUR',
      ch ? num(ch.diff) : '',
      ch ? String(ch.pct).replace('.', ',') : '',
      stockLabel(p.stock),
    ]);
  });
  return lines.map((l) => l.map(cell).join(';')).join('\r\n') + '\r\n';
}

/** Dateiname aus dem Produktnamen, nur sichere Zeichen. */
export function csvFileName(product, now = Date.now()) {
  const base = displayName(product)
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .toLowerCase() || 'produkt';
  return `preisverlauf-${base}-${new Date(now).toISOString().slice(0, 10)}.csv`;
}
