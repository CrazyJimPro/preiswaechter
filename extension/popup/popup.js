import { api } from '../lib/api.js';
import { listProducts, findProductByUrl, deleteProduct } from '../lib/storage.js';
import { formatPrice, stockLabel, timeAgo, escapeHtml } from '../lib/format.js';

const $current = document.getElementById('current');
const $list = document.getElementById('list');
const $count = document.getElementById('count');
const $empty = document.getElementById('empty');

let pageInfo = null; // Ergebnis der Preiserkennung auf der aktiven Seite

// ---------- aktive Seite auswerten ----------

async function analyseActiveTab() {
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  if (!tab || !/^https?:/i.test(tab.url || '')) {
    return { error: 'Diese Seite kann nicht ausgewertet werden. Öffne die Produktseite eines Shops.' };
  }
  try {
    await api.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['/lib/priceParser.js', '/lib/extract.js'],
    });
    const [res] = await api.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => globalThis.Preiswaechter.extractFromDocument(document, location.href, { live: true }),
    });
    return { info: res && res.result };
  } catch (e) {
    return { error: 'Kein Zugriff auf diese Seite (z. B. Browser-interne Seite oder Add-on-Shop).' };
  }
}

function originPattern(url) {
  return new URL(url).origin + '/*';
}

function parseUserPrice(v) {
  const s = String(v || '').trim().replace(/\s|€/g, '');
  if (!s) return null;
  const n = parseFloat(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

// ---------- Darstellung oberer Bereich ----------

function cardHtml(info, priceHtml) {
  const img = info.imageUrl
    ? `<img src="${escapeHtml(info.imageUrl)}" alt="">`
    : '<div class="thumb"></div>';
  return `
    <div class="card">
      ${img}
      <div>
        <div class="name" title="${escapeHtml(info.name)}">${escapeHtml(info.name)}</div>
        <div class="meta">${escapeHtml(info.shop || '')} · ${escapeHtml(stockLabel(info.stockStatus))}</div>
      </div>
    </div>
    ${priceHtml}`;
}

function renderCurrent(state) {
  if (state.error) {
    $current.innerHTML = `<p class="muted">${escapeHtml(state.error)}</p>`;
    return;
  }
  const info = state.info;
  if (!info) {
    $current.innerHTML = '<p class="muted">Seite konnte nicht gelesen werden.</p>';
    return;
  }

  if (state.tracked) {
    const p = state.tracked;
    $current.innerHTML = cardHtml(info, `
      <div class="bigprice">${formatPrice(p.currentPrice, p.currency)}</div>
      <p class="hint">✓ Wird bereits verfolgt · zuletzt geprüft ${escapeHtml(timeAgo(p.lastChecked))}${
        p.targetPrice != null ? ` · Zielpreis ${formatPrice(p.targetPrice, p.currency)}` : ''}</p>
      ${p.lastError ? `<p class="warn">⚠ ${escapeHtml(p.lastError)}</p>` : ''}
      ${state.permissionMissing ? permissionWarning() : `<div class="row"><button id="checknow">Jetzt prüfen</button></div>`}`);
    bindPermissionButton(info);
    bindCheckNow(p.id);
    return;
  }

  if (!info.options.length) {
    $current.innerHTML = cardHtml(info, `
      <p class="warn" style="margin-top:10px">Auf dieser Seite wurde kein Preis gefunden. Ist es eine einzelne Produktseite?</p>`);
    return;
  }

  let choice = '';
  if (!info.hasConsensus) {
    choice = `
      <fieldset>
        <legend>Mehrere Preise gefunden – welcher stimmt?</legend>
        ${info.options.map((o, i) => `
          <label>
            <input type="radio" name="opt" value="${i}" ${i === 0 ? 'checked' : ''}>
            <strong>${formatPrice(o.price, o.currency)}</strong>
            <span class="src">${escapeHtml(o.labels.join(', '))}</span>
          </label>`).join('')}
      </fieldset>`;
  }

  $current.innerHTML = cardHtml(info, `
    ${info.hasConsensus ? `<div class="bigprice">${formatPrice(info.price, info.currency)}</div>` : choice}
    <div class="row">
      <label>Zielpreis (optional)
        <input id="target" type="text" inputmode="decimal" placeholder="z. B. 199,99">
      </label>
      <button id="track" class="primary" style="align-self:flex-end">Preis verfolgen</button>
    </div>
    <p class="hint">Der Browser fragt einmal nach Zugriff auf ${escapeHtml(new URL(info.productUrl).hostname)}, damit der Preis im Hintergrund geprüft werden kann.</p>`);

  document.getElementById('track').addEventListener('click', onTrack);
}

function permissionWarning() {
  return `<p class="warn">Kein Zugriff auf diesen Shop – der Preis kann nicht im Hintergrund geprüft werden.
    <button id="grant" style="margin-top:6px">Zugriff erlauben</button></p>`;
}

function bindPermissionButton(info) {
  const btn = document.getElementById('grant');
  if (!btn) return;
  btn.addEventListener('click', () => {
    // Muss direkt im Klick-Handler aufgerufen werden (ohne vorheriges await)
    api.permissions.request({ origins: [originPattern(info.productUrl)] })
      .catch(() => false)
      .then(() => refresh());
  });
}

function bindCheckNow(id) {
  const btn = document.getElementById('checknow');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = 'Wird geprüft …';
    await api.runtime.sendMessage({ type: 'checkNow', id }).catch(() => null);
    refresh();
  });
}

