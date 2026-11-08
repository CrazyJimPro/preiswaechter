// SVG-Diagramme für den Preisverlauf (ohne Fremdbibliothek).
// Gestaltung: 2px-Linie als Treppe (ein Preis gilt bis zur nächsten Änderung),
// Fläche als 10-%-Hauch, feine durchgezogene Rasterlinien, Endpunkt mit Wert,
// Fadenkreuz + Tooltip bei Maus und Tastatur. Texte nur per textContent.
import { seriesInRange, niceTicks, timeTicks } from './series.js';
import { formatPrice, stockLabel } from './format.js';

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

function drawChart(container, history, { from, to = Date.now(), currency = 'EUR', targetPrice = null } = {}) {
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
  const showTarget = targetPrice != null && targetPrice > 0 && targetPrice >= lo * 0.5 && targetPrice <= hi * 1.5;
  if (showTarget) { lo = Math.min(lo, targetPrice); hi = Math.max(hi, targetPrice); }
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

  // Zielpreis als Bezugslinie mit Beschriftung
  if (showTarget) {
    const ty = y(targetPrice);
    el('line', { x1: m.left, x2: m.left + pw, y1: ty, y2: ty, class: 'target' }, svg);
    text(svg, m.left + pw + 6, ty + 4, `Ziel ${axisPrice(targetPrice, currency, 2)}`, { class: 'axis target-label' });
  }

  // Fläche + Linie
  const line = stepPath(pts, x, y, t1);
  el('path', { d: `${line}V${m.top + ph}H${x(t0)}Z`, class: 'area' }, svg);
  el('path', { d: line, class: 'line' }, svg);

  // Endpunkt mit Wert (nur hier eine direkte Beschriftung)
  const last = pts[pts.length - 1];
  el('circle', { cx: x(t1), cy: y(last.price), r: 4, class: 'dot' }, svg);
  const endLabel = text(svg, x(t1) + 8, y(last.price) + 4, axisPrice(last.price, currency, 2), { class: 'end-label' });
  if (showTarget && Math.abs(y(targetPrice) - y(last.price)) < 14) endLabel.setAttribute('y', y(last.price) - 8);

  // Fadenkreuz + Tooltip
  const cross = el('g', { class: 'cross', visibility: 'hidden' }, svg);
  const vline = el('line', { y1: m.top, y2: m.top + ph }, cross);
  const cdot = el('circle', { r: 4, class: 'dot' }, cross);
  const tip = document.createElement('div');
  tip.className = 'tooltip';
  tip.hidden = true;
  const tipValue = document.createElement('strong');
  const tipDate = document.createElement('div');
  const tipStock = document.createElement('div');
  tipDate.className = 'muted';
  tipStock.className = 'muted';
  tip.append(tipValue, tipDate, tipStock);

  const real = pts.filter((p) => !p.carried);
  const targets = real.length ? real : pts;
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
    tipDate.textContent = fmtFull.format(new Date(p.t));
    tipStock.textContent = p.stock && p.stock !== 'unknown' ? stockLabel(p.stock) : '';
    tip.hidden = false;
    const tw = tip.offsetWidth || 160;
    const left = px + 12 + tw > W ? px - 12 - tw : px + 12;
    tip.style.left = `${left}px`;
    tip.style.top = `${Math.max(0, Math.min(py - 20, H - 70))}px`;
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
}
