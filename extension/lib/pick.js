// Reine Hilfsfunktionen für die Preisprüfung (ohne Browser-API, testbar unter Node).

/**
 * Wählt aus einem Erkennungsergebnis den Preis, der zum gespeicherten Produkt passt.
 * - Eindeutiges Ergebnis → dieser Preis.
 * - Mehrere Kandidaten → bevorzugt die Methode, die der User beim Anlegen gewählt hat,
 *   sonst der Kandidat, der dem letzten bekannten Preis am nächsten liegt.
 * @returns {{price:number, currency:string}|null}
 */
export function pickPrice(result, product) {
  if (!result || !Array.isArray(result.options) || !result.options.length) return null;
  const opts = result.options;
  if (result.hasConsensus || opts.length === 1) return { price: opts[0].price, currency: opts[0].currency };

  const preferred = Array.isArray(product && product.preferredMethods) ? product.preferredMethods : [];
  if (preferred.length) {
    const byMethod = opts.find((o) => o.methods.some((m) => preferred.includes(m)));
    if (byMethod) return { price: byMethod.price, currency: byMethod.currency };
  }
  const last = product && product.currentPrice;
  if (last != null) {
    const closest = [...opts].sort((a, b) => Math.abs(a.price - last) - Math.abs(b.price - last))[0];
    return { price: closest.price, currency: closest.currency };
  }
  return { price: opts[0].price, currency: opts[0].currency };
}

/** Nächster Prüfzeitpunkt mit ±10 % Zufallsversatz, damit nicht alle Shops gleichzeitig dran sind. */
export function nextCheckTime(intervalMin, now = Date.now(), rnd = Math.random) {
  const ms = intervalMin * 60 * 1000;
  return Math.round(now + ms * (0.9 + rnd() * 0.2));
}

/** Nach einem Fehler früher erneut versuchen – höchstens 30 Minuten warten, aber nie öfter als das Intervall. */
export function retryTime(intervalMin, errorCount, now = Date.now()) {
  const minutes = Math.min(intervalMin, 30, 5 * Math.max(1, errorCount));
  return now + minutes * 60 * 1000;
}

/** Zeichensatz aus dem Content-Type-Header, z. B. "text/html; charset=ISO-8859-1". */
export function charsetFromContentType(ct) {
  const m = /charset\s*=\s*"?([\w-]+)/i.exec(ct || '');
  return m ? m[1].toLowerCase() : null;
}

/** Zeichensatz aus <meta charset> in den ersten Bytes des HTML (als latin1 gelesen). */
export function charsetFromHtmlHead(headText) {
  const m = /<meta[^>]+charset\s*=\s*["']?([\w-]+)/i.exec(headText || '');
  return m ? m[1].toLowerCase() : null;
}
