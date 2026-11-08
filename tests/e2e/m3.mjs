// M3: Übersicht, Detailansicht, Diagramm, Einstellungen je Produkt, Popup-Liste.
import { sleep } from './lib.mjs';

export const title = 'Übersicht und Diagramm';
const DAY = 86400e3;

export function seedData(now = Date.now()) {
  const mk = (id, name, extra) => ({
    id, url: `https://shop.example/${id}`, name, imageUrl: null, shop: 'shop.example', currency: 'EUR',
    stockStatus: 'in_stock', intervalMin: 60, lastChecked: now - 5 * 60e3, nextCheck: now + 55 * 60e3,
    lastError: null, targetPrice: null, dropThreshold: null, notifyStock: true, createdAt: now - 90 * DAY,
    preferredMethods: [], errorCount: 0, lastVia: 'abruf', ...extra,
  });
  return {
    productIds: ['a', 'b', 'c'],
    'product:a': mk('a', 'Kaffeevollautomat XY-500 mit Milchsystem, Edelstahl', { currentPrice: 1149, previousPrice: 1099, lastChange: now - 2 * DAY, targetPrice: 999 }),
    'history:a': [
      { t: now - 88 * DAY, price: 1299, stock: 'in_stock' },
      { t: now - 60 * DAY, price: 1249, stock: 'in_stock' },
      { t: now - 40 * DAY, price: 1349.9, stock: 'in_stock' },
      { t: now - 20 * DAY, price: 1199, stock: 'out_of_stock' },
      { t: now - 5 * DAY, price: 1099, stock: 'in_stock' },
      { t: now - 2 * DAY, price: 1149, stock: 'in_stock' },
    ],
    'product:b': mk('b', 'Sony WH-1000XM6 Kopfhörer', { currentPrice: 299, previousPrice: 379, lastChange: now - DAY }),
    'history:b': [{ t: now - 30 * DAY, price: 379, stock: 'in_stock' }, { t: now - DAY, price: 299, stock: 'in_stock' }],
    'product:c': mk('c', 'Akkuschrauber 18V', { currentPrice: 149.9, lastError: 'Shop antwortet mit HTTP 503' }),
    'history:c': [{ t: now - 10 * DAY, price: 149.9, stock: 'in_stock' }],
  };
}

