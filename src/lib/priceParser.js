/*
 * Preiswächter – Preistexte in Zahl + Währung umwandeln.
 *
 * Bewusst als klassisches Skript ohne export-Anweisungen geschrieben:
 * Es wird als Content-Script in Shopseiten eingespielt UND per
 * `import './priceParser.js'` in den Erweiterungsseiten geladen.
 * Die Funktionen landen im Namensraum globalThis.Preiswaechter.
 *
 * Idee (EU/US-Zahlenformat, Ratenpreise verwerfen) nach PriceGhost
 * (github.com/clucraft/PriceGhost, backend/src/utils/priceParser.ts).
 */
(function () {
  'use strict';
  const NS = (globalThis.Preiswaechter = globalThis.Preiswaechter || {});

  // Längere Schreibweisen zuerst, damit "US$" nicht als "$" erkannt wird.
  const CURRENCY_TOKENS = [
    ['US$', 'USD'], ['AU$', 'AUD'], ['CA$', 'CAD'], ['C$', 'CAD'], ['A$', 'AUD'],
    ['SFr.', 'CHF'], ['Fr.', 'CHF'], ['CHF', 'CHF'],
    ['EUR', 'EUR'], ['USD', 'USD'], ['GBP', 'GBP'], ['CAD', 'CAD'], ['AUD', 'AUD'],
    ['JPY', 'JPY'], ['INR', 'INR'], ['PLN', 'PLN'], ['SEK', 'SEK'], ['DKK', 'DKK'],
    ['NOK', 'NOK'], ['CZK', 'CZK'], ['Kč', 'CZK'], ['zł', 'PLN'],
    ['€', 'EUR'], ['£', 'GBP'], ['$', 'USD'], ['¥', 'JPY'], ['₹', 'INR'],
  ];

  const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const CUR = '(' + CURRENCY_TOKENS.map(([t]) => escapeRe(t)).join('|') + ')';

  // Zahl: entweder mit Tausendertrennern (1.299 / 1,299 / 1 299 / 1'299) oder
  // eine schlichte Ziffernfolge, danach optional Dezimalteil (,99 / .99 / ,-).
  const NUM =
    "(\\d{1,3}(?:[.,'’\\u00a0\\u202f ]\\d{3})+|\\d+)(?:([.,])(\\d{1,2}(?!\\d)|-{1,2}|–))?";

  const RE_PREFIX = new RegExp(CUR + '\\s*' + NUM, 'i');
  const RE_SUFFIX = new RegExp(NUM + '\\s*' + CUR, 'i');
  const RE_PLAIN = new RegExp(NUM);

  // Ratenzahlungen, Monatspreise, Finanzierungen – das ist nie der Produktpreis.
  const RE_INSTALMENT =
    /\/\s*(mo|mon|monat|month|mtl)\b|pro\s+monat|per\s+month|a\s+month|monatlich|\bmonthly\b|\bmtl\.|ratenzahlung|\braten?\b|\binstal?lments?\b|\bpayments?\b|finanzierung|\d+\s*x\s*\d|\bx\s*\d+\s*monate/i;

  function currencyCode(token) {
    if (!token) return null;
    const t = token.trim();
    for (const [tok, code] of CURRENCY_TOKENS) {
      if (tok.toLowerCase() === t.toLowerCase()) return code;
    }
    return null;
  }

  function toNumber(intPart, sep, decPart) {
    const digits = String(intPart).replace(/\D/g, '');
    if (!digits) return null;
    let value = parseInt(digits, 10);
    if (sep && decPart && /^\d+$/.test(decPart)) {
      value = parseFloat(digits + '.' + decPart);
    }
    if (!isFinite(value)) return null;
    return Math.round(value * 100) / 100;
  }

  function clean(text) {
    return String(text)
      .replace(/[   ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * "1.299,00 €" → { price: 1299, currency: 'EUR' }
   * Gibt null zurück, wenn kein Preis erkennbar ist oder es ein Ratenpreis ist.
   */
  function parsePrice(text, defaultCurrency) {
    if (text == null) return null;
    const t = clean(text);
    if (!t || t.length > 120) return null;
    if (RE_INSTALMENT.test(t)) return null;

    let m = t.match(RE_PREFIX);
    if (m) {
      const price = toNumber(m[2], m[3], m[4]);
      if (price > 0) return { price, currency: currencyCode(m[1]) || defaultCurrency || 'EUR' };
    }
    m = t.match(RE_SUFFIX);
    if (m) {
      const price = toNumber(m[1], m[2], m[3]);
      if (price > 0) return { price, currency: currencyCode(m[4]) || defaultCurrency || 'EUR' };
    }
    m = t.match(RE_PLAIN);
    if (m) {
      const price = toNumber(m[1], m[2], m[3]);
      if (price > 0) return { price, currency: defaultCurrency || 'EUR' };
    }
    return null;
  }

  /**
   * Maschinenlesbare Beträge (JSON-LD, data-Attribute): "1299.00", 1299, "1.299,00".
   */
  function parseAmount(value) {
    if (value == null || value === '') return null;
    if (typeof value === 'number') return value > 0 ? Math.round(value * 100) / 100 : null;
    const s = String(value).trim();
    if (/^\d+(\.\d+)?$/.test(s)) {
      const v = parseFloat(s);
      return v > 0 ? Math.round(v * 100) / 100 : null;
    }
    const p = parsePrice(s);
    return p ? p.price : null;
  }

  NS.parsePrice = parsePrice;
  NS.parseAmount = parseAmount;
  NS.currencyCode = currencyCode;
})();
