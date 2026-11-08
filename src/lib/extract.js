/*
 * Preiswächter – Produktdaten aus einer Seite (DOM-Document) auslesen.
 *
 * Läuft in drei Umgebungen:
 *  - als Content-Script direkt in der geöffneten Shopseite (opts.live = true)
 *  - im Hintergrund auf per fetch() geladenem und geparstem HTML
 *  - in den Tests unter Node mit jsdom
 *
 * Reihenfolge der Methoden nach PriceGhost (github.com/clucraft/PriceGhost):
 * JSON-LD → Meta-Angaben → shop-spezifisch → allgemeine CSS-Selektoren.
 * Jede Methode liefert Kandidaten; stimmen sie überein, ist der Preis sicher.
 *
 * Benötigt lib/priceParser.js (wird vorher geladen).
 */
(function () {
  'use strict';
  const NS = (globalThis.Preiswaechter = globalThis.Preiswaechter || {});

  const WEIGHT = { jsonld: 1.0, site: 0.9, meta: 0.8, generic: 0.4 };
  const LABEL = {
    jsonld: 'Strukturierte Daten',
    meta: 'Meta-Angaben',
    site: 'Shop-Erkennung',
    generic: 'Seitentext',
  };

  // ---------- kleine Helfer ----------

  const txt = (el) => (el ? String(el.textContent || '').replace(/\s+/g, ' ').trim() : '');
  const $ = (doc, sel) => {
    try { return doc.querySelector(sel); } catch { return null; }
  };
  const $$ = (doc, sel) => {
    try { return Array.from(doc.querySelectorAll(sel)); } catch { return []; }
  };
  const first = (doc, sels) => {
    for (const s of sels) {
      const el = $(doc, s);
      if (el) return el;
    }
    return null;
  };
  const absUrl = (u, base) => {
    if (!u) return null;
    try { return new URL(String(u).trim(), base).href; } catch { return null; }
  };
  const hostOf = (u) => {
    try { return new URL(u).hostname.toLowerCase(); } catch { return ''; }
  };
  const asList = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
  const isType = (node, t) => asList(node && node['@type']).some((x) => String(x).toLowerCase() === t.toLowerCase());

  function currencyFromHost(host) {
    if (/\.co\.uk$|\.uk$/.test(host)) return 'GBP';
    if (/\.ch$/.test(host)) return 'CHF';
    if (/\.pl$/.test(host)) return 'PLN';
    if (/\.se$/.test(host)) return 'SEK';
    if (/\.dk$/.test(host)) return 'DKK';
    if (/\.cz$/.test(host)) return 'CZK';
    if (/\.ca$/.test(host)) return 'CAD';
    if (/\.com\.au$/.test(host)) return 'AUD';
    if (/\.co\.jp$|\.jp$/.test(host)) return 'JPY';
    if (/\.in$/.test(host)) return 'INR';
    if (/(^|\.)(amazon|ebay|walmart|bestbuy|target|newegg|homedepot|costco)\.com$/.test(host)) return 'USD';
    return 'EUR';
  }

  // ---------- Lagerstatus ----------

  const RE_OUT =
    /nicht\s+(mehr\s+)?(lieferbar|verfügbar|vorrätig|auf\s+lager|bestellbar)|ausverkauft|vergriffen|derzeit\s+nicht|zurzeit\s+nicht|out\s+of\s+stock|sold\s+out|currently\s+unavailable|no\s+longer\s+available|\bunavailable\b|épuisé|esaurito|agotado|angebot\s+(ist\s+)?beendet|listing\s+(has\s+)?ended/i;
  const RE_IN =
    /auf\s+lager|lieferbar|sofort\s+verfügbar|vorrätig|\bverfügbar\b|in\s+stock|\bavailable\b|lieferzeit|versandfertig|add\s+to\s+cart|in\s+den\s+warenkorb/i;

  function stockFromText(t) {
    if (!t) return null;
    if (RE_OUT.test(t)) return 'out_of_stock';
    if (RE_IN.test(t)) return 'in_stock';
    return null;
  }

  function stockFromSchema(v) {
    const s = String(v || '').toLowerCase();
    if (!s) return null;
    if (/outofstock|soldout|discontinued|out of stock|oos/.test(s)) return 'out_of_stock';
    if (/instock|limitedavailability|preorder|presale|onlineonly|instoreonly|in stock|backorder/.test(s)) return 'in_stock';
    return null;
  }

  // ---------- 1. JSON-LD ----------

  function jsonLdNodes(doc) {
    const out = [];
    const walk = (node, depth) => {
      if (!node || depth > 8) return;
      if (Array.isArray(node)) { node.forEach((n) => walk(n, depth + 1)); return; }
      if (typeof node !== 'object') return;
      out.push(node);
      if (node['@graph']) walk(node['@graph'], depth + 1);
      if (node.mainEntity) walk(node.mainEntity, depth + 1);
      if (node.itemOffered) walk(node.itemOffered, depth + 1);
      // MediaMarkt/Saturn: BuyAction → object → ProductGroup
      if (node.object) walk(node.object, depth + 1);
    };
    for (const s of $$(doc, 'script[type="application/ld+json"]')) {
      const raw = s.textContent || '';
      let data = null;
      try { data = JSON.parse(raw); } catch {
        try { data = JSON.parse(raw.replace(/[\u0000-\u001f]+/g, ' ')); } catch { data = null; }
      }
      if (data) walk(data, 0);
    }
    return out;
  }

  function offerPrice(offer) {
    if (!offer || typeof offer !== 'object') return null;
    const P = NS.parseAmount;
    let amount = null;
    let currency = offer.priceCurrency || null;
    if (isType(offer, 'AggregateOffer')) {
      amount = P(offer.lowPrice) ?? P(offer.price);
      if (amount == null) {
        for (const o of asList(offer.offers)) {
          const r = offerPrice(o);
          if (r) return r;
        }
      }
    } else {
      amount = P(offer.price);
    }
    if (amount == null) {
      for (const spec of asList(offer.priceSpecification)) {
        // UVP/Streichpreise in priceSpecification überspringen
        if (/ListPrice|StrikethroughPrice|SRP|MSRP/i.test(String(spec && spec.priceType))) continue;
        amount = P(spec && spec.price);
        if (amount != null) { currency = currency || spec.priceCurrency; break; }
      }
    }
    if (amount == null) return null;
    return { price: amount, currency: currency ? String(currency).toUpperCase() : null, availability: offer.availability };
  }

  function fromJsonLd(doc, url) {
    const nodes = jsonLdNodes(doc);
    let products = nodes.filter((n) => isType(n, 'Product') || isType(n, 'ProductGroup') || isType(n, 'IndividualProduct'));
    // Produktgruppe mit Varianten: Variante zur aktuellen URL bevorzugen
    const expanded = [];
    for (const p of products) {
      if (p.hasVariant) {
        const variants = asList(p.hasVariant);
        const match = variants.find((v) => v && v.offers && asList(v.offers).some((o) => o && o.url && normalizeProductUrl(absUrl(o.url, url) || '') === normalizeProductUrl(url)));
        if (match) expanded.push({ ...match, name: match.name || p.name, image: match.image || p.image });
        expanded.push(p, ...variants.map((v) => ({ ...v, name: v.name || p.name, image: v.image || p.image })));
      } else {
        expanded.push(p);
      }
    }
    products = expanded;

    for (const p of products) {
      const offers = asList(p.offers);
      for (const o of offers) {
        const r = offerPrice(o);
        if (r) {
          let image = p.image;
          if (Array.isArray(image)) image = image[0];
          if (image && typeof image === 'object') image = image.url || image.contentUrl;
          return {
            price: r.price,
            currency: r.currency,
            name: typeof p.name === 'string' ? p.name.trim() : null,
            image: absUrl(image, url),
            stock: stockFromSchema(r.availability),
          };
        }
      }
    }
    // Produkt ohne Preis: wenigstens Name/Bild liefern
    const p = products[0];
    if (p) {
      let image = Array.isArray(p.image) ? p.image[0] : p.image;
      if (image && typeof image === 'object') image = image.url;
      return { price: null, currency: null, name: typeof p.name === 'string' ? p.name.trim() : null, image: absUrl(image, url), stock: null };
    }
    return null;
  }

  // ---------- 2. Meta-Angaben / Microdata ----------

  function fromMeta(doc) {
    const out = [];
    const metaContent = (sel) => {
      const el = $(doc, sel);
      return el ? el.getAttribute('content') : null;
    };
    const cur =
      metaContent('meta[property="product:price:currency"]') ||
      metaContent('meta[property="og:price:currency"]') ||
      (($(doc, '[itemprop="priceCurrency"]') || null) &&
        ($(doc, '[itemprop="priceCurrency"]').getAttribute('content') || txt($(doc, '[itemprop="priceCurrency"]')))) ||
      null;

    const ogAmount =
      metaContent('meta[property="product:price:amount"]') || metaContent('meta[property="og:price:amount"]');
    const og = NS.parseAmount(ogAmount);
    if (og != null) out.push({ price: og, currency: cur, source: 'og' });

    const ip = $(doc, '[itemprop="offers"] [itemprop="price"], [itemprop="price"]');
    if (ip && !ip.closest('del, s, strike')) {
      const raw = ip.getAttribute('content') || ip.getAttribute('value') || txt(ip);
      const v = NS.parseAmount(raw);
      if (v != null) out.push({ price: v, currency: cur, source: 'microdata' });
    }

    let stock = null;
    const avail =
      metaContent('meta[property="product:availability"]') ||
      metaContent('meta[property="og:availability"]');
    if (avail) stock = stockFromSchema(avail.replace(/\s+/g, ''));
    if (!stock) {
      const ia = $(doc, '[itemprop="availability"]');
      if (ia) stock = stockFromSchema(ia.getAttribute('href') || ia.getAttribute('content') || txt(ia));
    }
    return { prices: out, currency: cur ? String(cur).toUpperCase() : null, stock };
  }

  // ---------- 3. Shop-spezifisch ----------

  function pricesFromSelectors(doc, sels, cur, limit) {
    const out = [];
    for (const s of sels) {
      for (const el of $$(doc, s)) {
        if (el.closest('del, s, strike')) continue;
        const p = NS.parsePrice(txt(el), cur);
        if (p) {
          out.push(p);
          if (out.length >= (limit || 1)) return out;
          break;
        }
      }
    }
    return out;
  }

  const SITES = [
    {
      name: 'Amazon',
      match: (host) => /(^|\.)amazon\.[a-z.]+$/.test(host),
      extract(doc, url, cur) {
        let prices = pricesFromSelectors(doc, [
          '#corePriceDisplay_desktop_feature_div .priceToPay .a-offscreen',
          '#corePrice_feature_div .priceToPay .a-offscreen',
          '#corePriceDisplay_desktop_feature_div .a-price:not(.a-text-price) .a-offscreen',
          '#corePrice_feature_div .a-price:not(.a-text-price) .a-offscreen',
          '#apex_desktop .priceToPay .a-offscreen',
          '#apex_desktop .a-price:not(.a-text-price) .a-offscreen',
          '#priceblock_dealprice',
          '#priceblock_ourprice',
          '#priceblock_saleprice',
          '#price_inside_buybox',
          '#newBuyBoxPrice',
          '#kindle-price',
          '#tp_price_block_total_price_ww .a-offscreen',
        ], cur);
        if (!prices.length) {
          const whole = first(doc, ['#corePriceDisplay_desktop_feature_div .priceToPay .a-price-whole', '#corePrice_feature_div .a-price-whole', '.priceToPay .a-price-whole']);
          if (whole) {
            const frac = whole.parentElement && whole.parentElement.querySelector('.a-price-fraction');
            const p = NS.parsePrice(txt(whole).replace(/\D/g, '') + ',' + (frac ? txt(frac).replace(/\D/g, '') : '00'), cur);
            if (p) prices = [p];
          }
        }
        const img = first(doc, ['#landingImage', '#imgBlkFront', '#ebooksImgBlkFront', '#imgTagWrapperId img']);
        let stock = null;
        if ($(doc, '#outOfStock')) stock = 'out_of_stock';
        else stock = stockFromText(txt($(doc, '#availability')));
        return {
          prices,
          name: txt($(doc, '#productTitle')) || null,
          image: img ? img.getAttribute('data-old-hires') || img.getAttribute('src') : null,
          stock,
        };
      },
    },
    {
      name: 'eBay',
      match: (host) => /(^|\.)ebay\.[a-z.]+$/.test(host),
      extract(doc, url, cur) {
        const prices = pricesFromSelectors(doc, [
          '.x-price-primary .ux-textspans',
          '.x-price-primary',
          '.x-bin-price__content .ux-textspans',
          '#prcIsum',
          '#prcIsum_bidPrice',
          '#mm-saleDscPrc',
        ], cur);
        const img = first(doc, ['.ux-image-carousel-item.active img', '.ux-image-carousel-item img', '#icImg']);
        let stock = stockFromText(txt(first(doc, ['.d-statusmessage', '.ux-layout-section--statusmessage'])));
        if (!stock) stock = stockFromText(txt(first(doc, ['.d-quantity__availability', '#qtySubTxt'])));
        return {
          prices,
          name: txt(first(doc, ['.x-item-title__mainTitle .ux-textspans', 'h1.x-item-title__mainTitle', '#itemTitle'])) || null,
          image: img ? img.getAttribute('data-zoom-src') || img.getAttribute('src') : null,
          stock,
        };
      },
    },
    {
      name: 'Magento',
      match: (host, doc) => !!$(doc, '[data-price-type="finalPrice"][data-price-amount]'),
      extract(doc) {
        const el =
          $(doc, '.product-info-main [data-price-type="finalPrice"][data-price-amount]') ||
          $(doc, '[data-price-type="finalPrice"][data-price-amount]');
        const v = el ? NS.parseAmount(el.getAttribute('data-price-amount')) : null;
        const st = $(doc, '.product-info-main .stock, .product-info-stock-sku .stock');
        let stock = null;
        if (st) {
          if (st.classList.contains('unavailable')) stock = 'out_of_stock';
          else if (st.classList.contains('available')) stock = 'in_stock';
          else stock = stockFromText(txt(st));
        }
        return {
          prices: v != null ? [{ price: v, currency: null }] : [],
          name: txt(first(doc, ['.product-info-main .page-title .base', '.page-title .base'])) || null,
          image: null,
          stock,
        };
      },
    },
  ];

  // ---------- 4. Allgemeine Selektoren ----------

  const GENERIC_SELECTORS = [
    '.product-info-main .price',
    '.product-detail .price',
    '.product-price .price',
    '.price-current',
    '.current-price',
    '.price--current',
    '.price__current',
    '.price-now',
    '.sale-price',
    '.special-price .price',
    '.final-price',
    '.offer-price',
    '.product-price',
    '.product__price',
    '.productPrice',
    '.pdp-price',
    '[data-price]',
    '#price',
    '.price',
  ];

  const EXCLUDE_ANCESTORS =
    'del, s, strike, header, nav, footer, aside, ' +
    '.old-price, .price-old, .oldPrice, .was-price, .regular-price, .list-price, .uvp, .rrp, ' +
    '.strike, .strikethrough, .crossed, ' +
    '[class*="old-price"], [class*="was-price"], [class*="strike"], [class*="uvp"], [class*="Uvp"], ' +
    '[class*="related"], [class*="recommend"], [class*="carousel"], [class*="upsell"], [class*="cross-sell"], ' +
    '[class*="crosssell"], [class*="similar"], [class*="accessor"]';

  function fromGeneric(doc, cur, live) {
    const out = [];
    const seen = new Set();
    for (const sel of GENERIC_SELECTORS) {
      for (const el of $$(doc, sel)) {
        if (el.closest(EXCLUDE_ANCESTORS)) continue;
        if (live && typeof el.checkVisibility === 'function' && !el.checkVisibility()) continue;
        const raw = el.hasAttribute('data-price') ? el.getAttribute('data-price') : null;
        const t = txt(el);
        if (!raw && (!t || t.length > 60)) continue;
        let p = null;
        if (raw && /^\s*\d+([.,]\d+)?\s*$/.test(raw)) {
          const v = NS.parseAmount(raw.replace(',', '.'));
          if (v != null) p = { price: v, currency: null };
        }
        if (!p) p = NS.parsePrice(t, cur);
        // Sehr kleine Beträge sind meist Rabatte/Gutscheine, kein Produktpreis
        if (!p || p.price < 1) continue;
        const key = p.price.toFixed(2);
        if (seen.has(key)) break;
        seen.add(key);
        out.push(p);
        break; // je Selektor nur der erste Treffer
      }
      if (out.length >= 3) break;
    }
    return out;
  }

  function genericStock(doc) {
    const el = first(doc, [
      '[data-availability]',
      '.availability',
      '.product-availability',
      '.stock-status',
      '.delivery-status',
      '[class*="availability"]',
      '[class*="stock-status"]',
      '[class*="deliveryStatus"]',
      '.stock',
    ]);
    if (el) {
      const s = stockFromText(el.getAttribute('data-availability') || txt(el).slice(0, 200));
      if (s) return s;
    }
    return null;
  }

  // ---------- Konsens ----------

  function closeEnough(a, b) {
    return Math.abs(a - b) <= Math.max(0.01, 0.005 * Math.max(a, b));
  }

  function buildOptions(candidates) {
    const groups = [];
    for (const c of candidates) {
      const g = groups.find((x) => closeEnough(x.price, c.price));
      if (g) g.members.push(c);
      else groups.push({ price: c.price, currency: c.currency, members: [c] });
    }
    for (const g of groups) {
      const best = {};
      for (const m of g.members) best[m.method] = Math.max(best[m.method] || 0, m.weight);
      g.score = Object.values(best).reduce((a, b) => a + b, 0);
      g.methods = Object.keys(best);
    }
    groups.sort((a, b) => b.score - a.score);
    return groups.map((g) => ({
      price: g.price,
      currency: g.currency,
      score: Math.round(g.score * 100) / 100,
      methods: g.methods,
      labels: g.methods.map((m) => LABEL[m]),
    }));
  }

  // ---------- URL vereinheitlichen ----------

  const TRACKING_PARAMS = /^(utm_\w+|gclid|gbraid|wbraid|fbclid|msclkid|dclid|yclid|mc_cid|mc_eid|_ga|_gl|srsltid|ref|ref_|tag|psc|th|smid|pf_rd_\w+|pd_rd_\w+|qid|sr|keywords|crid|sprefix|spm|scm|trk|trkid|campaign|affiliate|partner|awc|sscid|cjevent|wt_mc|wt_cc\d*|emid|sc_cid|cmp|icid)$/i;

  function normalizeProductUrl(url) {
    let u;
    try { u = new URL(url); } catch { return url; }
    u.hash = '';
    const host = u.hostname.toLowerCase();
    if (/(^|\.)amazon\.[a-z.]+$/.test(host)) {
      const m = u.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d|exec\/obidos\/asin|o\/asin)\/([A-Z0-9]{10})/i);
      if (m) return `${u.protocol}//${u.host}/dp/${m[1].toUpperCase()}`;
    }
    if (/(^|\.)ebay\.[a-z.]+$/.test(host)) {
      const m = u.pathname.match(/\/itm\/(?:[^/]+\/)?(\d{9,})/);
      if (m) return `${u.protocol}//${u.host}/itm/${m[1]}`;
    }
    // Bewusst per Text statt über u.searchParams: In Firefox-Content-Scripts liefert
    // der Iterator von searchParams (Xray-Hülle) keine Einträge.
    const kept = u.search
      .replace(/^\?/, '')
      .split('&')
      .filter(Boolean)
      .filter((pair) => {
        let key = pair.split('=')[0];
        try { key = decodeURIComponent(key.replace(/\+/g, ' ')); } catch { /* Rohwert nehmen */ }
        return !TRACKING_PARAMS.test(key);
      });
    u.search = kept.length ? '?' + kept.join('&') : '';
    return u.href;
  }

  // ---------- Hauptfunktion ----------

  /**
   * Liest Preis, Name, Bild und Lagerstatus aus einem Document.
   * @param {Document} doc
   * @param {string} url  tatsächliche Adresse der Seite
   * @param {{live?: boolean}} [opts]  live = echte, gerenderte Seite (Sichtbarkeit prüfen)
   */
  function extractFromDocument(doc, url, opts) {
    const live = !!(opts && opts.live);
    const host = hostOf(url);
    const candidates = [];
    const add = (p, method) => {
      if (p && p.price > 0) candidates.push({ price: p.price, currency: p.currency || null, method, weight: WEIGHT[method] });
    };

    const ld = fromJsonLd(doc, url);
    const meta = fromMeta(doc);
    const defaultCur = (ld && ld.currency) || meta.currency || currencyFromHost(host);

    if (ld && ld.price != null) add({ price: ld.price, currency: ld.currency }, 'jsonld');
    for (const p of meta.prices) add(p, 'meta');

    let site = null;
    let siteData = null;
    for (const s of SITES) {
      if (s.match(host, doc)) {
        site = s;
        try { siteData = s.extract(doc, url, defaultCur); } catch { siteData = null; }
        break;
      }
    }
    if (siteData) for (const p of siteData.prices) add(p, 'site');

    // Allgemeine Suche nur, wenn die verlässlichen Methoden nichts gefunden haben
    // oder nur eine einzige Quelle existiert (dann als Gegenprobe).
    if (candidates.length <= 1) for (const p of fromGeneric(doc, defaultCur, live)) add(p, 'generic');

    for (const c of candidates) if (!c.currency) c.currency = defaultCur;

    const options = buildOptions(candidates);
    const top = options[0] || null;
    const hasConsensus =
      options.length === 1 ||
      (options.length > 1 &&
        !top.methods.every((m) => m === 'generic') &&
        options.slice(1).every((o) => o.methods.every((m) => m === 'generic')));

    const ogTitle = $(doc, 'meta[property="og:title"]');
    const ogImage = $(doc, 'meta[property="og:image"]');
    const canonical = $(doc, 'link[rel="canonical"]');

    const name =
      (siteData && siteData.name) ||
      (ld && ld.name) ||
      (ogTitle && ogTitle.getAttribute('content')) ||
      txt($(doc, 'h1')) ||
      txt($(doc, 'title')) ||
      host;

    const image =
      absUrl(siteData && siteData.image, url) ||
      (ld && ld.image) ||
      absUrl(ogImage && ogImage.getAttribute('content'), url) ||
      null;

    const stockStatus =
      (ld && ld.stock) || (siteData && siteData.stock) || meta.stock || genericStock(doc) || 'unknown';

    return {
      url,
      productUrl: normalizeProductUrl(url),
      canonicalUrl: canonical ? absUrl(canonical.getAttribute('href'), url) : null,
      shop: site ? site.name : host.replace(/^www\./, ''),
      name: String(name).trim().slice(0, 300),
      imageUrl: image,
      currency: (top && top.currency) || defaultCur,
      stockStatus,
      price: top ? top.price : null,
      hasConsensus: !!top && hasConsensus,
      options,
      candidates,
    };
  }

  NS.extractFromDocument = extractFromDocument;
  NS.normalizeProductUrl = normalizeProductUrl;
  NS.stockFromText = stockFromText;
})();
