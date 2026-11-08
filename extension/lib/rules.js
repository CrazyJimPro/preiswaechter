// Wann wird benachrichtigt? Reine Funktionen, unter Node testbar.

/**
 * Ermittelt die Meldungen für ein Prüfergebnis.
 * @param {{product: object, previous: {price: number|null, stock: string}}} event
 * @param {{notifications: boolean}} settings
 * @returns {{kind: 'target'|'drop'|'stock', oldPrice?: number, newPrice: number, pct?: number}[]}
 */
export function notificationsFor(event, settings) {
  if (!event || !event.product || !settings || settings.notifications === false) return [];
  const p = event.product;
  const prev = event.previous || {};
  const price = p.currentPrice;
  const old = prev.price;
  const out = [];
  if (price == null) return out;

  const target = p.targetPrice;
  const crossedTarget = target != null && price <= target && (old == null || old > target);
  if (crossedTarget) {
    out.push({ kind: 'target', oldPrice: old ?? null, newPrice: price, target });
  } else if (old != null && price < old) {
    const pct = ((old - price) / old) * 100;
    const threshold = p.dropThreshold;
    // kleine Toleranz, damit 10,0 % bei Schwelle 10 % sicher meldet
    if (threshold == null || pct >= threshold - 1e-6) {
      out.push({ kind: 'drop', oldPrice: old, newPrice: price, pct: Math.round(pct * 10) / 10 });
    }
  }

  if (p.notifyStock !== false && prev.stock === 'out_of_stock' && p.stockStatus === 'in_stock') {
    out.push({ kind: 'stock', newPrice: price });
  }
  return out;
}

/** Titel und Text einer Meldung (deutsch). `fmt(price)` formatiert einen Betrag. */
export function notificationText(n, product, fmt) {
  const name = product.name.length > 90 ? product.name.slice(0, 87) + '…' : product.name;
  switch (n.kind) {
    case 'target':
      return {
        title: `Zielpreis erreicht: ${fmt(n.newPrice)}`,
        message: `${name}\nZiel ${fmt(n.target)}${n.oldPrice != null ? ` · vorher ${fmt(n.oldPrice)}` : ''}`,
      };
    case 'drop':
      return {
        title: `Preis gesunken um ${String(n.pct).replace('.', ',')} %`,
        message: `${name}\n${fmt(n.oldPrice)} → ${fmt(n.newPrice)}`,
      };
    case 'stock':
      return {
        title: 'Wieder lieferbar',
        message: `${name}\nAktueller Preis ${fmt(n.newPrice)}`,
      };
    default:
      return { title: 'Preiswächter', message: name };
  }
}