export default async function (t) {
  const { ok } = t;
  await t.call('return API.storage.local.set(arg)', seedData());

  const dash = await t.openExtPage('dashboard/dashboard.html');
  const pageErrors = [];
  dash.on('pageerror', (e) => pageErrors.push(e.message));
  await dash.setViewport({ width: 1100, height: 800 }).catch(() => {});
  await dash.waitForSelector('.card', { timeout: 10000 });

  console.log('Übersicht');
  const cards = await dash.evaluate(() => [...document.querySelectorAll('.card')].map((c) => c.innerText.replace(/\s+/g, ' ')));
  ok(cards.length === 3, '3 Karten');
  ok(cards.some((c) => c.includes('▼') && c.includes('80,00') && c.includes('21,1')), 'Kopfhörer: ▼ 80,00 € (−21,1 %)');
  ok(cards.some((c) => c.includes('▲') && c.includes('50,00')), 'Kaffee: ▲ 50,00 €');
  ok(await dash.evaluate(() => document.querySelectorAll('.card svg.spark path').length === 3), 'Verlaufslinien in allen Karten');
  ok((await dash.evaluate(() => document.getElementById('summary').textContent)).includes('1 mit Problem'), 'Kopfzeile meldet 1 Problem');
  await dash.evaluate(() => { const s = document.getElementById('sort'); s.value = 'drop'; s.dispatchEvent(new Event('change')); });
  ok((await dash.evaluate(() => document.querySelector('.card .name').textContent)).includes('Sony'), 'Sortierung „Größte Preissenkung“');
  await dash.evaluate(() => { const s = document.getElementById('search'); s.value = 'akku'; s.dispatchEvent(new Event('input')); });
  ok((await dash.evaluate(() => document.querySelectorAll('.card').length)) === 1, 'Suche');
  await dash.evaluate(() => { const s = document.getElementById('search'); s.value = ''; s.dispatchEvent(new Event('input')); });
  await t.shot(dash, 'uebersicht', { fullPage: true });

  console.log('Detailansicht');
  await dash.evaluate(() => { location.hash = '#/p/a'; });
  await dash.waitForSelector('#chart svg', { timeout: 10000 });
  const tiles = () => dash.evaluate(() => [...document.querySelectorAll('.tile')].map((x) => x.innerText.replace(/\s+/g, ' ')));
  const range = (label) => dash.evaluate((l) => [...document.querySelectorAll('#ranges button')].find((b) => b.textContent === l).click(), label);
  await range('30 Tage');
  let tl = await tiles();
  ok(tl[0].includes('1.099,00') && tl[1].includes('1.349,90'), `30 Tage: Tief/Hoch (${tl.slice(0, 2).join(' | ')})`);
  await range('7 Tage');
  tl = await tiles();
  ok(tl[0].includes('1.099,00') && tl[1].includes('1.199,00'), `7 Tage: Tief/Hoch (${tl.slice(0, 2).join(' | ')})`);
  await range('Alles');
  ok((await tiles())[3].includes('5'), 'Alles: 5 Preisänderungen');
  ok(await dash.evaluate(() => !!document.querySelector('#chart .target')), 'Zielpreis-Linie');
  ok((await dash.evaluate(() => document.querySelectorAll('#history-rows tr').length)) === 6, 'Tabelle mit 6 Zeilen');
  const tip = await dash.evaluate(() => {
    const rect = document.querySelector('#chart svg rect');
    const r = rect.getBoundingClientRect();
    rect.dispatchEvent(new PointerEvent('pointermove', { clientX: r.left + r.width * 0.02, clientY: r.top + 20, bubbles: true }));
    const el = document.querySelector('#chart .tooltip');
    return { hidden: el.hidden, text: el.innerText.replace(/\s+/g, ' ') };
  });
  ok(!tip.hidden && tip.text.includes('1.299,00'), `Tooltip links (${tip.text})`);
  const keyTip = await dash.evaluate(() => {
    const svg = document.querySelector('#chart svg');
    svg.focus();
    svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    return document.querySelector('#chart .tooltip').innerText.replace(/\s+/g, ' ');
  });
  ok(keyTip.includes('1.099,00'), `Tastatur ← (${keyTip})`);
  await dash.evaluate(() => document.querySelector('#chart svg').blur());
  await t.shot(dash, 'detail', { fullPage: true });

  console.log('Einstellungen je Produkt');
  await dash.evaluate(() => {
    const f = document.getElementById('settings');
    f.targetPrice.value = '1.050,50';
    f.dropThreshold.value = '5';
    f.intervalMin.value = '360';
    f.notifyStock.checked = false;
    f.requestSubmit();
  });
  await sleep(600);
  let a = (await t.product('a')).p;
  ok(a.targetPrice === 1050.5 && a.dropThreshold === 5 && a.intervalMin === 360 && a.notifyStock === false, 'gespeichert');
  ok(a.nextCheck > Date.now() + 5 * 3600e3, 'nächste Prüfung an Intervall angepasst');
  const invalid = await dash.evaluate(() => {
    const f = document.getElementById('settings');
    f.targetPrice.value = 'abc';
    f.requestSubmit();
    return f.targetPrice.validationMessage;
  });
  ok(invalid.length > 0, 'ungültiger Zielpreis abgelehnt');
  a = (await t.product('a')).p;
  ok(a.targetPrice === 1050.5, 'Zielpreis unverändert');
  await t.patchProduct('a', { currentPrice: 999 });
  await sleep(800);
  ok((await dash.evaluate(() => document.getElementById('d-price').textContent)).includes('999,00'), 'Hintergrund-Änderung sofort sichtbar');
  await dash.evaluate(() => document.getElementById('d-delete').click());
  await dash.evaluate(() => document.getElementById('d-delete').click());
  await sleep(600);
  const all = await t.storage();
  ok(!all.productIds.includes('a') && !all['history:a'], 'gelöscht (zweimal klicken)');

  if (t.which === 'chrome') {
    await dash.evaluate(() => { location.hash = '#/p/b'; });
    await sleep(400);
    await dash.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
    await t.shot(dash, 'detail-dunkel', { fullPage: true });
    await dash.setViewport({ width: 390, height: 800 });
    await sleep(400);
    ok(!(await dash.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)), 'Handybreite ohne seitliches Scrollen');
    await t.shot(dash, 'detail-handy', { fullPage: true });
  }
  ok(pageErrors.length === 0, `keine Skriptfehler (${pageErrors.join('; ')})`);

  console.log('Popup-Liste');
  const pop = await t.openExtPage('popup/popup.html?liste');
  await pop.setViewport({ width: 380, height: 500 }).catch(() => {});
  await pop.waitForSelector('.plist li', { timeout: 10000 });
  const rows = await pop.evaluate(() => [...document.querySelectorAll('.plist li')].map((li) => li.innerText.replace(/\s+/g, ' ')));
  ok(rows.length === 2 && rows.some((r) => r.includes('▼ 80,00')), 'Liste mit Änderung');
  ok(await pop.evaluate(() => document.querySelectorAll('.plist svg.spark').length === 2), 'Verlaufslinien');
  await t.shot(pop, 'popup');
}
