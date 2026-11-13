// SVG-Diagramme für den Preisverlauf (ohne Fremdbibliothek).
// Gestaltung: 2px-Linie als Treppe (ein Preis gilt bis zur nächsten Änderung),
// Fläche als 10-%-Hauch, feine durchgezogene Rasterlinien, Endpunkt mit Wert,
// Fadenkreuz + Tooltip bei Maus und Tastatur. Texte nur per textContent.
// Dazu: Senkungen grün, Erhöhungen rot an den Stufen, Tief/Hoch markiert,
// Preis beim Hinzufügen gestrichelt, "nicht lieferbar" grau hinterlegt.
import { seriesInRange, niceTicks, timeTicks, changesOnly, durationOf, extremes, stockGaps } from './series.js';
import { formatPrice, stockLabel, changeText, durationText } from './format.js';

const SVG = 'http://www.w3.org/2000/svg';

function el(tag, attrs, parent) {
  const e = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, String(v));
  if (parent) parent.appendChild(e);
  return e;
}

function text(parent, x, y, str, attrs) {
  const t = el('text', { x, y, ...attrs }, parent);
  t.textContent = str;
  return t;
}

/** Treppenpfad: waagerecht bis zum nächsten Punkt, dann senkrecht. */
function stepPath(pts, x, y, endT) {
  let d = '';
  pts.forEach((p, i) => {
    const px = x(p.t);
    const py = y(p.price);
    if (i === 0) d += `M${px},${py}`;
    else d += `H${px}V${py}`;
  });
  d += `H${x(endT)}`;
  return d;
}

const fmtDay = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit' });
const fmtMonth = new Intl.DateTimeFormat('de-DE', { month: 'short', year: '2-digit' });
const fmtHour = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' });
const fmtFull = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function axisPrice(v, currency, decimals) {
  try {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency', currency, minimumFractionDigits: decimals, maximumFractionDigits: decimals,
    }).format(v);
  } catch {
    return v.toFixed(decimals);
  }
}

/**
 * Kleine Verlaufslinie für Listen.
 * @returns {SVGSVGElement}
 */
