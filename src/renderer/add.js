// Produkt per Link hinzufügen: Link einfügen → Seite lesen → prüfen → verfolgen.
import { rpc } from './rpc.js';
import { formatPrice, stockLabel } from '../lib/format.js';

const $ = (id) => document.getElementById(id);

function h(tag, props, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children) if (c != null) e.append(c);
  return e;
}

function parseUserPrice(v) {
  const s = String(v || '').trim().replace(/\s|€/g, '');
  if (!s) return null;
  const n = parseFloat(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : NaN;
}

function showBox(...children) {
  const box = $('add-result');
  box.replaceChildren(...children);
  box.hidden = false;
}

function closeBox() {
  $('add-result').hidden = true;
  $('add-result').replaceChildren();
}

// Der zuletzt verwendete Link, er soll aus der Zwischenablage nicht noch einmal kommen
let lastOffered = null;
// Link, dessen Versuch fehlgeschlagen ist: Bleibt zum Korrigieren stehen, darf aber einem neuen weichen
let failedUrl = null;

function resetForm() {
  $('add-url').value = '';
  closeBox();
}

function renderPreview(info) {
  let chosen = 0;
  const image = info.imageUrl
    ? h('img', { class: 'thumb', alt: '', src: info.imageUrl, onerror: (e) => e.target.replaceWith(h('div', { class: 'thumb placeholder' })) })
    : h('div', { class: 'thumb placeholder' });
  const choice = info.hasConsensus
    ? h('div', { class: 'bigprice', text: formatPrice(info.price, info.currency) })
    : h('fieldset', {},
      h('legend', { text: 'Mehrere Preise gefunden – welcher stimmt?' }),
      ...info.options.map((o, i) => h('label', {},
        h('input', { type: 'radio', name: 'add-opt', checked: i === 0, onchange: () => { chosen = i; } }),
        h('strong', { text: formatPrice(o.price, o.currency) }),
        h('span', { class: 'src', text: o.labels.join(', ') }))));
  const target = h('input', { id: 'add-target', type: 'text', inputmode: 'decimal', placeholder: 'z. B. 199,99' });
  showBox(h('div', { class: 'preview' }, image, h('div', {},
    h('div', { class: 'name', text: info.name }),
    h('div', { class: 'meta', text: [info.shop, stockLabel(info.stockStatus)].filter(Boolean).join(' · ') }),
    choice,
    h('div', { class: 'preview-actions' },
      h('label', {}, 'Zielpreis (optional)', target),
      h('button', {
        id: 'add-track', type: 'button', class: 'primary', text: 'Preis verfolgen',
        onclick: async () => {
          const targetPrice = parseUserPrice(target.value);
          target.setCustomValidity(Number.isNaN(targetPrice) ? 'Bitte eine Zahl größer 0 eingeben, z. B. 199,99' : '');
          if (!target.reportValidity()) return;
          const opt = info.options[chosen];
          await rpc.addProduct({
            url: info.productUrl,
            name: info.name,
            imageUrl: info.imageUrl,
            shop: info.shop,
            currency: opt.currency || info.currency,
            price: opt.price,
            stockStatus: info.stockStatus,
            targetPrice,
            preferredMethods: info.hasConsensus ? [] : opt.methods,
          });
          resetForm();
        },
      }),
      h('button', { type: 'button', text: 'Abbrechen', onclick: resetForm })))));
}

function showResult({ result, error, status, tracked }, url) {
  failedUrl = null;
  if (tracked) {
    $('add-url').value = '';
    showBox(h('p', {}, `„${tracked.name}“ wird bereits verfolgt. `,
      h('a', { href: `#/p/${tracked.id}`, text: 'Zum Preisverlauf', onclick: closeBox })));
  } else if (result && result.options.length) {
    renderPreview(result);
  } else {
    failedUrl = url;
    const why = error || (status >= 400 ? `Der Shop antwortet mit HTTP ${status}.` : 'Auf dieser Seite wurde kein Preis gefunden. Ist es eine einzelne Produktseite?');
    showBox(
      h('p', { class: 'warn', text: why }),
      h('p', { class: 'muted small', text: 'Manche Shops zeigen zuerst ein Captcha oder eine Cookie-Abfrage. Öffne die Seite im Fenster, erledige das und schließe das Fenster wieder, sobald das Produkt zu sehen ist.' }),
      h('button', {
        id: 'add-window', type: 'button', text: 'Seite im Fenster öffnen',
        onclick: async (e) => {
          e.target.disabled = true;
          e.target.textContent = 'Fenster schließen, wenn das Produkt zu sehen ist';
          try {
            showResult(await rpc.analyseInWindow(url), url);
          } catch (err) {
            showBox(h('p', { class: 'warn', text: `Fehler: ${err.message}` }));
          }
        },
      }),
    );
  }
}

async function analyse(url) {
  const go = $('add-go');
  go.disabled = true;
  $('add-hint').hidden = true;
  showBox(h('p', { class: 'muted', text: 'Seite wird gelesen … das kann bis zu 30 Sekunden dauern.' }));
  try {
    showResult(await rpc.analyseUrl(url), url);
  } catch (err) {
    showBox(h('p', { class: 'warn', text: `Fehler: ${err.message}` }));
  } finally {
    go.disabled = false;
  }
}

export function setupAddForm() {
  $('add-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const url = $('add-url').value.trim();
    if (!/^https?:\/\//i.test(url)) {
      showBox(h('p', { class: 'warn', text: 'Bitte den vollständigen Link einfügen, er beginnt mit https://' }));
      return;
    }
    lastOffered = url;
    failedUrl = null;
    analyse(url);
  });
  // Liegt beim Wechsel in die App ein neuer Link in der Zwischenablage, schon mal eintragen
  async function offerClipboard() {
    const input = $('add-url');
    const free = !input.value || input.value === failedUrl;
    if (!free || document.getElementById('list-view').hidden) return;
    const url = await rpc.clipboardUrl();
    if (url && url !== lastOffered) {
      lastOffered = url;
      if (failedUrl) {
        failedUrl = null;
        closeBox();
      }
      input.value = url;
      $('add-hint').hidden = false;
    }
  }
  window.addEventListener('focus', offerClipboard);
  offerClipboard();
}