// ---------- „Preis verfolgen“ ----------

function onTrack() {
  const info = pageInfo;
  const sel = document.querySelector('input[name="opt"]:checked');
  const opt = info.options[sel ? Number(sel.value) : 0];
  const targetPrice = parseUserPrice(document.getElementById('target').value);

  const data = {
    url: info.productUrl,
    name: info.name,
    imageUrl: info.imageUrl,
    shop: info.shop,
    currency: opt.currency || info.currency,
    price: opt.price,
    stockStatus: info.stockStatus,
    targetPrice,
    preferredMethods: info.hasConsensus ? [] : opt.methods,
  };

  // Reihenfolge ist wichtig:
  // 1. Speichern übernimmt das Hintergrundskript – das Popup kann sich beim
  //    Berechtigungsdialog schließen (Firefox).
  // 2. permissions.request muss synchron im Klick-Handler starten.
  const saved = api.runtime.sendMessage({ type: 'addProduct', data });
  const permission = api.permissions.request({ origins: [originPattern(info.productUrl)] }).catch(() => false);

  const btn = document.getElementById('track');
  btn.disabled = true;
  btn.textContent = 'Wird gespeichert …';

  Promise.all([saved, permission]).then(([res]) => {
    if (!res || !res.ok) {
      btn.disabled = false;
      btn.textContent = 'Preis verfolgen';
      $current.insertAdjacentHTML('beforeend', `<p class="warn">Speichern fehlgeschlagen: ${escapeHtml(res && res.error)}</p>`);
      return;
    }
    refresh();
  });
}

// ---------- Liste ----------

async function renderList() {
  const products = await listProducts();
  $count.textContent = products.length ? `(${products.length})` : '';
  $empty.hidden = products.length > 0;
  $list.innerHTML = products.map((p) => `
    <li data-id="${escapeHtml(p.id)}">
      ${p.imageUrl ? `<img class="thumb" src="${escapeHtml(p.imageUrl)}" alt="">` : '<div class="thumb"></div>'}
      <div class="info">
        <div class="title" data-url="${escapeHtml(p.url)}" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</div>
        <div class="sub">${p.lastError ? `<span class="up" title="${escapeHtml(p.lastError)}">⚠</span> ` : ''}${escapeHtml([p.shop, stockLabel(p.stockStatus), timeAgo(p.lastChecked)].filter(Boolean).join(' · '))}</div>
      </div>
      <div class="price">${formatPrice(p.currentPrice, p.currency)}</div>
      <button class="del" title="Nicht mehr verfolgen" aria-label="Nicht mehr verfolgen">✕</button>
    </li>`).join('');
}

$list.addEventListener('click', async (e) => {
  const li = e.target.closest('li');
  if (!li) return;
  const del = e.target.closest('.del');
  if (del) {
    // confirm() funktioniert in Firefox-Popups nicht → zweiter Klick bestätigt
    if (del.dataset.armed) {
      await deleteProduct(li.dataset.id);
      refresh();
    } else {
      del.dataset.armed = '1';
      del.textContent = 'Löschen?';
      del.title = 'Nochmal klicken: Produkt und Preisverlauf löschen';
      setTimeout(() => {
        if (!del.isConnected) return;
        delete del.dataset.armed;
        del.textContent = '✕';
        del.title = 'Nicht mehr verfolgen';
      }, 3000);
    }
    return;
  }
  const t = e.target.closest('.title');
  if (t) {
    api.tabs.create({ url: t.dataset.url });
    window.close();
  }
});

// Bilder, die nicht laden (Shop blockiert Einbettung), nicht als kaputtes Symbol zeigen
document.addEventListener('error', (e) => {
  if (e.target instanceof HTMLImageElement) e.target.style.visibility = 'hidden';
}, true);

// ---------- Start ----------

let analysis = null;

async function refresh() {
  if (!analysis) analysis = await analyseActiveTab();
  pageInfo = analysis.info || null;
  const state = { ...analysis };
  if (pageInfo) {
    state.tracked = await findProductByUrl(pageInfo.productUrl);
    if (state.tracked) {
      state.permissionMissing = !(await api.permissions.contains({ origins: [originPattern(pageInfo.productUrl)] }));
    }
  }
  renderCurrent(state);
  await renderList();
}

refresh();