export function sparkline(history, { from, to = Date.now(), width = 64, height = 20, label = '' } = {}) {
  const svg = el('svg', { width, height, viewBox: `0 0 ${width} ${height}`, class: 'spark', role: 'img' });
  if (label) el('title', {}, svg).textContent = label;
  const pts = seriesInRange(history, from, to);
  if (!pts.length) return svg;
  const t0 = pts[0].t;
  const t1 = Math.max(to, pts[pts.length - 1].t + 1);
  let lo = Math.min(...pts.map((p) => p.price));
  let hi = Math.max(...pts.map((p) => p.price));
  if (lo === hi) { lo -= 1; hi += 1; }
  const pad = 3;
  const x = (t) => (t1 === t0 ? width - pad : pad + ((t - t0) / (t1 - t0)) * (width - 2 * pad));
  const y = (v) => pad + (1 - (v - lo) / (hi - lo)) * (height - 2 * pad);
  el('path', { d: stepPath(pts, x, y, t1), fill: 'none', stroke: 'var(--accent)', 'stroke-width': 1.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
  const last = pts[pts.length - 1];
  el('circle', { cx: x(t1), cy: y(last.price), r: 2, fill: 'var(--accent)' }, svg);
  return svg;
}

/**
 * Großes Preisdiagramm in `container` zeichnen (ersetzt den Inhalt).
 * Zeichnet bei Größenänderung automatisch neu.
 */
export function priceChart(container, history, opts) {
  if (container._chartObserver) container._chartObserver.disconnect();
  const draw = () => drawChart(container, history, opts);
  draw();
  if (typeof ResizeObserver === 'function') {
    let lastW = container.clientWidth;
    const ro = new ResizeObserver(() => {
      if (Math.abs(container.clientWidth - lastW) > 4) { lastW = container.clientWidth; draw(); }
    });
    ro.observe(container);
    container._chartObserver = ro;
  }
}

function drawChart(container, history, { from, to = Date.now(), currency = 'EUR', targetPrice = null, addedPrice = null } = {}) {
  container.replaceChildren();
  container.classList.add('chart');
  const pts = seriesInRange(history, from, to);
  if (!pts.length) {
    const p = document.createElement('p');
    p.className = 'muted chart-empty';
    p.textContent = 'Für diesen Zeitraum gibt es noch keine Preisdaten.';
    container.appendChild(p);
    return;
  }

  const W = Math.max(280, container.clientWidth || 640);
  const H = 280;
  const m = { top: 14, right: 78, bottom: 30, left: 70 };
  const pw = W - m.left - m.right;
  const ph = H - m.top - m.bottom;

  const t0 = pts[0].t;
  const t1 = Math.max(to, pts[pts.length - 1].t + 60 * 1000);
  const prices = pts.map((p) => p.price);
  let lo = Math.min(...prices);
  let hi = Math.max(...prices);
  // Zielpreis mit in den sichtbaren Bereich nehmen, wenn er nicht absurd weit weg liegt
  const near = (v) => v != null && v > 0 && v >= lo * 0.5 && v <= hi * 1.5;
  const showTarget = near(targetPrice);
  // Preis beim Hinzufügen nur, wenn er sich vom Ziel unterscheidet (sonst doppelte Linie)
  const showAdded = near(addedPrice) && addedPrice !== targetPrice;
  for (const v of [showTarget && targetPrice, showAdded && addedPrice]) {
    if (v) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  }
  const range = hi - lo;
  const nt = niceTicks(lo - range * 0.08, hi + range * 0.08, 4);
  const decimals = nt.ticks.every((v) => Number.isInteger(v)) ? 0 : 2;

  const x = (t) => m.left + ((t - t0) / (t1 - t0 || 1)) * pw;
  const y = (v) => m.top + (1 - (v - nt.lo) / (nt.hi - nt.lo || 1)) * ph;

  const svg = el('svg', {
    width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', tabindex: 0,
    'aria-label': `Preisverlauf, aktuell ${formatPrice(pts[pts.length - 1].price, currency)}`,
  });

  // Raster + Preisachse
  const grid = el('g', { class: 'grid' }, svg);
  for (const v of nt.ticks) {
    el('line', { x1: m.left, x2: m.left + pw, y1: y(v), y2: y(v) }, grid);
    text(grid, m.left - 8, y(v) + 4, axisPrice(v, currency, decimals), { 'text-anchor': 'end', class: 'axis' });
  }
  // Zeitachse
  const tt = timeTicks(t0, t1);
  for (const t of tt.ticks) {
    const d = new Date(t);
    const label = tt.withTime ? fmtHour.format(d) : tt.step >= 61 * 24 * 3600 * 1000 ? fmtMonth.format(d) : fmtDay.format(d);
    text(grid, x(t), m.top + ph + 20, label, { 'text-anchor': 'middle', class: 'axis' });
  }
  el('line', { x1: m.left, x2: m.left + pw, y1: m.top + ph, y2: m.top + ph, class: 'baseline' }, grid);

  // Farbverlauf für die Fläche (Farben kommen per CSS aus den Design-Variablen)
  const defs = el('defs', {}, svg);
  const gradId = `pw-grad-${Math.random().toString(36).slice(2, 8)}`;
  const grad = el('linearGradient', { id: gradId, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
  el('stop', { offset: '0%', class: 'grad-top' }, grad);
  el('stop', { offset: '100%', class: 'grad-bottom' }, grad);

  // Nicht lieferbar: graue Bänder hinter allem
  const gaps = stockGaps(pts, t1);
  for (const g of gaps) {
    const gx = x(Math.max(g.from, t0));
    el('rect', { x: gx, y: m.top, width: Math.max(2, x(Math.min(g.to, t1)) - gx), height: ph, class: 'oos' }, svg);
  }

  // Preis beim Hinzufügen als gestrichelte Bezugslinie, Beschriftung links im Diagramm
  if (showAdded) {
    const ay = y(addedPrice);
    el('line', { x1: m.left, x2: m.left + pw, y1: ay, y2: ay, class: 'added' }, svg);
    text(svg, m.left + 6, ay - 5, `beim Hinzufügen ${axisPrice(addedPrice, currency, 2)}`, { class: 'axis added-label' });
  }

  // Zielpreis als Bezugslinie mit Beschriftung
  if (showTarget) {
    const ty = y(targetPrice);
    el('line', { x1: m.left, x2: m.left + pw, y1: ty, y2: ty, class: 'target' }, svg);
    text(svg, m.left + pw + 6, ty + 4, `Ziel ${axisPrice(targetPrice, currency, 2)}`, { class: 'axis target-label' });
  }

  // Fläche + Linie
  const line = stepPath(pts, x, y, t1);
  el('path', { d: `${line}V${m.top + ph}H${x(t0)}Z`, class: 'area', fill: `url(#${gradId})` }, svg);
  el('path', { d: line, class: 'line' }, svg);
  // Stufen einfärben: runter grün, rauf rot
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1].price;
    const b = pts[i].price;
    if (a === b) continue;
    const sx = x(pts[i].t);
    el('line', { x1: sx, x2: sx, y1: y(a), y2: y(b), class: b < a ? 'step down' : 'step up' }, svg);
  }

  // Endpunkt mit Wert (nur hier eine direkte Beschriftung)
  const last = pts[pts.length - 1];
  el('circle', { cx: x(t1), cy: y(last.price), r: 4, class: 'dot' }, svg);
  const endLabel = text(svg, x(t1) + 8, y(last.price) + 4, axisPrice(last.price, currency, 2), { class: 'end-label' });
  if (showTarget && Math.abs(y(targetPrice) - y(last.price)) < 14) endLabel.setAttribute('y', y(last.price) - 8);

  // Tiefst- und Höchstpreis markieren (nur wenn der Preis sich überhaupt bewegt hat)
  const ex = extremes(pts);
  if (ex && ex.min.price !== ex.max.price) {
    for (const [kind, e] of [['min', ex.min], ['max', ex.max]]) {
      const ex0 = x(e.t);
      const ey = y(e.price);
      // Der aktuelle Preis steht schon am rechten Rand, dort keine zweite Beschriftung
      if (e.current && x(t1) - ex0 < 70) continue;
      el('circle', { cx: ex0, cy: ey, r: 3.5, class: `mark ${kind}` }, svg);
      const below = kind === 'min' ? ey + 18 < m.top + ph : ey - 18 < m.top;
      // Am Rand nach innen ausrichten, damit die Beschriftung nicht in die Achse ragt
      const anchor = ex0 < m.left + 50 ? 'start' : ex0 > m.left + pw - 50 ? 'end' : 'middle';
      const lx = anchor === 'start' ? ex0 + 4 : anchor === 'end' ? ex0 - 4 : ex0;
      text(svg, lx, below ? ey + 16 : ey - 8, `${kind === 'min' ? 'Tief' : 'Hoch'} ${axisPrice(e.price, currency, 2)}`, {
        'text-anchor': anchor, class: `mark-label ${kind}`,
      });
    }
  }

  // Fadenkreuz + Tooltip
  const cross = el('g', { class: 'cross', visibility: 'hidden' }, svg);
  const vline = el('line', { y1: m.top, y2: m.top + ph }, cross);
  const cdot = el('circle', { r: 4, class: 'dot' }, cross);
  const tip = document.createElement('div');
  tip.className = 'tooltip';
  tip.hidden = true;
  const tipValue = document.createElement('strong');
  const tipChange = document.createElement('div');
  const tipDate = document.createElement('div');
  const tipDur = document.createElement('div');
  const tipStock = document.createElement('div');
  tipDate.className = 'muted';
  tipDur.className = 'muted';
  tipStock.className = 'muted';
  tip.append(tipValue, tipChange, tipDate, tipDur, tipStock);

  // Ziele für Maus und Pfeiltasten: nur echte Änderungen, keine Lebenszeichen
  const targets = changesOnly(pts);
  let idx = -1;

  function show(i) {
    idx = Math.max(0, Math.min(targets.length - 1, i));
    const p = targets[idx];
    const px = x(p.t);
    const py = y(p.price);
    vline.setAttribute('x1', px);
    vline.setAttribute('x2', px);
    cdot.setAttribute('cx', px);
    cdot.setAttribute('cy', py);
    cross.setAttribute('visibility', 'visible');
    tipValue.textContent = formatPrice(p.price, currency);
    const ch = changeText(p.change, currency);
    tipChange.textContent = ch ? ch.text : '';
    tipChange.className = ch ? ch.dir : '';
    tipChange.hidden = !ch;
    tipDate.textContent = `${p.carried ? 'seit ' : ''}${fmtFull.format(new Date(p.origT ?? p.t))}`;
    const dur = durationText(durationOf(targets, idx, t1));
    tipDur.textContent = idx === targets.length - 1 ? `gilt seit ${dur}` : `galt ${dur}`;
    tipStock.textContent = p.stock && p.stock !== 'unknown' ? stockLabel(p.stock) : '';
    tip.hidden = false;
    const tw = tip.offsetWidth || 160;
    const left = px + 12 + tw > W ? px - 12 - tw : px + 12;
    tip.style.left = `${left}px`;
    tip.style.top = `${Math.max(0, Math.min(py - 20, H - (tip.offsetHeight || 110)))}px`;
  }
  function hide() {
    cross.setAttribute('visibility', 'hidden');
    tip.hidden = true;
  }
  function nearest(clientX) {
    const r = svg.getBoundingClientRect();
    const px = ((clientX - r.left) / r.width) * W;
    let best = 0;
    let bd = Infinity;
    targets.forEach((p, i) => {
      const d = Math.abs(x(p.t) - px);
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }

  // Trefferfläche = ganze Diagrammfläche, nicht nur die Linie
  const hit = el('rect', { x: m.left, y: m.top, width: pw, height: ph, fill: 'transparent' }, svg);
  hit.addEventListener('pointermove', (e) => show(nearest(e.clientX)));
  hit.addEventListener('pointerleave', hide);
  svg.addEventListener('focus', () => show(targets.length - 1));
  svg.addEventListener('blur', hide);
  svg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { show(idx - 1); e.preventDefault(); }
    if (e.key === 'ArrowRight') { show(idx + 1); e.preventDefault(); }
    if (e.key === 'Home') { show(0); e.preventDefault(); }
    if (e.key === 'End') { show(targets.length - 1); e.preventDefault(); }
  });

  container.append(svg, tip);

  // Legende nur für das, was wirklich zu sehen ist
  const legend = [
    ['line', 'Preis'],
    showAdded && ['added', 'Beim Hinzufügen'],
    showTarget && ['target', 'Zielpreis'],
    gaps.length && ['oos', 'Nicht lieferbar'],
  ].filter(Boolean);
  if (legend.length > 1) {
    const lg = document.createElement('div');
    lg.className = 'chart-legend';
    for (const [cls, label] of legend) {
      const item = document.createElement('span');
      const sw = document.createElement('i');
      sw.className = `sw ${cls}`;
      item.append(sw, label);
      lg.append(item);
    }
    container.append(lg);
  }
}
